"""농산물 가격: KAMIS API(키가 있을 때) ↔ mock.

KAMIS '최근일자 도·소매가격정보(dailySalesList)' 에서 소매가격을 찾아
오늘 가격(dpr1)과 1개월 전 / 1년 전 가격의 평균을 '평년' 으로 사용한다.
찾지 못한 품목이나 호출 실패 시 mock 가격을 그대로 쓴다.
"""
from __future__ import annotations

import json
import time

import httpx

from ..config import DATA_DIR, KAMIS_CERT_ID, KAMIS_CERT_KEY, price_api_enabled

URL = "https://www.kamis.or.kr/service/price/xml.do"
TIMEOUT = 5.0
CACHE_SEC = 3600
_cache: tuple[float, dict] | None = None


def _mock() -> dict:
    with open(DATA_DIR / "prices_mock.json", encoding="utf-8") as f:
        items = json.load(f)["items"]
    return {k: {**v, "source": "mock"} for k, v in items.items()}


def _num(s) -> int | None:
    try:
        v = int(str(s).replace(",", "").strip())
        return v if v > 0 else None
    except (TypeError, ValueError):
        return None


def _fetch_kamis() -> list[dict]:
    r = httpx.get(URL, params={
        "action": "dailySalesList",
        "p_cert_key": KAMIS_CERT_KEY,
        "p_cert_id": KAMIS_CERT_ID,
        "p_returntype": "json",
    }, timeout=TIMEOUT)
    r.raise_for_status()
    data = r.json()
    rows = data.get("price", [])
    return [row for row in rows if str(row.get("product_cls_code")) == "01"]  # 소매


def get_prices() -> tuple[dict, str]:
    """{품목명: {unit, price, normal, source}}, 전체 출처"""
    global _cache
    prices = _mock()
    if not price_api_enabled():
        return prices, "mock"
    if _cache and time.time() - _cache[0] < CACHE_SEC:
        return _cache[1], "kamis"
    try:
        rows = _fetch_kamis()
    except Exception:
        return prices, "mock"
    for name, item in prices.items():
        key = item.get("kamis_name", name)
        row = next((r for r in rows if str(r.get("item_name", "")).startswith(key)), None)
        if not row:
            continue
        today = _num(row.get("dpr1"))
        past = [p for p in (_num(row.get("dpr3")), _num(row.get("dpr4"))) if p]
        if today and past:
            item.update(price=today, normal=round(sum(past) / len(past)),
                        unit=row.get("unit") or item["unit"], source="kamis")
    _cache = (time.time(), prices)
    return prices, "kamis"
