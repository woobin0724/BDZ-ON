import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { TopBar } from '../components/ui'
import AlertLog from '../dashboard/AlertLog'
import ElderDetail from '../dashboard/ElderDetail'
import ElderMap from '../dashboard/ElderMap'
import RiskList from '../dashboard/RiskList'
import { api } from '../lib/api'
import { LEVEL } from '../lib/format'
import { useLive } from '../lib/live'

function Stat({ label, value, tone }) {
  const color = tone ? LEVEL[tone].ink : 'var(--color-ink)'
  return (
    <div className="rounded-2xl border border-line bg-surface px-5 py-3">
      <div className="text-sm text-ink-2">{tone && <span style={{ color: LEVEL[tone].color }}>{LEVEL[tone].icon} </span>}{label}</div>
      <div className="mt-0.5 text-3xl font-extrabold tabular-nums" style={{ color }}>{value}</div>
    </div>
  )
}

function RedAlertBanner({ elders }) {
  const reds = elders?.filter((e) => e.checkin?.stage === 3) ?? []
  if (!reds.length) return null
  return (
    <div className="space-y-2">
      {reds.map((e) => (
        <div key={e.id} role="alert" className="flex flex-wrap items-center gap-3 rounded-2xl bg-danger px-5 py-3 text-white">
          <span className="rounded-md bg-white px-2 py-0.5 text-sm font-extrabold text-danger">적색 경보</span>
          <span className="text-lg font-bold">{e.name} 어르신 ({e.age}세 · {e.district})</span>
          <span className="opacity-95">1차 푸시·2차 음성 알림에 응답이 없습니다 — {e.checkin.reason}</span>
          <span className="ml-auto text-sm opacity-90">보호자 {e.guardian_name} {e.guardian_phone}</span>
          <button
            onClick={() => api.post(`/checkins/${e.checkin.id}/ack`)}
            className="rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-danger hover:bg-danger-soft"
          >
            확인 처리
          </button>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [params, setParams] = useSearchParams()
  const { data: elders } = useLive('/elders')
  const { data: summary } = useLive('/dashboard/summary')
  const { data: meta } = useLive('/meta')
  const [selectedId, setSelectedId] = useState(() => Number(params.get('id')) || null)

  // 처음에는 가장 위험한 가구를 선택
  useEffect(() => {
    if (!selectedId && elders?.length) setSelectedId(elders[0].id)
  }, [elders, selectedId])

  const select = (id) => {
    setSelectedId(id)
    setParams((p) => { p.set('id', id); return p }, { replace: true })
  }
  const selected = elders?.find((e) => e.id === selectedId)

  return (
    <div className="min-h-full">
      <TopBar title="복지사 대시보드" />
      <main className="mx-auto max-w-[1600px] space-y-4 p-5">
        <RedAlertBanner elders={elders} />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Stat label="관리 가구" value={summary?.total ?? '-'} />
          <Stat label="위험" value={summary?.count.danger ?? '-'} tone="danger" />
          <Stat label="주의" value={summary?.count.caution ?? '-'} tone="caution" />
          <Stat label="안전" value={summary?.count.safe ?? '-'} tone="safe" />
          <Stat label="안부 확인 진행 중" value={summary ? `${summary.active_checkins}건` : '-'} />
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <ElderMap elders={elders} selectedId={selectedId} onSelect={select} />
          </div>
          <div className="lg:col-span-5">
            <RiskList elders={elders} selectedId={selectedId} onSelect={select} />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <ElderDetail elder={selected} weatherMode={meta?.weather_mode} />
          </div>
          <div className="lg:col-span-5">
            <AlertLog selected={selected} height={660} />
          </div>
        </div>

        <p className="text-xs text-ink-3">※ 모든 인적 정보와 전력 데이터는 시연용 가짜 데이터입니다.</p>
      </main>
    </div>
  )
}
