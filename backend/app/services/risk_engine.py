"""핵심 엔진: 규칙 기반 위험도 분석 (안전 / 주의 / 위험).

입력: 기상 상태, 가구 1시간 단위 전력 사용량, 나이, 독거 여부
출력: 위험도, 점수(정렬용), 사람이 읽을 수 있는 판단 근거 문장, 어르신용 안내 문장

규칙과 임계값은 모두 risk_rules.yaml 에 있다. evaluate() 는 DB 와 무관한 순수 함수라
단위 테스트로 시나리오별 결과를 검증할 수 있다.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from ..config import rules as load_rules

WEATHER_LABELS = {"normal": "평상", "heatwave": "폭염", "coldwave": "한파"}
HVAC_RULES = ("heatwave_no_cooling", "coldwave_no_heating")


@dataclass
class ElderInput:
    name: str
    age: int
    lives_alone: bool


def _mean(xs: list[float]) -> float:
    return sum(xs) / len(xs) if xs else 0.0


def _hvac_ratio(series: list[tuple[datetime, float]], hours: list[int], alert_hours: int) -> float | None:
    """특보 기간 / 특보 전 평소 의 지정 시간대 평균 사용량 비율."""
    if len(series) <= alert_hours:
        return None
    hs = set(hours)
    before = [k for ts, k in series[:-alert_hours] if ts.hour in hs]
    during = [k for ts, k in series[-alert_hours:] if ts.hour in hs]
    if not before or not during or _mean(before) <= 0:
        return None
    return _mean(during) / _mean(before)


def _flat_run(series: list[tuple[datetime, float]], max_range: float) -> tuple[int, float]:
    """끝(현재)에서부터 사용량 변동폭이 max_range 이하로 이어진 시간 수와 그 변동폭."""
    lo = hi = None
    count = 0
    for _, k in reversed(series):
        nlo = k if lo is None else min(lo, k)
        nhi = k if hi is None else max(hi, k)
        if nhi - nlo > max_range:
            break
        lo, hi = nlo, nhi
        count += 1
    return count, round((hi - lo) if count else 0.0, 3)


def evaluate(elder: ElderInput, weather_mode: str, series: list[tuple[datetime, float]],
             cfg: dict | None = None) -> dict:
    cfg = cfg or load_rules()
    levels = [lv["key"] for lv in cfg["levels"]]
    base_scores = {lv["key"]: lv["base_score"] for lv in cfg["levels"]}
    labels = {lv["key"]: lv["label"] for lv in cfg["levels"]}
    rules = cfg["rules"]
    alert_hours = int(cfg["alert_period_days"]) * 24

    rank = 0
    extra = 0
    reasons: list[str] = []
    elder_msgs: list[tuple[int, str]] = []  # (rank, 문장)
    flags: dict = {"weather_mode": weather_mode}

    # ① 폭염·한파 냉난방 미사용
    flags["hvac_missing"] = False
    for key in HVAC_RULES:
        r = rules.get(key, {})
        if not r.get("enabled") or r.get("weather") != weather_mode:
            continue
        ratio = _hvac_ratio(series, r["hours"], alert_hours)
        flags["hvac_ratio"] = None if ratio is None else round(ratio, 2)
        if ratio is None:
            continue
        pct = round(ratio * 100)
        if ratio < r["min_increase_ratio"]:
            lr = levels.index(r["level"])
            rank = max(rank, lr)
            extra += max(0, min(15, round((r["min_increase_ratio"] - ratio) / r["min_increase_ratio"] * 30)))
            reasons.append(r["reason"].format(ratio_pct=pct))
            elder_msgs.append((lr, r["elder_message"]))
            flags["hvac_missing"] = True
            flags["rule"] = key
        elif r.get("ok_reason"):
            flags["hvac_ok_reason"] = r["ok_reason"].format(ratio_pct=pct)

    # ② 생활 전력 무변화
    r = rules.get("flat_pattern", {})
    flat_hours, flat_range = _flat_run(series, r.get("max_range_kwh", 0.06))
    flags["flat_hours"] = flat_hours
    flags["flat_detected"] = False
    if r.get("enabled") and flat_hours >= r["window_hours"]:
        lr = levels.index(r["level"])
        rank = max(rank, lr)
        extra += min(10, flat_hours - r["window_hours"])
        reasons.append(r["reason"].format(flat_hours=flat_hours, range_kwh=flat_range))
        elder_msgs.append((lr, r["elder_message"]))
        flags["flat_detected"] = True

    # 가중치: 고령 + 독거
    r = rules.get("age_alone_weight", {})
    flags["weighted"] = False
    if r.get("enabled") and elder.age >= r["min_age"] and (elder.lives_alone or not r.get("require_alone")):
        fmt = {"age": elder.age, "weather_label": WEATHER_LABELS.get(weather_mode, "")}
        if 0 < rank < len(levels) - 1:
            rank += 1
            reasons.append(r["reason"].format(**fmt))
            flags["weighted"] = True
        elif rank == 0 and r.get("apply_when_safe_during_alert") and weather_mode in ("heatwave", "coldwave"):
            rank = 1
            reasons.append(r["reason_when_safe"].format(**fmt))
            flags["weighted"] = True
        if rank > 0:
            extra += 3 + min(6, (elder.age - r["min_age"]) // 2)

    # 사용량 통계 (복지 안내용)
    last3 = [k for _, k in series[-72:]]
    daily_avg = round(sum(last3) / 3, 2) if len(last3) == 72 else round(_mean(last3) * 24, 2)
    w = cfg.get("welfare", {})
    flags["daily_avg_kwh"] = daily_avg
    flags["low_usage"] = daily_avg <= w.get("low_usage_daily_kwh", 0)

    level = levels[rank]
    if rank == 0:
        reasons = [flags.get("hvac_ok_reason") or cfg["safe_reason"]]
        elder_message = cfg["safe_elder_message"]
    else:
        elder_message = max(elder_msgs, key=lambda x: x[0])[1] if elder_msgs else cfg["safe_elder_message"]

    welfare_target = rank >= levels.index(w.get("min_level", "caution")) and (
        flags["low_usage"] or (w.get("include_hvac_missing", True) and flags["hvac_missing"])
    )

    return {
        "level": level,
        "level_label": labels[level],
        "score": min(99, base_scores[level] + extra),
        "reasons": reasons,
        "elder_message": elder_message,
        "flags": flags,
        "welfare_target": bool(welfare_target),
    }
