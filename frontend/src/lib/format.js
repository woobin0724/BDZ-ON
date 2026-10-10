export const LEVEL = {
  safe: { label: '안전', color: 'var(--color-safe)', soft: 'var(--color-safe-soft)', ink: 'var(--color-safe)', icon: '●' },
  caution: { label: '주의', color: 'var(--color-caution)', soft: 'var(--color-caution-soft)', ink: 'var(--color-caution-ink)', icon: '▲' },
  danger: { label: '위험', color: 'var(--color-danger)', soft: 'var(--color-danger-soft)', ink: 'var(--color-danger)', icon: '■' },
}

// 지도 마커 등 CSS 변수를 쓸 수 없는 곳용
export const LEVEL_HEX = { safe: '#2e8b57', caution: '#e0a100', danger: '#d62828' }

export const WEATHER_ICON = { normal: '☀️', heatwave: '🔥', coldwave: '❄️' }

export function won(n) {
  return n == null ? '-' : `${n.toLocaleString('ko-KR')}원`
}

export function hhmm(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function dateTime(iso) {
  if (!iso) return '-'
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const time = d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
  return sameDay ? time : `${d.getMonth() + 1}/${d.getDate()} ${time.slice(0, 5)}`
}

export function secondsLeft(iso, now = Date.now()) {
  if (!iso) return null
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 1000))
}

export function duration(sec) {
  if (sec == null) return ''
  if (sec < 60) return `${sec}초`
  const m = Math.floor(sec / 60)
  return m < 60 ? `${m}분 ${sec % 60}초` : `${Math.floor(m / 60)}시간 ${m % 60}분`
}

/** 받침 여부에 따라 조사를 붙인다. josa('수박', '이/가') → '수박이', josa('참외', '을/를') → '참외를' */
export function josa(word, pair) {
  if (!word) return word
  const [withB, withoutB] = pair.split('/')
  const code = word.charCodeAt(word.length - 1) - 0xac00
  const batchim = code >= 0 && code <= 11171 && code % 28 !== 0
  return word + (batchim ? withB : withoutB)
}
