"""가상 AMI 전력 데이터 생성기.

가구별 1시간 단위 전력 사용량(kWh) 최근 7일치를 만든다.
같은 가구·같은 시각에는 항상 같은 값이 나오도록 (가구ID, 시각) 으로 난수 시드를 고정한다.

시나리오
- normal  : 아침·점심·저녁 생활 패턴이 있고, 폭염 시 냉방 / 한파 시 난방 사용이 늘어난다.
- no_hvac : 생활 패턴은 있지만 특보 중에도 냉·난방 사용이 늘지 않는다 (에너지 빈곤 의심).
- flat    : 최근 FLAT_HOURS 시간 동안 사용량이 거의 일정하다 (안부 이상 의심).
"""
from __future__ import annotations

import json
import math
import random
from datetime import datetime, timedelta

from ..config import DATA_DIR, rules

HOURS = 24 * 7
FLAT_HOURS = 18

# 기본 부하 (냉장고 등 상시 전력, kWh/h)
BASE_LOAD = 0.12
# 시간대별 생활 전력 (기본 부하 위에 더해지는 양, kWh/h) — 아침·점심·저녁 패턴
ACTIVITY = [
    0.00, 0.00, 0.00, 0.00, 0.00, 0.01,  # 0~5시
    0.15, 0.27, 0.21, 0.12, 0.09, 0.12,  # 6~11시
    0.21, 0.12, 0.09, 0.09, 0.12, 0.21,  # 12~17시
    0.30, 0.33, 0.27, 0.21, 0.12, 0.03,  # 18~23시
]
COOLING_FROM_C = 30.0   # 이 기온 이상이면 냉방 사용
HEATING_BELOW_C = 0.0   # 이 기온 이하이면 난방 사용
HOME_COOLING_HOURS = set(range(11, 24))
HOME_HEATING_HOURS = set(range(18, 24)) | set(range(0, 9))


def _load_weather_profiles() -> dict:
    with open(DATA_DIR / "weather_mock.json", encoding="utf-8") as f:
        return json.load(f)


def _diurnal(hour: int) -> float:
    """0~1. 새벽 5시 최저, 오후 3시 최고."""
    if 5 <= hour <= 15:
        return (1 - math.cos(math.pi * (hour - 5) / 10)) / 2
    h = hour - 15 if hour > 15 else hour + 9
    return (1 + math.cos(math.pi * h / 14)) / 2


def hourly_timestamps(base_time: datetime) -> list[datetime]:
    start = base_time - timedelta(hours=HOURS - 1)
    return [start + timedelta(hours=i) for i in range(HOURS)]


def is_alert_hour(idx: int) -> bool:
    """idx: 0..HOURS-1. 마지막 alert_period_days 일이 특보 기간."""
    alert_hours = int(rules()["alert_period_days"]) * 24
    return idx >= HOURS - alert_hours


def generate_temperatures(base_time: datetime, weather_mode: str) -> list[tuple[datetime, float]]:
    prof = _load_weather_profiles()
    out = []
    for i, ts in enumerate(hourly_timestamps(base_time)):
        rng = random.Random(f"temp-{weather_mode}-{ts:%Y%m%d%H}")
        if weather_mode in ("heatwave", "coldwave"):
            p = prof[weather_mode]["alert" if is_alert_hour(i) else "baseline"]
        else:
            p = prof["normal_by_month"][str(ts.month)]
        t = p["low"] + (p["high"] - p["low"]) * _diurnal(ts.hour) + rng.uniform(-0.6, 0.6)
        out.append((ts, round(t, 1)))
    return out


def _household_kwh(elder_id: int, scenario: str, scale: float, ts: datetime, temp: float,
                   idx: int) -> float:
    rng = random.Random(f"kwh-{elder_id}-{ts:%Y%m%d%H}")

    if scenario == "flat" and idx >= HOURS - FLAT_HOURS:
        # 생활 활동이 멈춘 상태: 냉장고 등 상시 부하만 거의 일정하게 남는다
        return round(BASE_LOAD * scale + rng.uniform(-0.004, 0.004), 3)

    base = BASE_LOAD * scale + rng.gauss(0, 0.008)
    activity = ACTIVITY[ts.hour] * scale * rng.uniform(0.7, 1.3)
    hvac = 0.0
    if scenario != "no_hvac":
        if temp >= COOLING_FROM_C and ts.hour in HOME_COOLING_HOURS:
            hvac = min(1.1, 0.35 + 0.12 * (temp - COOLING_FROM_C)) * rng.uniform(0.85, 1.1)
        elif temp <= HEATING_BELOW_C and ts.hour in HOME_HEATING_HOURS:
            hvac = min(1.2, 0.3 + 0.07 * (HEATING_BELOW_C - temp)) * rng.uniform(0.85, 1.1)
    return round(max(0.05, base + activity + hvac), 3)


def generate_household(elder_id: int, scenario: str, scale: float,
                       temps: list[tuple[datetime, float]]) -> list[tuple[datetime, float]]:
    return [
        (ts, _household_kwh(elder_id, scenario, scale, ts, t, i))
        for i, (ts, t) in enumerate(temps)
    ]
