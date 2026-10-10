"""초기 데이터(가상 어르신 10명 + 과거 알림 이력) 생성과 시연 프리셋."""
from __future__ import annotations

import json
from datetime import datetime, timedelta

from sqlalchemy import delete
from sqlalchemy.orm import Session

from ..config import SEED_DIR
from ..db import Base, engine
from ..models import AlertLog, Checkin, Elder, RiskAssessment
from ..services.state import get_state


def _seed_json() -> dict:
    with open(SEED_DIR / "elders.json", encoding="utf-8") as f:
        return json.load(f)


def seed_value(elder_id: int, key: str, default=None):
    e = next((e for e in _seed_json()["elders"] if e["id"] == elder_id), None)
    return e.get(key, default) if e else default


def scale_for(elder_id: int, scenario: str) -> float:
    """냉·난방 미사용 가구는 평소에도 전기를 아껴 쓰는 저사용 가구로 가정한다."""
    if scenario == "no_hvac":
        return 0.65
    base = seed_value(elder_id, "usage_scale", 1.0)
    return base if base >= 0.85 else 0.9


def create_tables() -> None:
    Base.metadata.create_all(engine)


def seed_elders(db: Session) -> None:
    if db.query(Elder).count():
        return
    for e in _seed_json()["elders"]:
        db.add(Elder(**e))
    db.commit()


def seed_history(db: Session) -> None:
    """대시보드 알림 로그가 비어 보이지 않도록 지난 며칠의 처리 완료 이력을 넣는다 (가짜)."""
    now = datetime.now().replace(second=0, microsecond=0)
    history = [
        # (며칠 전, 시, 분, 가구, 단계 진행, 결과, 응답까지 분)
        (3, 10, 20, 10, 3, "acknowledged", 75, "최근 14시간 동안 생활 전력 변화가 거의 없습니다."),
        (2, 9, 10, 7, 2, "responded", 34, "최근 13시간 동안 생활 전력 변화가 거의 없습니다."),
        (1, 14, 5, 2, 1, "responded", 3, "최근 12시간 동안 생활 전력 변화가 거의 없습니다."),
    ]
    for days, h, m, eid, stage, status, minutes, reason in history:
        elder = db.get(Elder, eid)
        t0 = (now - timedelta(days=days)).replace(hour=h, minute=m)
        c = Checkin(elder_id=eid, level="caution", reason=reason,
                    message=f"{elder.name} 어르신, 잘 지내고 계신가요?", stage=stage, status=status,
                    created_at=t0, next_at=None, closed_at=t0 + timedelta(minutes=minutes))
        db.add(c)
        db.flush()
        logs = [("push", f"1차 푸시 알림 발송 — {reason}", t0)]
        if stage >= 2:
            logs.append(("voice", "1차 알림 미응답 → 2차 음성 알림 발송 (안내 문구 음성 재생)", t0 + timedelta(minutes=30)))
        if stage >= 3:
            logs.append(("red", f"2차 음성 알림 미응답 → 적색 경보. {elder.social_worker} 확인 필요", t0 + timedelta(minutes=60)))
        if status == "responded":
            logs.append(("response", f"어르신 응답 '괜찮아요' ({minutes}분 만에 응답)", c.closed_at))
        else:
            logs.append(("ack", f"{elder.social_worker} 확인 처리 (전화 통화로 안부 확인, 이상 없음)", c.closed_at))
        for kind, msg, at in logs:
            db.add(AlertLog(checkin_id=c.id, elder_id=eid, kind=kind, message=msg, created_at=at))
    db.commit()


def apply_preset(db: Session, preset: str = "mixed") -> None:
    """mixed: 시연용 혼합(냉·난방 미사용 1가구, 무변화 1가구) / all_normal: 전 가구 정상."""
    db.execute(delete(AlertLog))
    db.execute(delete(Checkin))
    db.execute(delete(RiskAssessment))
    for elder in db.query(Elder).all():
        elder.scenario = seed_value(elder.id, "scenario", "normal") if preset == "mixed" else "normal"
        elder.usage_scale = scale_for(elder.id, elder.scenario)
    st = get_state(db)
    if st.weather_override is not None:
        st.weather_override = "normal"
    db.commit()
    seed_history(db)
