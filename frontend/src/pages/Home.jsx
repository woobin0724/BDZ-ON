import { Link } from 'react-router-dom'
import { Card, Logo } from '../components/ui'

const SCREENS = [
  { to: '/app?id=1', title: '어르신 앱', desc: '모바일 화면 · 큰 글씨 · 음성 안내 · 괜찮아요 응답', tag: 'A' },
  { to: '/dashboard', title: '복지사 대시보드', desc: '위험 가구 지도 · 판단 근거 · 전력·기온 차트 · 알림 로그', tag: 'B' },
  { to: '/demo', title: '시연 컨트롤 패널', desc: '기상 상태·가구 시나리오 전환 · 시연 모드', tag: 'C' },
  { to: '/split', title: '분할 시연 화면', desc: '시연 패널 + 어르신 앱 + 대시보드를 한 화면에', tag: '★' },
]

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full max-w-4xl flex-col px-5 py-12">
      <Logo />
      <h1 className="mt-6 text-3xl font-extrabold leading-snug">
        기상 특보와 전력 사용 패턴으로<br />홀로 계신 어르신의 안부를 살핍니다
      </h1>
      <p className="mt-3 text-lg text-ink-2">
        기후·에너지 취약 고령층 케어 플랫폼 — 공모전 시연용 프로토타입
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {SCREENS.map((s) => (
          <Link key={s.to} to={s.to} className="group">
            <Card className="h-full p-6 transition-colors group-hover:border-brand">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft font-extrabold text-brand-dark">
                  {s.tag}
                </span>
                <h2 className="text-xl font-bold">{s.title}</h2>
              </div>
              <p className="mt-3 text-ink-2">{s.desc}</p>
            </Card>
          </Link>
        ))}
      </div>

      <p className="mt-auto pt-12 text-sm text-ink-3">
        ※ 화면에 나오는 모든 이름·주소·연락처·전력 데이터는 시연용으로 만든 가짜 데이터입니다.
      </p>
    </main>
  )
}
