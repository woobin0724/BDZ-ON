import { Link, useSearchParams } from 'react-router-dom'
import { CheckinActions, DemoModeToggle, ResetButtons, ScenarioButtons, WeatherButtons } from '../components/controls'
import { Logo } from '../components/ui'
import { useLive } from '../lib/live'

/**
 * 분할 시연 화면: 위쪽 조작 막대 + 왼쪽 어르신 앱 + 오른쪽 복지사 대시보드.
 * 심사장 화면 하나로 '버튼 → 위험도 재계산 → 앱·대시보드 동시 반영' 을 보여주기 위한 화면.
 */
export default function SplitView() {
  const [params, setParams] = useSearchParams()
  const id = Number(params.get('id')) || 1
  const { data: meta } = useLive('/meta')
  const { data: elders } = useLive('/elders')
  const elder = elders?.find((e) => e.id === id)

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line bg-surface px-4 py-2.5">
        <Link to="/demo"><Logo small /></Link>
        <div className="w-[260px]"><WeatherButtons meta={meta} size="sm" /></div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          시연 가구
          <select value={id} onChange={(e) => setParams({ id: e.target.value })}
                  className="rounded-lg border border-line-strong bg-surface px-2 py-1">
            {elders?.slice().sort((a, b) => a.id - b.id).map((e) => (
              <option key={e.id} value={e.id}>{e.id}. {e.name} ({e.age}세)</option>
            ))}
          </select>
        </label>
        {elder && <ScenarioButtons elder={elder} size="sm" />}
        {elder && <CheckinActions elder={elder} compact />}
        <div className="ml-auto flex items-center gap-2">
          <DemoModeToggle meta={meta} compact />
          <ResetButtons compact />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-4 bg-[#efe6da] p-4">
        <div className="flex shrink-0 flex-col items-center">
          <div className="mb-2 text-sm font-bold text-ink-2">A. 어르신 앱</div>
          <div className="min-h-0 flex-1">
            <div className="h-full max-h-[844px] w-[390px] overflow-hidden rounded-[40px] border-[9px] border-[#2b2118] bg-canvas shadow-lg">
              <iframe key={id} title="어르신 앱" src={`/app?id=${id}&frame=0`} className="h-full w-full" />
            </div>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-2 text-sm font-bold text-ink-2">B. 복지사 대시보드</div>
          <iframe key={`d${id}`} title="복지사 대시보드" src={`/dashboard?id=${id}`}
                  className="min-h-0 flex-1 rounded-2xl border border-line bg-canvas" />
        </div>
      </div>
    </div>
  )
}
