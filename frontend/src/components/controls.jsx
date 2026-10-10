import { useState } from 'react'
import { api } from '../lib/api'

const WEATHERS = [
  { key: 'normal', label: '평상', icon: '☀️', on: 'bg-safe text-white border-safe' },
  { key: 'heatwave', label: '폭염', icon: '🔥', on: 'bg-danger text-white border-danger' },
  { key: 'coldwave', label: '한파', icon: '❄️', on: 'bg-[#1f5fa8] text-white border-[#1f5fa8]' },
]
export const SCENARIOS = [
  { key: 'normal', label: '정상' },
  { key: 'no_hvac', label: '냉·난방 미사용' },
  { key: 'flat', label: '무변화' },
]

/** 버튼 클릭 → API 호출 중 표시 + 오류 알림 */
export function useAction() {
  const [pending, setPending] = useState(null)
  const run = async (key, fn) => {
    setPending(key)
    try { await fn() } catch (e) { alert(e.message) } finally { setPending(null) }
  }
  return [pending, run]
}

export function WeatherButtons({ meta, size = 'lg' }) {
  const [pending, run] = useAction()
  const big = size === 'lg'
  const items = meta?.apis.weather === 'real'
    ? [...WEATHERS, { key: 'auto', label: '실제 기상청', icon: '📡', on: 'bg-ink text-white border-ink' }]
    : WEATHERS
  const current = meta?.weather_override ?? 'auto'
  return (
    <div className={`grid gap-2 ${items.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`}>
      {items.map((w) => {
        const active = current === w.key
        return (
          <button
            key={w.key}
            onClick={() => run(w.key, () => api.post('/demo/weather', { mode: w.key }))}
            disabled={pending != null}
            className={`rounded-xl border-2 font-bold transition-colors ${big ? 'py-4 text-xl' : 'py-1.5 text-sm'} ${
              active ? w.on : 'border-line bg-surface text-ink hover:border-line-strong'
            } ${pending === w.key ? 'opacity-60' : ''}`}
          >
            <span aria-hidden>{w.icon}</span> {w.label}
          </button>
        )
      })}
    </div>
  )
}

export function ScenarioButtons({ elder, size = 'md' }) {
  const [pending, run] = useAction()
  const small = size === 'sm'
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-line-strong">
      {SCENARIOS.map((s) => {
        const active = elder.scenario === s.key
        return (
          <button
            key={s.key}
            onClick={() => !active && run(s.key, () => api.post('/demo/scenario', { elder_id: elder.id, scenario: s.key }))}
            disabled={pending != null}
            className={`whitespace-nowrap border-l border-line-strong first:border-l-0 font-semibold ${small ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'} ${
              active ? 'bg-brand text-white' : 'bg-surface text-ink-2 hover:bg-brand-wash'
            } ${pending === s.key ? 'opacity-60' : ''}`}
          >
            {s.label}
          </button>
        )
      })}
    </div>
  )
}

export function DemoModeToggle({ meta, compact = false }) {
  const [pending, run] = useAction()
  const on = meta?.demo_mode
  return (
    <button
      onClick={() => run('mode', () => api.post('/demo/demo-mode', { enabled: !on }))}
      disabled={pending != null || !meta}
      className={`inline-flex items-center gap-2 rounded-xl border-2 font-bold ${compact ? 'px-2.5 py-1 text-sm' : 'px-4 py-2.5'} ${
        on ? 'border-brand bg-brand-wash text-brand-dark' : 'border-line bg-surface text-ink-2'
      }`}
    >
      <span className={`relative inline-block h-5 w-9 rounded-full transition-colors ${on ? 'bg-brand' : 'bg-line-strong'}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? 'left-[18px]' : 'left-0.5'}`} />
      </span>
      시연 모드 {on ? `ON · ${meta.timings.to_voice_sec}초 단위` : `OFF · ${Math.round((meta?.timings.to_voice_sec ?? 0) / 60)}분 단위`}
    </button>
  )
}

export function ResetButtons({ compact = false }) {
  const [pending, run] = useAction()
  const cls = compact ? 'px-2.5 py-1 text-sm' : 'px-4 py-2.5'
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => run('all', () => api.post('/demo/reset', { preset: 'all_normal' }))}
        disabled={pending != null}
        className={`rounded-xl border-2 border-line bg-surface font-bold hover:border-line-strong ${cls}`}
      >
        ↺ 전 가구 정상으로 초기화
      </button>
      <button
        onClick={() => run('mixed', () => api.post('/demo/reset', { preset: 'mixed' }))}
        disabled={pending != null}
        className={`rounded-xl border-2 border-line bg-surface font-bold hover:border-line-strong ${cls}`}
      >
        ↺ 시연용 혼합 상태로 초기화
      </button>
    </div>
  )
}

/** 안부 확인 시작 / 다음 단계 / 대신 응답 / 복지사 확인 */
export function CheckinActions({ elder, compact = false }) {
  const [pending, run] = useAction()
  const c = elder.checkin
  const cls = `rounded-lg border font-semibold disabled:opacity-40 ${compact ? 'px-2 py-1 text-xs' : 'px-2.5 py-1.5 text-sm'}`
  if (!c) {
    return (
      <button className={`${cls} border-line-strong bg-surface hover:bg-brand-wash`} disabled={pending != null}
              onClick={() => run('start', () => api.post(`/demo/checkin/${elder.id}`))}>
        🔔 안부 확인 시작
      </button>
    )
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      <button className={`${cls} border-line-strong bg-surface hover:bg-brand-wash`} disabled={pending != null || c.stage >= 3}
              onClick={() => run('adv', () => api.post(`/demo/checkin/${c.id}/advance`))}>
        ⏭ 다음 단계
      </button>
      <button className={`${cls} border-safe/50 bg-safe-soft text-safe`} disabled={pending != null}
              onClick={() => run('resp', () => api.post(`/app/${elder.id}/respond`))}>
        👍 괜찮아요 (대신 응답)
      </button>
      <button className={`${cls} border-[#2f5276]/40 bg-[#e8eef6] text-[#2f5276]`} disabled={pending != null}
              onClick={() => run('ack', () => api.post(`/checkins/${c.id}/ack`))}>
        ✔ 복지사 확인
      </button>
    </div>
  )
}
