"""② 안부 돌봄 흐름: 1차 푸시 → (미응답) 2차 음성 → (미응답) 복지사 적색 경보.

단계 진행은 브라우저가 아니라 백엔드 타이머(tick)가 담당한다.
그래서 어르신 앱 화면이 꺼져 있어도 대시보드에 적색 경보가 올라간다.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from ..config import rules
from ..models import AlertLog, Checkin, Elder
from .state import get_state

STAGE_LABELS = {1: "1차 푸시 알림", 2: "2차 음성 알림", 3: "적색 경보"}
STATUS_LABELS = {
    "active": "응답 대기",
    "responded": "어르신 응답",
    "acknowledged": "복지사 확인",
    "cleared": "자동 해제",
}


def timings(db: Session) -> dict:
    cfg = rules()["checkin"]
    return cfg["demo"] if get_state(db).demo_mode else cfg["normal"]


def active_for(db: Session, elder_id: int) -> Checkin | None:
    return (db.query(Checkin)
            .filter(Checkin.elder_id == elder_id, Checkin.status == "active")
            .order_by(Checkin.id.desc()).first())


def _log(db: Session, c: Checkin, kind: str, message: str, at: datetime | None = None) -> None:
    db.add(AlertLog(checkin_id=c.id, elder_id=c.elder_id, kind=kind, message=message,
                    created_at=at or datetime.now()))


def start(db: Session, elder: Elder, level: str, reason: str, elder_message: str) -> Checkin:
    now = datetime.now()
    msg = rules()["checkin"]["message_template"].format(name=elder.name, elder_message=elder_message)
    c = Checkin(elder_id=elder.id, level=level, reason=reason, message=msg, stage=1,
                status="active", created_at=now,
                next_at=now + timedelta(seconds=timings(db)["to_voice_sec"]))
    db.add(c)
    db.flush()
    _log(db, c, "push", f"1차 푸시 알림 발송 — {reason}", now)
    return c


def respond(db: Session, elder_id: int) -> Checkin | None:
    c = active_for(db, elder_id)
    if not c:
        return None
    now = datetime.now()
    sec = int((now - c.created_at).total_seconds())
    elapsed = f"{sec}초" if sec < 120 else f"{sec // 60}분"
    c.status, c.closed_at, c.next_at = "responded", now, None
    after = "적색 경보 후" if c.stage == 3 else f"{STAGE_LABELS[c.stage]} 후"
    _log(db, c, "response", f"어르신 응답 '괜찮아요' ({after}, {elapsed} 만에 응답)", now)
    db.commit()
    return c


def acknowledge(db: Session, checkin_id: int, worker: str | None = None) -> Checkin | None:
    c = db.get(Checkin, checkin_id)
    if not c or c.status != "active":
        return None
    now = datetime.now()
    c.status, c.closed_at, c.next_at = "acknowledged", now, None
    who = worker or db.get(Elder, c.elder_id).social_worker
    _log(db, c, "ack", f"{who} 확인 처리 (방문·전화 확인)", now)
    db.commit()
    return c


def clear(db: Session, elder_id: int) -> bool:
    c = active_for(db, elder_id)
    if not c:
        return False
    now = datetime.now()
    c.status, c.closed_at, c.next_at = "cleared", now, None
    _log(db, c, "cleared", "위험 신호가 사라져 안부 확인을 자동 해제했습니다.", now)
    return True


def tick(db: Session) -> bool:
    """대기 시간이 지난 안부 확인을 다음 단계로 올린다. 바뀐 것이 있으면 True."""
    now = datetime.now()
    due = (db.query(Checkin)
           .filter(Checkin.status == "active", Checkin.next_at.is_not(None), Checkin.next_at <= now)
           .all())
    if not due:
        return False
    t = timings(db)
    for c in due:
        elder = db.get(Elder, c.elder_id)
        if c.stage == 1:
            c.stage = 2
            c.next_at = now + timedelta(seconds=t["to_red_sec"])
            _log(db, c, "voice", "1차 알림 미응답 → 2차 음성 알림 발송 (안내 문구 음성 재생)", now)
        elif c.stage == 2:
            c.stage = 3
            c.next_at = None
            _log(db, c, "red",
                 f"2차 음성 알림 미응답 → 적색 경보. {elder.social_worker} 확인 필요 "
                 f"(보호자 {elder.guardian_name} {elder.guardian_phone})", now)
    db.commit()
    return True


def rescale_pending(db: Session) -> None:
    """시연 모드를 켜거나 끌 때 대기 중인 단계의 남은 시간을 새 기준에 맞춘다."""
    t = timings(db)
    now = datetime.now()
    for c in db.query(Checkin).filter(Checkin.status == "active", Checkin.next_at.is_not(None)):
        wait = t["to_voice_sec"] if c.stage == 1 else t["to_red_sec"]
        c.next_at = now + timedelta(seconds=wait)
    db.commit()


def serialize(c: Checkin | None, db: Session | None = None) -> dict | None:
    if c is None:
        return None
    remaining = None
    if c.next_at and c.status == "active":
        remaining = max(0, int((c.next_at - datetime.now()).total_seconds()))
    return {
        "id": c.id,
        "elder_id": c.elder_id,
        "level": c.level,
        "reason": c.reason,
        "message": c.message,
        "stage": c.stage,
        "stage_label": STAGE_LABELS[c.stage],
        "status": c.status,
        "status_label": STATUS_LABELS[c.status],
        "created_at": c.created_at.isoformat(timespec="seconds"),
        "next_at": c.next_at.isoformat(timespec="seconds") if c.next_at else None,
        "seconds_to_next": remaining,
        "closed_at": c.closed_at.isoformat(timespec="seconds") if c.closed_at else None,
    }
