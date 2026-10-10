import { useState } from 'react'
import { dateTime } from '../lib/format'
import { useLive } from '../lib/live'

const KIND_STYLE = {
  push: 'bg-brand-wash text-brand-dark',
  voice: 'bg-brand-soft text-brand-dark',
  red: 'bg-danger text-white',
  response: 'bg-safe-soft text-safe',
  ack: 'bg-[#e8eef6] text-[#2f5276]',
  cleared: 'bg-canvas text-ink-2',
}
const STATUS_STYLE = {
  active: 'text-danger font-bold',
  responded: 'text-safe font-semibold',
  acknowledged: 'text-[#2f5276] font-semibold',
  cleared: 'text-ink-3',
}

/** 알림 로그 (1차/2차/적색 경보, 응답 여부, 시각) */
export default function AlertLog({ selected, height = 420 }) {
  const [onlySelected, setOnlySelected] = useState(false)
  const path = onlySelected && selected ? `/alerts?limit=80&elder_id=${selected.id}` : '/alerts?limit=80'
  const { data: logs } = useLive(path)

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface" style={{ height }}>
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="font-bold">알림 로그</h2>
        <div className="flex overflow-hidden rounded-lg border border-line text-xs font-semibold">
          <button onClick={() => setOnlySelected(false)} className={`px-2.5 py-1 ${!onlySelected ? 'bg-brand text-white' : 'text-ink-2'}`}>전체</button>
          <button onClick={() => setOnlySelected(true)} disabled={!selected}
                  className={`px-2.5 py-1 ${onlySelected ? 'bg-brand text-white' : 'text-ink-2'}`}>
            {selected ? `${selected.name} 님만` : '선택 가구'}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-surface text-left text-xs text-ink-3">
            <tr className="border-b border-line">
              <th className="px-4 py-2 font-semibold">시각</th>
              <th className="py-2 pr-3 font-semibold">어르신</th>
              <th className="py-2 pr-3 font-semibold">단계</th>
              <th className="py-2 font-semibold">내용</th>
              <th className="py-2 pr-4 font-semibold">응답 여부</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {logs?.map((l) => (
              <tr key={l.id} className={l.kind === 'red' && l.checkin_status === 'active' ? 'bg-danger-soft' : ''}>
                <td className="whitespace-nowrap px-4 py-2 tabular-nums text-ink-2">{dateTime(l.created_at)}</td>
                <td className="whitespace-nowrap py-2 pr-3 font-semibold">{l.elder_name}</td>
                <td className="whitespace-nowrap py-2 pr-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${KIND_STYLE[l.kind]}`}>{l.kind_label}</span>
                </td>
                <td className="py-2 pr-2 leading-snug text-ink-2">{l.message}</td>
                <td className={`whitespace-nowrap py-2 pr-4 text-xs ${STATUS_STYLE[l.checkin_status] ?? ''}`}>
                  {l.checkin_status_label ?? '-'}
                </td>
              </tr>
            ))}
            {logs?.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-ink-3">알림 기록이 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
