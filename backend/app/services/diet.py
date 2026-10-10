"""④ 계절 식단: 날씨·계절 기반 추천 + 비쌀 때 대체 식재료."""
from __future__ import annotations

import json
from datetime import datetime

from ..config import DATA_DIR
from .prices import get_prices


def season_of(month: int) -> str:
    if month in (3, 4, 5):
        return "spring"
    if month in (6, 7, 8):
        return "summer"
    if month in (9, 10, 11):
        return "autumn"
    return "winter"


def _price_info(name: str, prices: dict, ratio: float) -> dict:
    p = prices.get(name)
    if not p:
        return {"price": None, "normal": None, "unit": None, "expensive": False, "change_pct": None}
    change = round((p["price"] / p["normal"] - 1) * 100) if p["normal"] else None
    return {
        "price": p["price"],
        "normal": p["normal"],
        "unit": p["unit"],
        "source": p.get("source", "mock"),
        "change_pct": change,
        "expensive": bool(p["normal"] and p["price"] >= p["normal"] * ratio),
    }


def recommend(weather_mode: str, when: datetime | None = None) -> dict:
    with open(DATA_DIR / "diet.json", encoding="utf-8") as f:
        cfg = json.load(f)
    when = when or datetime.now()
    key = weather_mode if weather_mode in ("heatwave", "coldwave") else season_of(when.month)
    menu = cfg["menus"][key]
    ratio = cfg["expensive_ratio"]
    prices, source = get_prices()

    items = []
    for ing in menu["ingredients"]:
        info = _price_info(ing["name"], prices, ratio)
        alt = None
        if info["expensive"] and ing.get("alt"):
            alt = {**ing["alt"], **_price_info(ing["alt"]["name"], prices, ratio)}
        items.append({"name": ing["name"], "benefit": ing["benefit"], **info, "alternative": alt})

    return {
        "key": key,
        "label": menu["label"],
        "menu": menu["menu"],
        "tip": menu["tip"],
        "ingredients": items,
        "price_source": source,
    }
