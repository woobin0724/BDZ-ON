import { duration, secondsLeft } from '../lib/format'
import { useNow } from '../lib/live'

/** 진행 중인 안부 확인 단계 표시 (다음 단계까지 남은 시간 포함) */
export default function CheckinChip({ checkin }) {
  const now = useNow()
  if (!checkin) return null
  const left = secondsLeft(checkin.next_at, now)
  if (checkin.stage === 3) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-danger px-2.5 py-0.5 text-xs font-bold text-white">
        ■ 적색 경보 · 복지사 확인 필요
      </span>
    )
  }
  const label = checkin.stage === 1 ? '1차 푸시 · 응답 대기' : '2차 음성 · 응답 대기'
  const next = checkin.stage === 1 ? '2차 음성' : '적색 경보'
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-brand bg-brand-wash px-2.5 py-0.5 text-xs font-semibold text-brand-dark">
      {label}
      {left != null && <span className="text-ink-2">· {duration(left)} 후 {next}</span>}
    </span>
  )
}
