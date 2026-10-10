"""환경설정 로드 (.env + risk_rules.yaml).

- .env 에 API 키가 있으면 실제 API 를 호출하고, 없으면 mock 데이터로 동작한다.
- 위험도 규칙과 임계값은 risk_rules.yaml 한 곳에서 관리한다.
"""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

import yaml
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
ROOT_DIR = BACKEND_DIR.parent
APP_DIR = Path(__file__).resolve().parent
DATA_DIR = APP_DIR / "data"
SEED_DIR = APP_DIR / "seed"
RULES_PATH = APP_DIR / "risk_rules.yaml"
FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"

load_dotenv(ROOT_DIR / ".env")

SERVICE_NAME = "온잇다"
SERVICE_SUBTITLE = "기후·에너지 취약 어르신 안심 케어"

DB_PATH = Path(os.getenv("ONITDA_DB", str(BACKEND_DIR / "onitda.db")))

KMA_API_KEY = os.getenv("KMA_API_KEY", "").strip()
KAMIS_CERT_KEY = os.getenv("KAMIS_CERT_KEY", "").strip()
KAMIS_CERT_ID = os.getenv("KAMIS_CERT_ID", "").strip()

DEMO_MODE_DEFAULT = os.getenv("DEMO_MODE", "true").strip().lower() in ("1", "true", "yes", "on")


def weather_api_enabled() -> bool:
    return bool(KMA_API_KEY)


def price_api_enabled() -> bool:
    return bool(KAMIS_CERT_KEY and KAMIS_CERT_ID)


@lru_cache(maxsize=1)
def _load_rules_cached(mtime: float) -> dict:
    with open(RULES_PATH, encoding="utf-8") as f:
        return yaml.safe_load(f)


def rules() -> dict:
    """risk_rules.yaml 을 읽는다. 파일을 수정하면 서버 재시작 없이 다음 계산부터 반영된다."""
    return _load_rules_cached(RULES_PATH.stat().st_mtime)
