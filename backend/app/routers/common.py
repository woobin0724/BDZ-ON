from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from ..models import Elder, RiskAssessment
from ..services import checkin
from ..services.state import SCENARIO_LABELS

LEVEL_LABELS = {"safe": "안전", "caution": "주의", "danger": "위험"}


def get_elder_or_404(db: Session, elder_id: int) -> Elder:
    elder = db.get(Elder, elder_id)
    if not elder:
        raise HTTPException(404, "해당 어르신을 찾을 수 없습니다.")
    return elder


def elder_summary(db: Session, e: Elder) -> dict:
    ra = db.get(RiskAssessment, e.id)
    return {
        "id": e.id,
        "name": e.name,
        "age": e.age,
        "gender": e.gender,
        "lives_alone": e.lives_alone,
        "district": e.district,
        "address": e.address,
        "lat": e.lat,
        "lng": e.lng,
        "phone": e.phone,
        "guardian_name": e.guardian_name,
        "guardian_phone": e.guardian_phone,
        "social_worker": e.social_worker,
        "scenario": e.scenario,
        "scenario_label": SCENARIO_LABELS[e.scenario],
        "risk": None if ra is None else {
            "level": ra.level,
            "level_label": LEVEL_LABELS[ra.level],
            "score": ra.score,
            "reasons": ra.reasons,
            "elder_message": ra.elder_message,
            "flags": ra.flags,
            "welfare_target": ra.welfare_target,
            "computed_at": ra.computed_at.isoformat(timespec="seconds"),
        },
        "checkin": checkin.serialize(checkin.active_for(db, e.id)),
    }
