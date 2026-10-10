"""온잇다 백엔드 진입점.

실행: (backend 폴더에서) python -m uvicorn app.main:app --port 8000
"""
from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles

from .config import FRONTEND_DIST, SERVICE_NAME
from .db import SessionLocal
from .models import Elder
from .routers import demo, elder_app, elders
from .seed.seeder import apply_preset, create_tables, seed_elders
from .services import checkin, events
from .services.assess import recompute_all
from .services.state import bump_version

TICK_SEC = 1.0


def _startup() -> None:
    create_tables()
    with SessionLocal() as db:
        first_run = db.query(Elder).count() == 0
        seed_elders(db)
        if first_run:
            apply_preset(db, "mixed")
        # 기준 시각을 지금으로 맞춰 7일치 데이터를 다시 만들고 위험도를 계산
        recompute_all(db, reason="startup")


async def _escalation_loop() -> None:
    """안부 확인 단계 진행 타이머 (1초마다 확인)."""
    while True:
        await asyncio.sleep(TICK_SEC)
        try:
            with SessionLocal() as db:
                if checkin.tick(db):
                    events.publish("refresh", reason="escalation", version=bump_version(db))
        except Exception as exc:  # 시연 중 타이머가 멈추지 않도록
            print(f"[escalation] {exc}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    events.bind_loop(asyncio.get_running_loop())
    _startup()
    task = asyncio.create_task(_escalation_loop())
    yield
    task.cancel()


app = FastAPI(title=f"{SERVICE_NAME} API", version="0.1.0", lifespan=lifespan,
              description="기후·에너지 취약 고령층 케어 플랫폼 (공모전 시연용 MVP). 모든 인적 정보는 가짜 데이터입니다.")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
app.include_router(elders.router)
app.include_router(elder_app.router)
app.include_router(demo.router)


@app.get("/api/health", tags=["시스템"])
def health():
    return {"ok": True, "service": SERVICE_NAME}


@app.get("/api/events", tags=["시스템"], summary="실시간 갱신 이벤트 (SSE)")
async def sse(request: Request):
    q = events.subscribe()

    async def stream():
        try:
            yield "retry: 2000\n\n"
            yield 'data: {"type": "hello"}\n\n'
            while True:
                if await request.is_disconnected():
                    break
                try:
                    payload = await asyncio.wait_for(q.get(), timeout=15)
                    yield f"data: {payload}\n\n"
                except asyncio.TimeoutError:
                    yield ": keep-alive\n\n"
        finally:
            events.unsubscribe(q)

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


# 빌드된 프론트엔드가 있으면 같은 포트에서 함께 제공 (npm run demo)
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        file = FRONTEND_DIST / path
        if path and file.is_file():
            return FileResponse(file)
        return FileResponse(FRONTEND_DIST / "index.html")
