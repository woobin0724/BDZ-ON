"""위험도 재계산 + 안부 확인 시작/해제 + 화면 갱신 알림."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy.orm import Session

from ..models import Elder, PowerReading, RiskAssessment
from . import checkin, events
from .risk_engine import ElderInput, evaluate
from .state import bump_version, regenerate_data
from .weather import effective_mode

RANK = {"safe": 0, "caution": 1, "danger": 2}


def household_series(db: Session, elder_id: int) -> list[tuple[datetime, float]]:
    rows = (db.query(PowerReading.ts, PowerReading.kwh)
            .filter(PowerReading.elder_id == elder_id)
            .order_by(PowerReading.ts).all())
    return [(ts, k) for ts, k in rows]


def recompute_all(db: Session, regenerate: bool = True, reason: str = "recompute") -> None:
    """기상 상태·시나리오를 반영해 데이터를 다시 만들고 전 가구 위험도를 재계산한다.

    - 위험도가 올라가면(안전→주의, 주의→위험 등) 안부 확인(1차 푸시)을 새로 시작한다.
    - 안전으로 돌아오면 진행 중인 안부 확인을 자동 해제한다.
    """
    mode, _ = effective_mode(db)
    if regenerate:
        regenerate_data(db, mode)

    now = datetime.now()
    for elder in db.query(Elder).order_by(Elder.id).all():
        result = evaluate(ElderInput(elder.name, elder.age, elder.lives_alone), mode,
                          household_series(db, elder.id))
        prev = db.get(RiskAssessment, elder.id)
        prev_rank = RANK[prev.level] if prev else 0
        new_rank = RANK[result["level"]]

        if prev is None:
            prev = RiskAssessment(elder_id=elder.id)
            db.add(prev)
        prev.level = result["level"]
        prev.score = result["score"]
        prev.reasons = result["reasons"]
        prev.elder_message = result["elder_message"]
        prev.flags = result["flags"]
        prev.welfare_target = result["welfare_target"]
        prev.computed_at = now

        active = checkin.active_for(db, elder.id)
        if new_rank == 0 and active:
            checkin.clear(db, elder.id)
        elif new_rank > prev_rank and not active:
            checkin.start(db, elder, result["level"], result["reasons"][0], result["elder_message"])
        elif active and new_rank > prev_rank:
            # 진행 중인 안부 확인의 위험도·사유만 갱신
            active.level, active.reason = result["level"], result["reasons"][0]
    db.commit()
    version = bump_version(db)
    events.publish("refresh", reason=reason, version=version)
