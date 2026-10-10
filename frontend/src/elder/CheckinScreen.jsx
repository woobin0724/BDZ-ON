import { useEffect, useRef } from 'react'
import { speak } from '../lib/tts'
import { SpeakButton } from './parts'

const STAGE = {
  1: { bg: 'bg-brand', title: '안부를 여쭤요', sub: '괜찮으시면 아래 버튼을 눌러 주세요' },
  2: { bg: 'bg-brand-dark', title: '안부를 여쭤요', sub: '🔊 음성으로 알려 드리고 있어요' },
  3: { bg: 'bg-danger', title: '복지사님께 알렸어요', sub: '곧 연락드릴게요. 괜찮으시면 버튼을 눌러 주세요' },
}

/**
 * 안부 확인 화면 (진행 중인 안부 확인이 있으면 카드 대신 전체 화면으로 표시)
 * 1차: 알림 카드 + '괜찮아요' 버튼
 * 2차: 같은 화면에서 안내 문구를 자동으로 읽어줌
 * 3차: 복지사 적색 경보 상태 안내
 */
export default function CheckinScreen({ checkin, onRespond, busy, audioReady }) {
  const spokenStage = useRef(null)
  const s = STAGE[checkin.stage]

  // 2차 이상 단계에 들어서면 음성 알림을 자동 재생 (단계마다 한 번)
  useEffect(() => {
    if (!audioReady) return
    const key = `${checkin.id}-${checkin.stage}`
    if (checkin.stage >= 2 && spokenStage.current !== key) {
      spokenStage.current = key
      speak(checkin.message)
    }
  }, [checkin.id, checkin.stage, checkin.message, audioReady])

  return (
    <div className={`flex h-full flex-col ${s.bg} p-6 text-white`}>
      <div className="flex items-center gap-3 text-[24px] font-bold opacity-95">
        <span aria-hidden className="text-[32px]">{checkin.stage === 3 ? '🚨' : checkin.stage === 2 ? '🔊' : '🔔'}</span>
        {checkin.stage === 1 ? '알림' : checkin.stage === 2 ? '음성 알림' : '긴급 알림'}
      </div>
      <h2 className="mt-3 text-[40px] font-extrabold leading-tight">{s.title}</h2>
      <p className="mt-2 text-[24px] leading-snug opacity-95">{s.sub}</p>

      <div className="mt-5 min-h-0 flex-1 overflow-y-auto rounded-3xl bg-white/15 p-5 text-[26px] font-semibold leading-snug">
        {checkin.message}
      </div>

      <div className="mt-5 space-y-3">
        <button
          onClick={onRespond}
          disabled={busy}
          className="flex min-h-[112px] w-full items-center justify-center gap-3 rounded-3xl bg-white text-[40px] font-extrabold text-safe shadow-lg active:scale-[0.99] disabled:opacity-70"
        >
          <span aria-hidden>👍</span> 괜찮아요
        </button>
        <SpeakButton text={checkin.message} tone="dark" />
      </div>
    </div>
  )
}

export function ThanksScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5 bg-safe p-8 text-center text-white">
      <div className="text-[80px]" aria-hidden>😊</div>
      <div className="text-[40px] font-extrabold">고맙습니다</div>
      <div className="text-[28px] leading-snug">응답을 복지사님께 전해 드렸어요.<br />오늘도 건강하세요.</div>
    </div>
  )
}
