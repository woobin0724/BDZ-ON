"""시나리오별 위험도 판정 검증.  실행: (backend 폴더) python -m pytest -q"""
from datetime import datetime

import pytest

from app.seed import power_generator as gen
from app.services.risk_engine import ElderInput, evaluate

BASE = datetime(2026, 7, 20, 15)
YOUNG = ElderInput("테스트", 75, True)
OLD_ALONE = ElderInput("테스트", 85, True)
OLD_WITH_FAMILY = ElderInput("테스트", 85, False)


def series(scenario: str, mode: str, scale: float = 1.0, elder_id: int = 1):
    temps = gen.generate_temperatures(BASE, mode)
    return gen.generate_household(elder_id, scenario, scale, temps)


@pytest.mark.parametrize("mode", ["normal", "heatwave", "coldwave"])
def test_normal_household_is_safe(mode):
    for eid in range(1, 6):
        r = evaluate(YOUNG, mode, series("normal", mode, elder_id=eid))
        assert r["level"] == "safe", r["reasons"]
        assert not r["welfare_target"]


def test_heatwave_without_cooling_is_danger_with_reason():
    r = evaluate(YOUNG, "heatwave", series("no_hvac", "heatwave", 0.65))
    assert r["level"] == "danger"
    assert "폭염" in r["reasons"][0] and "냉방" in r["reasons"][0]
    assert r["flags"]["hvac_missing"]
    assert r["welfare_target"]


def test_coldwave_without_heating_is_danger():
    r = evaluate(YOUNG, "coldwave", series("no_hvac", "coldwave", 0.65))
    assert r["level"] == "danger"
    assert "난방" in r["reasons"][0]


def test_no_hvac_household_is_safe_in_normal_weather():
    r = evaluate(YOUNG, "normal", series("no_hvac", "normal", 0.65))
    assert r["level"] == "safe"


def test_flat_pattern_is_caution():
    r = evaluate(YOUNG, "normal", series("flat", "normal"))
    assert r["level"] == "caution"
    assert r["flags"]["flat_hours"] >= 12
    assert "생활 전력" in r["reasons"][0]


def test_age_and_alone_escalates_one_level():
    assert evaluate(OLD_ALONE, "normal", series("flat", "normal"))["level"] == "danger"
    assert evaluate(OLD_WITH_FAMILY, "normal", series("flat", "normal"))["level"] == "caution"
    # 신호가 없으면 고령 독거라도 안전 유지 (apply_when_safe_during_alert: false)
    assert evaluate(OLD_ALONE, "heatwave", series("normal", "heatwave"))["level"] == "safe"


def test_danger_sorts_above_caution():
    danger = evaluate(YOUNG, "heatwave", series("no_hvac", "heatwave", 0.65))
    caution = evaluate(YOUNG, "normal", series("flat", "normal"))
    assert danger["score"] > caution["score"]
