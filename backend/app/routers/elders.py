"""가구(어르신) 조회 + 대시보드용 API."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import AlertLog, Checkin, Elder, PowerReading, WeatherHourly
from ..services import checkin, events
from ..services.state import bump_version
from .common import elder_summary, get_elder_or_404

router = APIRouter(prefix="/api", tags=["가구·대시보드"])

LEVEL_ORDER = {"danger": 0, "caution": 1, "safe": 2}
KIND_LABELS = {
    "push": "1차 푸시",
    "voice": "2차 음성",
    "red": "적색 경보",
    "response": "어르신 응답",
    "ack": "복지사 확인",
    "cleared": "자동 해제",
}


@router.get("/elders", summary="전체 가구 목록 (위험도 순)")
def list_elders(db: Session = Depends(get_db)):
    items = [elder_summary(db, e) for e in db.query(Elder).all()]

    def key(x):
        r = x["risk"] or {"level": "safe", "score": 0}
        red = 0 if (x["checkin"] and x["checkin"]["stage"] == 3) else 1
        return (red, LEVEL_ORDER[r["level"]], -r["score"], x["id"])

    return sorted(items, key=key)


@router.get("/elders/{elder_id}", summary="가구 상세")
def get_elder(elder_id: int, db: Session = Depends(get_db)):
    return elder_summary(db, get_elder_or_404(db, elder_id))


@router.get("/elders/{elder_id}/timeseries", summary="최근 7일 1시간 단위 전력 사용량 + 기온")
def timeseries(elder_id: int, db: Session = Depends(get_db)):
    get_elder_or_404(db, elder_id)
    temps = {w.ts: w.temp for w in db.query(WeatherHourly).all()}
    rows = (db.query(PowerReading).filter(PowerReading.elder_id == elder_id)
            .order_by(PowerReading.ts).all())
    return [{"ts": r.ts.isoformat(timespec="minutes"), "kwh": r.kwh, "temp": temps.get(r.ts)} for r in rows]


@router.get("/dashboard/summary", summary="위험도 단계별 가구 수")
def summary(db: Session = Depends(get_db)):
    items = list_elders(db)
    count = {"safe": 0, "caution": 0, "danger": 0}
    for x in items:
        if x["risk"]:
            count[x["risk"]["level"]] += 1
    red = [x for x in items if x["checkin"] and x["checkin"]["stage"] == 3]
    waiting = [x for x in items if x["checkin"]]
    return {"total": len(items), "count": count, "red_alerts": len(red), "active_checkins": len(waiting)}


@router.get("/alerts", summary="알림 로그")
def alerts(limit: int = 60, elder_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(AlertLog, Elder, Checkin).join(Elder, Elder.id == AlertLog.elder_id) \
        .outerjoin(Checkin, Checkin.id == AlertLog.checkin_id)
    if elder_id:
        q = q.filter(AlertLog.elder_id == elder_id)
    rows = q.order_by(AlertLog.created_at.desc(), AlertLog.id.desc()).limit(limit).all()
    return [{
        "id": log.id,
        "checkin_id": log.checkin_id,
        "elder_id": elder.id,
        "elder_name": elder.name,
        "kind": log.kind,
        "kind_label": KIND_LABELS.get(log.kind, log.kind),
        "message": log.message,
        "created_at": log.created_at.isoformat(timespec="seconds"),
        "checkin_status": c.status if c else None,
        "checkin_status_label": checkin.STATUS_LABELS.get(c.status) if c else None,
    } for log, elder, c in rows]


class AckBody(BaseModel):
    worker: str | None = None


@router.post("/checkins/{checkin_id}/ack", summary="복지사 확인 처리 (적색 경보 해제)")
def ack(checkin_id: int, body: AckBody | None = None, db: Session = Depends(get_db)):
    c = checkin.acknowledge(db, checkin_id, body.worker if body else None)
    if not c:
        raise HTTPException(409, "진행 중인 안부 확인이 아닙니다.")
    events.publish("refresh", reason="ack", version=bump_version(db))
    return checkin.serialize(c)
