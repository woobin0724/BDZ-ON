import { Card, LevelBadge } from '../components/ui'
import { api } from '../lib/api'
import { useLive } from '../lib/live'
import CheckinChip from './CheckinChip'
import UsageChart from './UsageChart'

function Info({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  )
}

/** 선택한 가구 상세: 판단 근거 + 최근 7일 전력·기온 */
export default function ElderDetail({ elder, weatherMode }) {
  const { data: series } = useLive(elder ? `/elders/${elder.id}/timeseries` : null)
  if (!elder) {
    return <Card className="flex h-full items-center justify-center p-10 text-ink-3">지도나 목록에서 가구를 선택하세요.</Card>
  }
  const r = elder.risk
  const f = r?.flags ?? {}

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <LevelBadge level={r?.level} size="lg" />
        <h2 className="text-xl font-bold">{elder.name} 어르신</h2>
        <span className="text-ink-2">{elder.age}세 · {elder.gender} · {elder.lives_alone ? '독거' : '동거'}</span>
        <div className="ml-auto flex items-center gap-2">
          <CheckinChip checkin={elder.checkin} />
          {elder.checkin && (
            <button
              onClick={() => api.post(`/checkins/${elder.checkin.id}/ack`)}
              className="rounded-lg bg-brand px-3 py-1.5 text-sm font-bold text-white hover:bg-brand-dark"
            >
              안부 확인 완료 처리
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 rounded-xl bg-canvas p-4">
        <h3 className="text-sm font-bold text-ink-2">판단 근거</h3>
        <ul className="mt-1.5 space-y-1">
          {r?.reasons?.map((t) => (
            <li key={t} className="flex gap-2 leading-snug">
              <span className="text-brand">•</span>{t}
            </li>
          ))}
        </ul>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-ink-2 tabular-nums">
          <span>최근 3일 하루 평균 <b className="text-ink">{f.daily_avg_kwh} kWh</b>{f.low_usage && ' (저사용)'}</span>
          {f.hvac_ratio != null && <span>특보 중 냉·난방 시간대 사용량 <b className="text-ink">평소의 {Math.round(f.hvac_ratio * 100)}%</b></span>}
          <span>생활 전력 무변화 <b className="text-ink">{f.flat_hours}시간</b></span>
        </div>
      </div>

      <div className="mt-4">
        <h3 className="mb-2 font-bold">최근 7일 전력 사용량과 기온</h3>
        <UsageChart data={series} weatherMode={weatherMode} />
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 text-sm md:grid-cols-4">
        <Info label="주소">{elder.address}</Info>
        <Info label="연락처">{elder.phone}</Info>
        <Info label="보호자">{elder.guardian_name}<br />{elder.guardian_phone}</Info>
        <Info label="담당">{elder.social_worker}</Info>
      </dl>
    </Card>
  )
}
