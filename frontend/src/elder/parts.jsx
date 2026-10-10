import { useEffect, useState } from 'react'
import { speak, stopSpeaking, ttsSupported } from '../lib/tts'

// 어르신 앱 공통 규칙: 글씨 최소 24px, 버튼은 크고 단순하게, 한 화면에 정보 하나씩

/** 모든 카드에 붙는 '음성으로 듣기' 버튼 */
export function SpeakButton({ text, tone = 'light' }) {
  const [playing, setPlaying] = useState(false)
  useEffect(() => () => stopSpeaking(), [])
  if (!ttsSupported()) return null
  const toggle = () => {
    if (playing) { stopSpeaking(); setPlaying(false); return }
    setPlaying(speak(text, { onEnd: () => setPlaying(false) }))
  }
  const cls = tone === 'dark'
    ? 'border-white/70 bg-white/15 text-white'
    : 'border-brand bg-surface text-brand-dark'
  return (
    <button
      onClick={toggle}
      className={`flex min-h-[64px] w-full items-center justify-center gap-3 rounded-2xl border-2 text-[24px] font-bold ${cls}`}
    >
      <span aria-hidden>{playing ? '⏹' : '🔊'}</span>
      {playing ? '그만 듣기' : '음성으로 듣기'}
    </button>
  )
}

export function CardShell({ title, icon, tone = 'default', children, speakText, footer }) {
  const tones = {
    default: 'bg-surface border-line',
    safe: 'bg-safe-soft border-safe/30',
    caution: 'bg-caution-soft border-caution/40',
    danger: 'bg-danger-soft border-danger/40',
  }
  return (
    <article className={`flex h-full flex-col rounded-[28px] border-2 px-5 py-5 ${tones[tone]}`}>
      <h2 className="flex items-center gap-3 text-[30px] font-extrabold leading-tight">
        <span aria-hidden className="text-[34px]">{icon}</span>{title}
      </h2>
      <div className="mt-3 min-h-0 flex-1 overflow-y-auto text-[24px] leading-relaxed">{children}</div>
      <div className="mt-3 space-y-3">
        {footer}
        {speakText && <SpeakButton text={speakText} />}
      </div>
    </article>
  )
}

/** 화면을 처음 한 번 눌러야 브라우저가 음성 재생을 허용한다 */
export function StartOverlay({ name, onStart }) {
  return (
    <button
      onClick={onStart}
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-brand px-8 text-center text-white"
    >
      <img src="/favicon.svg" alt="" className="h-24 w-24 rounded-3xl ring-4 ring-white/40" />
      <div className="text-[40px] font-extrabold">온잇다</div>
      <div className="text-[28px] leading-snug">{name ? `${name} 어르신,` : ''}<br />안녕하세요</div>
      <div className="mt-6 rounded-2xl bg-white px-10 py-5 text-[30px] font-extrabold text-brand-dark">
        화면을 눌러 시작하기
      </div>
    </button>
  )
}
