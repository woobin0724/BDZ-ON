"""C. 시연 컨트롤 패널 API + 공통 메타 정보."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..config import SERVICE_NAME, SERVICE_SUBTITLE, price_api_enabled, weather_api_enabled
from ..db import get_db
from ..models import Checkin, RiskAssessment
from ..seed.seeder import apply_preset, scale_for
from ..services import checkin, events
from ..services.assess import recompute_all
from ..services.state import SCENARIO_LABELS, WEATHER_LABELS, bump_version, get_state
from ..services.weather import effective_mode
from .common import get_elder_or_404

router = APIRouter(prefix="/api", tags=["시연 패널"])


@router.get("/meta", summary="서비스 정보와 현재 시연 상태")
def meta(db: Session = Depends(get_db)):
    st = get_state(db)
    mode, source = effective_mode(db)
    return {
        "service_name": SERVICE_NAME,
        "service_subtitle": SERVICE_SUBTITLE,
        "weather_mode": mode,
        "weather_label": WEATHER_LABELS[mode],
        "weather_source": source,
        "weather_override": st.weather_override,
        "demo_mode": st.demo_mode,
        "timings": checkin.timings(db),
        "base_time": st.base_time.isoformat(timespec="minutes"),
        "server_time": datetime.now().isoformat(timespec="seconds"),
        "version": st.version,
        "apis": {
            "weather": "real" if weather_api_enabled() else "mock",
            "prices": "real" if price_api_enabled() else "mock",
        },
        "scenario_labels": SCENARIO_LABELS,
        "weather_labels": WEATHER_LABELS,
    }


class WeatherBody(BaseModel):
    mode: Literal["normal", "heatwave", "coldwave", "auto"]


@router.post("/demo/weather", summary="기상 상태 전환 (평상/폭염/한파/auto=실제 API)")
def set_weather(body: WeatherBody, db: Session = Depends(get_db)):
    st = get_state(db)
    if body.mode == "auto" and not weather_api_enabled():
        raise HTTPException(400, "KMA_API_KEY 가 없어 실제 기상 API 를 사용할 수 없습니다.")
    st.weather_override = None if body.mode == "auto" else body.mode
    db.commit()
    recompute_all(db, reason="weather")
    return meta(db)


class ScenarioBody(BaseModel):
    elder_id: int
    scenario: Literal["normal", "no_hvac", "flat"]


@router.post("/demo/scenario", summary="가구 전력 시나리오 전환")
def set_scenario(body: ScenarioBody, db: Session = Depends(get_db)):
    elder = get_elder_or_404(db, body.elder_id)
    elder.scenario = body.scenario
    elder.usage_scale = scale_for(elder.id, body.scenario)
    db.commit()
    recompute_all(db, reason="scenario")
    return {"ok": True}


class DemoModeBody(BaseModel):
    enabled: bool


@router.post("/demo/demo-mode", summary="시연 모드(알림 단계 10초) 켜기/끄기")
def set_demo_mode(body: DemoModeBody, db: Session = Depends(get_db)):
    st = get_state(db)
    st.demo_mode = body.enabled
    db.commit()
    checkin.rescale_pending(db)
    events.publish("refresh", reason="demo_mode", version=bump_version(db))
    return meta(db)


class ResetBody(BaseModel):
    preset: Literal["mixed", "all_normal"] = "mixed"


@router.post("/demo/reset", summary="초기화 (mixed: 시연용 혼합 / all_normal: 전 가구 정상)")
def reset(body: ResetBody, db: Session = Depends(get_db)):
    apply_preset(db, body.preset)
    recompute_all(db, reason="reset")
    return meta(db)


@router.post("/demo/checkin/{elder_id}", summary="안부 확인 수동 시작")
def manual_checkin(elder_id: int, db: Session = Depends(get_db)):
    elder = get_elder_or_404(db, elder_id)
    if checkin.active_for(db, elder_id):
        raise HTTPException(409, "이미 진행 중인 안부 확인이 있습니다.")
    ra = db.get(RiskAssessment, elder_id)
    level = ra.level if ra and ra.level != "safe" else "caution"
    reason = ra.reasons[0] if ra and ra.level != "safe" else "시연용 수동 안부 확인"
    msg = ra.elder_message if ra and ra.level != "safe" else "잘 지내고 계신가요?"
    c = checkin.start(db, elder, level, reason, msg)
    db.commit()
    events.publish("refresh", reason="checkin", version=bump_version(db))
    return checkin.serialize(c)


@router.post("/demo/checkin/{checkin_id}/advance", summary="안부 확인 다음 단계로 즉시 진행")
def advance(checkin_id: int, db: Session = Depends(get_db)):
    c = db.get(Checkin, checkin_id)
    if not c or c.status != "active" or c.stage >= 3:
        raise HTTPException(409, "진행할 수 있는 안부 확인이 아닙니다.")
    c.next_at = datetime.now()
    db.commit()
    checkin.tick(db)
    events.publish("refresh", reason="advance", version=bump_version(db))
    return checkin.serialize(c)
