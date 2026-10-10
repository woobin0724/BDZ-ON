// 음성 안내 (브라우저 Web Speech API, ko-KR)
// 오프라인 시연을 위해 기기에 설치된 한국어 음성(윈도우: Microsoft Heami)을 우선 사용한다.
// 크롬의 'Google 한국어' 음성은 인터넷이 필요하다.

let cachedVoice = null

function pickVoice() {
  if (!('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang?.toLowerCase().startsWith('ko'))
  if (!voices.length) return null
  return (
    voices.find((v) => v.localService && /heami/i.test(v.name)) ||
    voices.find((v) => v.localService) ||
    voices[0]
  )
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  cachedVoice = pickVoice()
  window.speechSynthesis.onvoiceschanged = () => { cachedVoice = pickVoice() }
}

export const ttsSupported = () => typeof window !== 'undefined' && 'speechSynthesis' in window

export function voiceName() {
  return cachedVoice?.name ?? null
}

/** 문장을 읽어준다. 이미 읽는 중이면 멈추고 새로 읽는다. */
export function speak(text, { rate = 0.9, onEnd } = {}) {
  if (!ttsSupported() || !text) return false
  const synth = window.speechSynthesis
  synth.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ko-KR'
  u.rate = rate
  u.pitch = 1
  if (!cachedVoice) cachedVoice = pickVoice()
  if (cachedVoice) u.voice = cachedVoice
  if (onEnd) { u.onend = onEnd; u.onerror = onEnd }
  synth.speak(u)
  return true
}

export function stopSpeaking() {
  if (ttsSupported()) window.speechSynthesis.cancel()
}
