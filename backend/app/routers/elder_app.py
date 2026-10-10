"""A. 어르신 앱 API."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..services import checkin, diet, events, welfare
from ..services.state import bump_version
from ..services.weather import current_weather, effective_mode
from .common import elder_summary, get_elder_or_404

router = APIRouter(prefix="/api/app", tags=["어르신 앱"])


@router.get("/{elder_id}/home", summary="어르신 앱 화면 데이터 한 번에")
def home(elder_id: int, db: Session = Depends(get_db)):
    elder = get_elder_or_404(db, elder_id)
    info = elder_summary(db, elder)
    mode, _ = effective_mode(db)
    risk = info["risk"] or {}
    return {
        "elder": {k: info[k] for k in ("id", "name", "age", "district", "social_worker", "guardian_name")},
        "weather": current_weather(db),
        "risk": {
            "level": risk.get("level", "safe"),
            "level_label": risk.get("level_label", "안전"),
            "message": risk.get("elder_message", ""),
        },
        "checkin": info["checkin"],
        "welfare": welfare.programs_for(mode, risk.get("flags", {})) if risk.get("welfare_target") else None,
        "diet": diet.recommend(mode),
    }


@router.post("/{elder_id}/respond", summary="'괜찮아요' 응답")
def respond(elder_id: int, db: Session = Depends(get_db)):
    get_elder_or_404(db, elder_id)
    c = checkin.respond(db, elder_id)
    if not c:
        raise HTTPException(409, "응답할 안부 확인이 없습니다.")
    events.publish("refresh", reason="respond", version=bump_version(db))
    return checkin.serialize(c)
