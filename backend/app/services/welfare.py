"""③ 에너지 복지 안내.

※ 안내 문구는 placeholder — 공식 정보 확인 후 수정 (data/welfare.json).
"""
from __future__ import annotations

import json

from ..config import DATA_DIR


def programs_for(weather_mode: str, flags: dict) -> dict:
    with open(DATA_DIR / "welfare.json", encoding="utf-8") as f:
        cfg = json.load(f)
    tags = set()
    if weather_mode in ("heatwave", "coldwave"):
        tags.add(weather_mode)
    if flags.get("low_usage"):
        tags.add("low_usage")
    progs = [p for p in cfg["programs"] if tags & set(p["for"])] or cfg["programs"][:2]
    return {
        "programs": [{k: p[k] for k in ("id", "title", "summary", "detail")} for p in progs],
        "contact": cfg["contact"],
    }
