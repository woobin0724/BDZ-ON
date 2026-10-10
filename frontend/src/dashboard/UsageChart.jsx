import { useMemo, useState } from 'react'
import {
  Area, CartesianGrid, ComposedChart, Line, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

// 색약 검증 통과 팔레트 (전력 = 주황, 기온 = 파랑)
const POWER = '#C65A1E'
const TEMP = '#2F6DB5'
const GRID = '#efe6da'
const AXIS = '#85725f'
const ALERT_HOURS = 72
const ALERT_FILL = { heatwave: '#fde4e2', coldwave: '#e3eefb' }
const ALERT_LABEL = { heatwave: '폭염 특보 기간', coldwave: '한파 특보 기간' }

const fmtTick = (ts) => {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
const fmtFull = (ts) => {
  const d = new Date(ts)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, '0')}시`
}

function HoverCard({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-sm">
      <div className="font-semibold">{fmtFull(row.ts)}</div>
      <div className="mt-1 flex items-center gap-2">
        <span className="inline-block h-0.5 w-3" style={{ background: POWER }} />
        전력 <b className="tabular-nums">{row.kwh.toFixed(2)} kWh</b>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-0.5 w-3" style={{ background: TEMP }} />
        기온 <b className="tabular-nums">{row.temp?.toFixed(1)} ℃</b>
      </div>
    </div>
  )
}

/**
 * 최근 7일 1시간 단위 전력 사용량과 기온.
 * 단위가 다른 두 값을 한 축에 억지로 겹치지 않고, 같은 시간축을 공유하는 두 차트를 위아래로 붙였다.
 * 마우스를 올리면 두 차트에 같은 시각이 함께 표시된다.
 */
export default function UsageChart({ data, weatherMode }) {
  const [table, setTable] = useState(false)

  const ticks = useMemo(() => data?.filter((d) => new Date(d.ts).getHours() === 0).map((d) => d.ts) ?? [], [data])
  const alertRange = data && weatherMode !== 'normal' && data.length > ALERT_HOURS
    ? [data[data.length - ALERT_HOURS].ts, data[data.length - 1].ts] : null

  const daily = useMemo(() => {
    if (!data) return []
    const map = new Map()
    data.forEach((d) => {
      const key = fmtTick(d.ts)
      const r = map.get(key) ?? { day: key, kwh: 0, hi: -99, lo: 99, n: 0 }
      r.kwh += d.kwh; r.hi = Math.max(r.hi, d.temp); r.lo = Math.min(r.lo, d.temp); r.n += 1
      map.set(key, r)
    })
    return [...map.values()]
  }, [data])

  if (!data) return <div className="flex h-[360px] items-center justify-center text-ink-3">불러오는 중…</div>

  const xAxis = (show) => (
    <XAxis
      dataKey="ts" ticks={ticks} tickFormatter={fmtTick} hide={!show}
      tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={{ stroke: GRID }}
    />
  )
  const area = (y) => alertRange && (
    <ReferenceArea
      x1={alertRange[0]} x2={alertRange[1]} fill={ALERT_FILL[weatherMode]} fillOpacity={0.7} ifOverflow="hidden"
      label={y ? { value: ALERT_LABEL[weatherMode], position: 'insideTopLeft', fill: '#5a4a3c', fontSize: 12 } : undefined}
    />
  )

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-ink-2">
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-4" style={{ background: TEMP }} />기온 (℃)</span>
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-0.5 w-4" style={{ background: POWER }} />전력 사용량 (kWh/시간)</span>
        </div>
        <button onClick={() => setTable((t) => !t)} className="rounded-lg border border-line px-2.5 py-1 text-xs font-semibold text-ink-2 hover:bg-canvas">
          {table ? '차트로 보기' : '표로 보기'}
        </button>
      </div>

      {table ? (
        <table className="w-full text-sm tabular-nums">
          <thead className="text-left text-ink-3">
            <tr><th className="py-1.5 font-semibold">날짜</th><th className="font-semibold">하루 사용량</th><th className="font-semibold">최고 기온</th><th className="font-semibold">최저 기온</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {daily.map((d) => (
              <tr key={d.day}>
                <td className="py-1.5">{d.day}{d.n < 24 && <span className="text-ink-3"> ({d.n}시간)</span>}</td>
                <td>{d.kwh.toFixed(2)} kWh</td><td>{d.hi.toFixed(1)} ℃</td><td>{d.lo.toFixed(1)} ℃</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div>
          <ResponsiveContainer width="100%" height={110}>
            <ComposedChart data={data} syncId="usage" margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              {area(true)}
              {xAxis(false)}
              <YAxis width={44} tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={false}
                     domain={['dataMin - 2', 'dataMax + 2']} tickFormatter={(v) => `${Math.round(v)}℃`} tickCount={3} />
              <Tooltip content={<HoverCard />} cursor={{ stroke: AXIS, strokeWidth: 1 }} />
              <Line dataKey="temp" stroke={TEMP} strokeWidth={2} dot={false} isAnimationActive={false}
                    activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
          <ResponsiveContainer width="100%" height={210}>
            <ComposedChart data={data} syncId="usage" margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID} />
              {area(false)}
              {xAxis(true)}
              <YAxis width={44} tick={{ fill: AXIS, fontSize: 12 }} tickLine={false} axisLine={false}
                     domain={[0, (max) => Math.max(0.6, Math.ceil(max * 5) / 5)]} tickFormatter={(v) => v.toFixed(1)} />
              <Tooltip content={<HoverCard />} cursor={{ stroke: AXIS, strokeWidth: 1 }} />
              <Area dataKey="kwh" stroke={POWER} strokeWidth={2} fill={POWER} fillOpacity={0.1} dot={false}
                    isAnimationActive={false} activeDot={{ r: 4, stroke: '#fff', strokeWidth: 2 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
