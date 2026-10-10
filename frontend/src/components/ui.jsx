import { Link } from 'react-router-dom'
import { LEVEL } from '../lib/format'
import { useLive, useLiveConnected } from '../lib/live'

/** 위험도 배지: 색 + 모양 + 글자 (색만으로 구분하지 않음) */
export function LevelBadge({ level, size = 'md' }) {
  const lv = LEVEL[level] ?? LEVEL.safe
  const cls = size === 'lg' ? 'text-base px-3 py-1' : 'text-xs px-2 py-0.5'
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-bold ${cls}`}
      style={{ background: lv.soft, color: lv.ink }}
    >
      <span aria-hidden style={{ color: lv.color }}>{lv.icon}</span>
      {lv.label}
    </span>
  )
}

export function Card({ className = '', children, ...rest }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface ${className}`} {...rest}>
      {children}
    </section>
  )
}

export function Logo({ small = false }) {
  return (
    <span className="inline-flex items-center gap-2">
      <img src="/favicon.svg" alt="" className={small ? 'h-7 w-7' : 'h-9 w-9'} />
      <span className={`font-extrabold tracking-tight text-brand-dark ${small ? 'text-lg' : 'text-2xl'}`}>온잇다</span>
    </span>
  )
}

/** 상단 공통 바: 로고, 화면 이름, 현재 기상 상태, 연결 상태 */
export function TopBar({ title, children }) {
  const { data: meta } = useLive('/meta')
  const connected = useLiveConnected()
  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-5 py-3">
      <Link to="/" className="shrink-0"><Logo small /></Link>
      <span className="text-ink-3">|</span>
      <h1 className="text-lg font-bold">{title}</h1>
      <div className="ml-auto flex flex-wrap items-center gap-2 text-sm">
        {children}
        {meta && <WeatherChip meta={meta} />}
        {meta?.demo_mode && (
          <span className="rounded-full bg-brand-soft px-2.5 py-1 font-semibold text-brand-dark">
            시연 모드 · {meta.timings.to_voice_sec}초 단위
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 text-ink-3" title="실시간 연결 상태">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-safe' : 'bg-line-strong'}`} />
          {connected ? '실시간 연결' : '연결 중…'}
        </span>
      </div>
    </header>
  )
}

export function WeatherChip({ meta }) {
  const style = {
    normal: 'bg-safe-soft text-safe',
    heatwave: 'bg-danger-soft text-danger',
    coldwave: 'bg-[#e3eefb] text-[#1f5fa8]',
  }[meta.weather_mode]
  const icon = { normal: '☀️', heatwave: '🔥', coldwave: '❄️' }[meta.weather_mode]
  return (
    <span className={`rounded-full px-2.5 py-1 font-semibold ${style}`}>
      {icon} 기상: {meta.weather_label}
      {meta.weather_mode !== 'normal' && ' 특보'}
    </span>
  )
}
