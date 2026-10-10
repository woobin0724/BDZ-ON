"""기상 정보: 기상청 API(키가 있을 때) ↔ mock.

- 시연 패널에서 기상 상태를 지정하면(weather_override) 항상 그 값이 우선한다.
- 지정이 없고 KMA_API_KEY 가 있으면 기상청 특보·예보를 조회한다.
- API 호출이 실패하면 자동으로 mock 으로 대체한다 (심사장 네트워크 장애 대비).
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timedelta

import httpx
from sqlalchemy.orm import Session

from ..config import DATA_DIR, KMA_API_KEY, weather_api_enabled
from ..models import WeatherHourly
from .state import WEATHER_LABELS, get_state

# 전주 (기상청 격자 / 지점번호)
NX, NY = 63, 89
STN_ID = 146
TIMEOUT = 4.0
CACHE_SEC = 600

_cache: dict[str, tuple[float, object]] = {}

ADVICE = {
    "normal": "큰 기상 위험은 없어요. 규칙적으로 식사하고 가볍게 산책하세요.",
    "heatwave": "낮 12시~5시에는 바깥 활동을 피하고, 에어컨·선풍기를 켜고 물을 자주 드세요.",
    "coldwave": "외출을 줄이고 실내를 따뜻하게 유지하세요. 수도관 동파도 조심하세요.",
}


def _profiles() -> dict:
    with open(DATA_DIR / "weather_mock.json", encoding="utf-8") as f:
        return json.load(f)


def _cached(key: str, fn):
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < CACHE_SEC:
        return hit[1]
    val = fn()
    _cache[key] = (time.time(), val)
    return val


# ─────────────────────────── 기상청 API ───────────────────────────

def _kma_get(url: str, params: dict) -> list[dict]:
    params = {"serviceKey": KMA_API_KEY, "dataType": "JSON", "numOfRows": 1000, "pageNo": 1, **params}
    r = httpx.get(url, params=params, timeout=TIMEOUT)
    r.raise_for_status()
    body = r.json()["response"]
    if body["header"]["resultCode"] != "00":
        raise RuntimeError(body["header"]["resultMsg"])
    items = body["body"]["items"]
    return items["item"] if isinstance(items, dict) else []


def _kma_warning_mode() -> tuple[str, str | None]:
    """현재 전북 지역 폭염/한파 특보 여부. (mode, 특보명)"""
    items = _kma_get(
        "http://apis.data.go.kr/1360000/WthrWrnInfoService/getPwnStatus", {}
    )
    text = " ".join(str(it.get("t6", "")) for it in items)
    for line in text.replace("\r", "").split("o "):
        if ":" not in line:
            continue
        name, regions = line.split(":", 1)
        if "전북" not in regions and "전라북도" not in regions:
            continue
        name = name.strip()
        if "폭염" in name:
            return "heatwave", name
        if "한파" in name:
            return "coldwave", name
    return "normal", None


def _kma_forecast() -> dict:
    """단기예보에서 오늘 최고·최저, 현재 기온, 하늘상태."""
    now = datetime.now()
    # 단기예보 발표: 02,05,08,11,14,17,20,23시 (+10분 후 제공)
    issue = now - timedelta(minutes=15)
    hours = [2, 5, 8, 11, 14, 17, 20, 23]
    h = max([x for x in hours if x <= issue.hour], default=None)
    if h is None:
        issue -= timedelta(days=1)
        h = 23
    items = _kma_get(
        "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst",
        {"base_date": issue.strftime("%Y%m%d"), "base_time": f"{h:02d}00", "nx": NX, "ny": NY},
    )
    today = now.strftime("%Y%m%d")
    tmps, tmx, tmn, sky, cur = [], None, None, None, None
    for it in items:
        if it["fcstDate"] != today:
            continue
        cat, val = it["category"], it["fcstValue"]
        if cat == "TMP":
            tmps.append((it["fcstTime"], float(val)))
        elif cat == "TMX":
            tmx = float(val)
        elif cat == "TMN":
            tmn = float(val)
        elif cat == "SKY" and sky is None:
            sky = {"1": "맑음", "3": "구름 많음", "4": "흐림"}.get(str(val), "맑음")
    if tmps:
        target = f"{now.hour:02d}00"
        cur = min(tmps, key=lambda x: abs(int(x[0]) - int(target)))[1]
        tmx = tmx if tmx is not None else max(t for _, t in tmps)
        tmn = tmn if tmn is not None else min(t for _, t in tmps)
    return {"temp_now": cur, "high": tmx, "low": tmn, "sky": sky or "맑음"}


# ─────────────────────────── 공개 함수 ───────────────────────────

def effective_mode(db: Session) -> tuple[str, str]:
    """(기상 상태, 출처). 출처: demo(시연 패널 지정) / kma(기상청) / mock"""
    st = get_state(db)
    if st.weather_override:
        return st.weather_override, "demo"
    if weather_api_enabled():
        try:
            mode, _ = _cached("warn", _kma_warning_mode)
            return mode, "kma"
        except Exception:
            return "normal", "mock"
    return "normal", "mock"


def current_weather(db: Session) -> dict:
    st = get_state(db)
    mode, source = effective_mode(db)
    prof = _profiles()

    row = db.query(WeatherHourly).filter(WeatherHourly.ts == st.base_time).first()
    temp_now = row.temp if row else None
    if mode in ("heatwave", "coldwave"):
        p = prof[mode]
        high, low, sky = p["alert"]["high"], p["alert"]["low"], p["sky"]
        warning, warning_detail = p["warning"], p["warning_detail"]
    else:
        p = prof["normal_by_month"][str(st.base_time.month)]
        high, low, sky = p["high"], p["low"], p["sky"]
        warning, warning_detail = None, None

    if source == "kma":
        try:
            fc = _cached("fcst", _kma_forecast)
            temp_now = fc["temp_now"] if fc["temp_now"] is not None else temp_now
            high = fc["high"] if fc["high"] is not None else high
            low = fc["low"] if fc["low"] is not None else low
            sky = fc["sky"]
            _, warn_name = _cached("warn", _kma_warning_mode)
            warning = warn_name
        except Exception:
            source = "mock"

    return {
        "mode": mode,
        "mode_label": WEATHER_LABELS[mode],
        "source": source,
        "station": prof["station"],
        "temp_now": temp_now,
        "high": high,
        "low": low,
        "sky": sky,
        "warning": warning,
        "warning_detail": warning_detail,
        "advice": ADVICE[mode],
        "base_time": st.base_time.isoformat(),
    }
