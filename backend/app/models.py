"""DB 모델. 모든 인적 정보는 시연용 가짜 데이터다."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Elder(Base):
    __tablename__ = "elders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(20))
    age: Mapped[int] = mapped_column(Integer)
    gender: Mapped[str] = mapped_column(String(4))
    lives_alone: Mapped[bool] = mapped_column(Boolean)
    district: Mapped[str] = mapped_column(String(40))  # 시·군
    address: Mapped[str] = mapped_column(String(120))
    lat: Mapped[float] = mapped_column(Float)
    lng: Mapped[float] = mapped_column(Float)
    phone: Mapped[str] = mapped_column(String(20))
    guardian_name: Mapped[str] = mapped_column(String(30))
    guardian_phone: Mapped[str] = mapped_column(String(20))
    social_worker: Mapped[str] = mapped_column(String(30))
    # 전력 시나리오: normal(정상) / no_hvac(냉·난방 미사용) / flat(생활 전력 무변화)
    scenario: Mapped[str] = mapped_column(String(20), default="normal")
    # 가구 소비 성향 (생성기에서 사용, 1.0 = 평균)
    usage_scale: Mapped[float] = mapped_column(Float, default=1.0)


class PowerReading(Base):
    """가상 AMI 1시간 단위 전력 사용량."""

    __tablename__ = "power_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    elder_id: Mapped[int] = mapped_column(ForeignKey("elders.id"), index=True)
    ts: Mapped[datetime] = mapped_column(DateTime, index=True)
    kwh: Mapped[float] = mapped_column(Float)


class WeatherHourly(Base):
    """가상(또는 실측 보정) 1시간 단위 기온."""

    __tablename__ = "weather_hourly"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    ts: Mapped[datetime] = mapped_column(DateTime, unique=True, index=True)
    temp: Mapped[float] = mapped_column(Float)


class RiskAssessment(Base):
    """가구별 최신 위험도 판정 결과 (가구당 1행)."""

    __tablename__ = "risk_assessments"

    elder_id: Mapped[int] = mapped_column(ForeignKey("elders.id"), primary_key=True)
    level: Mapped[str] = mapped_column(String(10))  # safe / caution / danger
    score: Mapped[int] = mapped_column(Integer)
    reasons: Mapped[list] = mapped_column(JSON)  # 복지사용 판단 근거 문장
    elder_message: Mapped[str] = mapped_column(String(300))  # 어르신용 쉬운 안내 문장
    flags: Mapped[dict] = mapped_column(JSON)  # 규칙별 판정 상세
    welfare_target: Mapped[bool] = mapped_column(Boolean, default=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime)


class Checkin(Base):
    """안부 확인 1건 (1차 푸시 → 2차 음성 → 적색 경보)."""

    __tablename__ = "checkins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    elder_id: Mapped[int] = mapped_column(ForeignKey("elders.id"), index=True)
    level: Mapped[str] = mapped_column(String(10))
    reason: Mapped[str] = mapped_column(String(300))
    message: Mapped[str] = mapped_column(String(400))  # 어르신에게 보여주고 읽어줄 문구
    stage: Mapped[int] = mapped_column(Integer, default=1)  # 1=푸시, 2=음성, 3=적색 경보
    # active(진행 중) / responded(어르신 응답) / acknowledged(복지사 확인) / cleared(상태 정상화로 자동 해제)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime)
    next_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class AlertLog(Base):
    __tablename__ = "alert_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    checkin_id: Mapped[int | None] = mapped_column(ForeignKey("checkins.id"), nullable=True, index=True)
    elder_id: Mapped[int] = mapped_column(ForeignKey("elders.id"), index=True)
    # push(1차) / voice(2차) / red(적색 경보) / response(응답) / ack(복지사 확인) / cleared(자동 해제)
    kind: Mapped[str] = mapped_column(String(20))
    message: Mapped[str] = mapped_column(String(400))
    created_at: Mapped[datetime] = mapped_column(DateTime, index=True)


class SystemState(Base):
    """시연 상태 (단일 행)."""

    __tablename__ = "system_state"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    # 시연 패널에서 지정한 기상 상태. None 이면 실제 API(키가 있을 때) 결과를 사용
    weather_override: Mapped[str | None] = mapped_column(String(20), nullable=True, default="normal")
    demo_mode: Mapped[bool] = mapped_column(Boolean, default=True)
    base_time: Mapped[datetime] = mapped_column(DateTime)  # 가상 데이터의 '현재' 시각
    version: Mapped[int] = mapped_column(Integer, default=0)
