import { LevelBadge } from '../components/ui'
import { LEVEL } from '../lib/format'
import CheckinChip from './CheckinChip'

/** 위험도 순 가구 목록 (판단 근거 문장 포함) */
export default function RiskList({ elders, selectedId, onSelect, height = 460 }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface" style={{ height }}>
      <div className="flex items-baseline justify-between border-b border-line px-4 py-3">
        <h2 className="font-bold">위험 가구 목록</h2>
        <span className="text-xs text-ink-3">위험도 순 · 클릭하면 상세 보기</span>
      </div>
      <ol className="flex-1 divide-y divide-line overflow-y-auto">
        {elders?.map((e, i) => {
          const level = e.risk?.level ?? 'safe'
          const sel = e.id === selectedId
          return (
            <li key={e.id}>
              <button
                onClick={() => onSelect(e.id)}
                className={`flex w-full gap-3 px-4 py-3 text-left transition-colors ${sel ? 'bg-brand-wash' : 'hover:bg-canvas'}`}
                style={{ boxShadow: `inset 4px 0 0 ${level === 'safe' ? 'transparent' : LEVEL[level].color}` }}
              >
                <span className="w-5 pt-0.5 text-sm font-semibold text-ink-3 tabular-nums">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <LevelBadge level={level} />
                    <span className="font-bold">{e.name}</span>
                    <span className="text-sm text-ink-2">
                      {e.age}세 · {e.lives_alone ? '독거' : '동거'} · {e.district}
                    </span>
                    <span className="ml-auto text-xs text-ink-3 tabular-nums">점수 {e.risk?.score ?? '-'}</span>
                  </div>
                  <p className={`mt-1 text-sm leading-snug ${level === 'safe' ? 'text-ink-3' : 'text-ink'}`}>
                    {e.risk?.reasons?.[0]}
                  </p>
                  {(e.checkin || e.risk?.welfare_target) && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <CheckinChip checkin={e.checkin} />
                      {e.risk?.welfare_target && (
                        <span className="rounded-full bg-[#eef3e6] px-2.5 py-0.5 text-xs font-semibold text-[#4d6b1f]">
                          에너지 복지 안내 대상
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
