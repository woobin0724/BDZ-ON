"""실시간 반영용 SSE 브로커.

상태가 바뀌면 publish() 로 알리고, 연결된 화면(어르신 앱·대시보드·시연 패널)이
이벤트를 받아 필요한 데이터를 다시 불러온다.
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime

_subscribers: set[asyncio.Queue] = set()
_loop: asyncio.AbstractEventLoop | None = None


def bind_loop(loop: asyncio.AbstractEventLoop) -> None:
    global _loop
    _loop = loop


def subscribe() -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue(maxsize=100)
    _subscribers.add(q)
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    _subscribers.discard(q)


def _put_all(payload: str) -> None:
    for q in list(_subscribers):
        try:
            q.put_nowait(payload)
        except asyncio.QueueFull:
            pass


def publish(kind: str, **data) -> None:
    """어느 스레드에서 호출해도 안전하게 이벤트를 보낸다."""
    payload = json.dumps({"type": kind, "at": datetime.now().isoformat(timespec="seconds"), **data},
                         ensure_ascii=False)
    if _loop is None:
        return
    try:
        running = asyncio.get_running_loop()
    except RuntimeError:
        running = None
    if running is _loop:
        _put_all(payload)
    else:
        _loop.call_soon_threadsafe(_put_all, payload)
