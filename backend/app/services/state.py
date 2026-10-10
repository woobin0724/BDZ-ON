"""시스템 상태와 가상 데이터 재생성."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import delete
from sqlalchemy.orm import Session

from ..config import DEMO_MODE_DEFAULT, weather_api_enabled
from ..models import Elder, PowerReading, SystemState, WeatherHourly
from ..seed import power_generator as gen

WEATHER_LABELS = {"normal": "평상", "heatwave": "폭염", "coldwave": "한파"}
SCENARIO_LABELS = {"normal": "정상", "no_hvac": "냉·난방 미사용", "flat": "생활 전력 무변화"}


def now_hour() -> datetime:
    return datetime.now().replace(minute=0, second=0, microsecond=0)


def get_state(db: Session) -> SystemState:
    st = db.get(SystemState, 1)
    if st is None:
        st = SystemState(
            id=1,
            weather_override=None if weather_api_enabled() else "normal",
            demo_mode=DEMO_MODE_DEFAULT,
            base_time=now_hour(),
            version=0,
        )
        db.add(st)
        db.commit()
    return st


def bump_version(db: Session) -> int:
    st = get_state(db)
    st.version += 1
    db.commit()
    return st.version


def regenerate_data(db: Session, weather_mode: str) -> None:
    """기준 시각을 현재 정각으로 맞추고 기온·전력 7일치를 다시 만든다."""
    st = get_state(db)
    st.base_time = now_hour()
    temps = gen.generate_temperatures(st.base_time, weather_mode)

    db.execute(delete(WeatherHourly))
    db.execute(delete(PowerReading))
    db.add_all(WeatherHourly(ts=ts, temp=t) for ts, t in temps)
    for elder in db.query(Elder).all():
        rows = gen.generate_household(elder.id, elder.scenario, elder.usage_scale, temps)
        db.add_all(PowerReading(elder_id=elder.id, ts=ts, kwh=k) for ts, k in rows)
    db.commit()
