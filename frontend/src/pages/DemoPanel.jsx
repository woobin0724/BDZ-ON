import { Link } from 'react-router-dom'
import { CheckinActions, DemoModeToggle, ResetButtons, ScenarioButtons, WeatherButtons } from '../components/controls'
import { Card, LevelBadge, TopBar } from '../components/ui'
import CheckinChip from '../dashboard/CheckinChip'
import { useLive } from '../lib/live'

const GUIDE = [
  ['초기화', "'전 가구 정상으로 초기화' → 지도의 모든 마커가 초록색"],
  ['폭염', "기상 '폭염' → 정상 가구는 냉방 사용이 늘어 계속 '안전' (판단 근거에 냉방 사용량 표시)"],
  ['냉방 미사용', "김순자 어르신 시나리오 '냉·난방 미사용' → '위험' + 어르신 앱에 1차 알림 + 에너지 지원 카드"],
  ['미응답', '응답하지 않으면 10초 뒤 2차 음성 알림(앱에서 음성 재생), 10초 더 지나면 대시보드 적색 경보'],
  ['응답', "어르신 앱에서 '괜찮아요' 또는 대시보드에서 '확인 처리' → 알림 로그에 기록"],
  ['무변화', "다른 가구 시나리오 '무변화' → 생활 전력 변화 없음으로 '주의' (80세 이상 독거면 '위험')"],
]

export default function DemoPanel() {
  const { data: meta } = useLive('/meta')
  const { data: elders } = useLive('/elders')
  const sorted = elders?.slice().sort((a, b) => a.id - b.id)

  return (
    <div className="min-h-full">
      <TopBar title="시연 컨트롤 패널" />
      <main className="mx-auto grid max-w-[1400px] gap-4 p-5 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-8">
          <Card className="p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold">① 기상 상태</h2>
              <span className="text-sm text-ink-3">
                누르면 7일치 기온·전력 데이터를 다시 만들고 전 가구 위험도를 재계산합니다
                {meta && ` · 기상 데이터: ${meta.apis.weather === 'real' ? '기상청 API' : 'mock'}`}
              </span>
            </div>
            <div className="mt-3"><WeatherButtons meta={meta} /></div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-baseline justify-between px-5 pt-5">
              <h2 className="text-lg font-bold">② 가구별 전력 시나리오</h2>
              <span className="text-sm text-ink-3">정상 / 냉·난방 미사용(에너지 빈곤 의심) / 생활 전력 무변화(안부 이상 의심)</span>
            </div>
            <table className="mt-3 w-full text-sm">
              <thead className="border-y border-line bg-canvas text-left text-xs text-ink-3">
                <tr>
                  <th className="px-5 py-2 font-semibold">가구</th>
                  <th className="py-2 font-semibold">위험도</th>
                  <th className="py-2 font-semibold">시나리오</th>
                  <th className="py-2 pr-5 font-semibold">안부 확인</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sorted?.map((e) => (
                  <tr key={e.id} className={e.checkin?.stage === 3 ? 'bg-danger-soft' : ''}>
                    <td className="px-5 py-2.5">
                      <div className="font-bold">{e.id}. {e.name}</div>
                      <div className="text-xs text-ink-3">{e.age}세 · {e.lives_alone ? '독거' : '동거'} · {e.district}</div>
                    </td>
                    <td className="py-2.5"><LevelBadge level={e.risk?.level} /></td>
                    <td className="py-2.5"><ScenarioButtons elder={e} /></td>
                    <td className="space-y-1.5 py-2.5 pr-5">
                      {e.checkin && <CheckinChip checkin={e.checkin} />}
                      <CheckinActions elder={e} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>

        <div className="space-y-4 lg:col-span-4">
          <Card className="space-y-3 p-5">
            <h2 className="text-lg font-bold">③ 시연 설정</h2>
            <DemoModeToggle meta={meta} />
            <p className="text-sm text-ink-3">
              안부 알림 단계 대기 시간: 1차 푸시 → 2차 음성 {meta?.timings.to_voice_sec}초, 2차 음성 → 적색 경보 {meta?.timings.to_red_sec}초
              (backend/app/risk_rules.yaml 에서 변경)
            </p>
            <ResetButtons />
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-bold">④ 화면 열기</h2>
            <div className="mt-3 grid gap-2">
              <a href="/split" target="_blank" rel="noreferrer" className="rounded-xl bg-brand px-4 py-3 text-center font-bold text-white hover:bg-brand-dark">
                ★ 분할 시연 화면 (앱 + 대시보드)
              </a>
              <div className="grid grid-cols-2 gap-2">
                <a href="/app?id=1" target="_blank" rel="noreferrer" className="rounded-xl border-2 border-line px-3 py-2.5 text-center font-semibold hover:border-brand">어르신 앱 ↗</a>
                <a href="/dashboard" target="_blank" rel="noreferrer" className="rounded-xl border-2 border-line px-3 py-2.5 text-center font-semibold hover:border-brand">대시보드 ↗</a>
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-lg font-bold">시연 순서 (예시)</h2>
            <ol className="mt-3 space-y-2.5">
              {GUIDE.map(([t, d], i) => (
                <li key={t} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-bold text-brand-dark">{i + 1}</span>
                  <span className="text-sm leading-snug"><b>{t}</b> — {d}</span>
                </li>
              ))}
            </ol>
          </Card>
          <p className="text-xs text-ink-3">
            <Link to="/" className="underline">처음 화면</Link> · 모든 데이터는 시연용 가짜 데이터입니다.
          </p>
        </div>
      </main>
    </div>
  )
}
