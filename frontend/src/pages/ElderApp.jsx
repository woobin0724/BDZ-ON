import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import CheckinScreen, { ThanksScreen } from '../elder/CheckinScreen'
import { DietCard, SafetyCard, WeatherCard, WelfareCard } from '../elder/cards'
import { StartOverlay } from '../elder/parts'
import { api } from '../lib/api'
import { useLive } from '../lib/live'
import { speak, stopSpeaking } from '../lib/tts'

const AUDIO_KEY = 'onitda.audioReady'
const readAudio = () => { try { return sessionStorage.getItem(AUDIO_KEY) === '1' } catch { return false } }

/**
 * A. 어르신용 앱 (모바일 화면)
 * - /app?id=1         : PC 에서는 휴대폰 틀 안에 표시
 * - /app?id=1&frame=0 : 틀 없이 전체 화면 (휴대폰·분할 화면용)
 */
export default function ElderApp() {
  const [params, setParams] = useSearchParams()
  const id = Number(params.get('id')) || 1
  const framed = params.get('frame') !== '0'
  const { data, reload } = useLive(`/app/${id}/home`)
  const { data: elders } = useLive(framed ? '/elders' : null)

  const [audioReady, setAudioReady] = useState(readAudio)
  const [cardKey, setCardKey] = useState('weather')
  const [busy, setBusy] = useState(false)
  const [thanks, setThanks] = useState(false)

  const cards = useMemo(() => {
    if (!data) return []
    const list = [
      { key: 'weather', el: <WeatherCard w={data.weather} /> },
      { key: 'safety', el: <SafetyCard risk={data.risk} name={data.elder.name} /> },
    ]
    if (data.welfare) list.push({ key: 'welfare', el: <WelfareCard welfare={data.welfare} /> })
    list.push({ key: 'diet', el: <DietCard diet={data.diet} /> })
    return list
  }, [data])

  // 위험 신호가 새로 생기면 안전 상태 카드부터 보여준다
  const level = data?.risk.level
  useEffect(() => { if (level && level !== 'safe') setCardKey('safety') }, [level])
  useEffect(() => { stopSpeaking(); setCardKey('weather') }, [id])

  const idx = Math.max(0, cards.findIndex((c) => c.key === cardKey))
  const go = (d) => {
    stopSpeaking()
    const next = cards[Math.min(cards.length - 1, Math.max(0, idx + d))]
    if (next) setCardKey(next.key)
  }

  const start = () => {
    setAudioReady(true)
    try { sessionStorage.setItem(AUDIO_KEY, '1') } catch { /* 저장 불가 */ }
    speak(' ') // 첫 터치로 음성 재생 권한 확보
  }

  const respond = async () => {
    setBusy(true)
    stopSpeaking()
    try {
      await api.post(`/app/${id}/respond`)
      setThanks(true)
      if (audioReady) speak('응답해 주셔서 고맙습니다. 오늘도 건강하세요.')
      setTimeout(() => setThanks(false), 4000)
      reload()
    } catch { reload() } finally { setBusy(false) }
  }

  const screen = !data ? (
    <div className="flex h-full items-center justify-center text-[26px] text-ink-2">불러오는 중…</div>
  ) : thanks ? (
    <ThanksScreen />
  ) : data.checkin ? (
    <CheckinScreen checkin={data.checkin} onRespond={respond} busy={busy} audioReady={audioReady} />
  ) : (
    <div className="flex h-full flex-col">
      <header className="px-6 pb-3 pt-6">
        <div className="text-[24px] text-ink-2">
          {new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
        </div>
        <div className="text-[30px] font-extrabold leading-tight">{data.elder.name} 어르신, 안녕하세요</div>
      </header>
      <div className="min-h-0 flex-1 px-4">{cards[idx]?.el}</div>
      <nav className="flex items-center gap-3 px-4 pb-5 pt-4">
        <button onClick={() => go(-1)} disabled={idx === 0}
                className="min-h-[72px] flex-1 rounded-2xl border-2 border-line-strong bg-surface text-[26px] font-bold disabled:opacity-35">
          ◀ 이전
        </button>
        <span className="w-16 text-center text-[24px] font-semibold tabular-nums text-ink-2">{idx + 1}/{cards.length}</span>
        <button onClick={() => go(1)} disabled={idx === cards.length - 1}
                className="min-h-[72px] flex-1 rounded-2xl bg-brand text-[26px] font-bold text-white disabled:opacity-35">
          다음 ▶
        </button>
      </nav>
    </div>
  )

  const phone = (
    <div className="relative h-full overflow-hidden bg-canvas">
      {screen}
      {!audioReady && <StartOverlay name={data?.elder.name} onStart={start} />}
    </div>
  )

  if (!framed) return <div className="h-dvh">{phone}</div>

  return (
    <div className="flex min-h-full flex-col items-center gap-4 bg-[#efe6da] px-4 py-6">
      {/* 시연 진행자용 (휴대폰 화면 밖) */}
      <div className="flex w-full max-w-[400px] items-center gap-2 text-sm text-ink-2">
        <Link to="/" className="font-bold text-brand-dark">온잇다</Link>
        <span>· 어르신 앱 미리보기</span>
        <select
          value={id}
          onChange={(e) => setParams({ id: e.target.value })}
          className="ml-auto rounded-lg border border-line bg-surface px-2 py-1"
        >
          {(elders ?? []).slice().sort((a, b) => a.id - b.id).map((e) => (
            <option key={e.id} value={e.id}>{e.id}. {e.name} ({e.risk?.level_label})</option>
          ))}
        </select>
      </div>
      <div className="h-[844px] max-h-[calc(100dvh-80px)] w-full max-w-[400px] overflow-hidden rounded-[44px] border-[10px] border-[#2b2118] bg-canvas shadow-xl">
        {phone}
      </div>
    </div>
  )
}
