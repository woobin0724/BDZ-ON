// 실시간 반영: 백엔드 SSE(/api/events)를 받아 화면을 다시 불러온다.
// 연결이 끊겨도 10초마다 자동으로 다시 불러오므로 화면이 멈추지 않는다.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { api } from './api'

let version = 0
let connected = false
const listeners = new Set()
let source = null

function emit() { listeners.forEach((l) => l()) }

// 브라우저는 같은 주소로 동시 연결을 6개까지만 허용하므로, 여러 탭·분할 화면이 SSE 연결 1개를 함께 쓴다.
// 한 탭(Web Lock 보유자)만 SSE 를 열고, 받은 이벤트를 BroadcastChannel 로 다른 탭에 전달한다.
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('onitda-live') : null

function onRefresh() { version += 1; emit() }
function setConnected(v) { if (connected !== v) { connected = v; emit() } }

function openSource() {
  source = new EventSource('/api/events')
  source.onopen = () => { setConnected(true); channel?.postMessage({ kind: 'status', connected: true }) }
  source.onmessage = (e) => {
    try {
      const msg = JSON.parse(e.data)
      if (msg.type === 'refresh') { onRefresh(); channel?.postMessage({ kind: 'refresh' }) }
    } catch { /* keep-alive 등 */ }
  }
  source.onerror = () => { setConnected(false); channel?.postMessage({ kind: 'status', connected: false }) }
  setInterval(() => channel?.postMessage({ kind: 'status', connected }), 3000)
}

function ensureSource() {
  if (source) return
  source = 'pending'
  if (channel && navigator.locks) {
    channel.onmessage = (e) => {
      if (e.data?.kind === 'refresh') onRefresh()
      if (e.data?.kind === 'status') setConnected(e.data.connected)
    }
    // 잠금을 얻은 탭이 SSE 담당. 그 탭이 닫히면 다음 탭이 이어받는다.
    navigator.locks.request('onitda-sse', () => new Promise(() => openSource()))
  } else {
    openSource()
  }
}

setInterval(() => { version += 1; emit() }, 10000)

function subscribe(l) {
  ensureSource()
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useLiveVersion() {
  return useSyncExternalStore(subscribe, () => version)
}

export function useLiveConnected() {
  return useSyncExternalStore(subscribe, () => connected)
}

/** path 의 데이터를 불러오고, 서버 상태가 바뀔 때마다 다시 불러온다. */
export function useLive(path) {
  const v = useLiveVersion()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const latest = useRef(path)
  latest.current = path

  const reload = useCallback(() => {
    if (!path) return Promise.resolve()
    return api.get(path)
      .then((d) => { if (latest.current === path) { setData(d); setError(null) } })
      .catch((e) => setError(e))
  }, [path])

  useEffect(() => { reload() }, [reload, v])
  useEffect(() => { setData(null) }, [path])

  return { data, error, reload }
}

/** 1초마다 갱신되는 현재 시각 (카운트다운 표시용) */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}
