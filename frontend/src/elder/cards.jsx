import { josa, won } from '../lib/format'
import { CardShell } from './parts'

const WEATHER_ICON = { normal: '☀️', heatwave: '🔥', coldwave: '❄️' }
const deg = (v) => (v == null ? '-' : `${Math.round(v)}도`)

/* ① 오늘 날씨 / 특보 */
export function WeatherCard({ w }) {
  const text = [
    `오늘 ${w.station} 날씨는 ${w.sky}, 지금 기온은 ${josa(deg(w.temp_now), '이에요/예요')}.`,
    `최고 ${deg(w.high)}, 최저 ${josa(deg(w.low), '이에요/예요')}.`,
    w.warning ? `${josa(w.warning, '이/가')} 내려졌어요.` : '',
    w.advice,
  ].join(' ')
  return (
    <CardShell title="오늘 날씨" icon={WEATHER_ICON[w.mode]} speakText={text}>
      {w.warning && (
        <div className="mb-4 rounded-2xl bg-danger px-5 py-3 text-[28px] font-extrabold text-white">
          ⚠ {w.warning} 발효 중
        </div>
      )}
      <div className="flex items-end gap-4">
        <span className="text-[72px] font-extrabold leading-none tabular-nums">{deg(w.temp_now)}</span>
        <span className="pb-2 text-[26px] text-ink-2">{w.station} · {w.sky}</span>
      </div>
      <div className="mt-3 flex gap-6 text-[26px] font-semibold">
        <span className="text-danger">최고 {deg(w.high)}</span>
        <span className="text-[#1f5fa8]">최저 {deg(w.low)}</span>
      </div>
      <p className="mt-5 rounded-2xl bg-brand-wash p-4 text-[24px] leading-snug">{w.advice}</p>
    </CardShell>
  )
}

/* ② 안전 상태 (위험 알림) */
export function SafetyCard({ risk, name }) {
  const safe = risk.level === 'safe'
  const tone = safe ? 'safe' : risk.level
  const title = safe ? '오늘도 안전해요' : risk.level === 'danger' ? '건강을 꼭 챙기세요' : '안부를 여쭤요'
  return (
    <CardShell title={title} icon={safe ? '😊' : '⚠️'} tone={tone} speakText={`${name} 어르신, ${risk.message}`}>
      <p className="text-[28px] font-semibold leading-snug">{risk.message}</p>
      {safe && (
        <div className="mt-8 flex justify-center" aria-hidden>
          <span className="flex h-36 w-36 items-center justify-center rounded-full bg-safe text-[80px] font-bold text-white">✓</span>
        </div>
      )}
      {!safe && (
        <p className="mt-5 text-[24px] text-ink-2">담당 복지사님도 함께 살펴보고 있어요.</p>
      )}
    </CardShell>
  )
}

/* ③ 에너지 지원 제도 안내
 * TODO: 공식 정보 확인 후 수정 — 문구는 backend/app/data/welfare.json 의 placeholder 를 그대로 보여준다. */
export function WelfareCard({ welfare }) {
  const text = [
    '에너지 지원 제도를 안내해 드려요.',
    ...welfare.programs.map((p) => `${p.title}. ${p.summary}`),
    welfare.contact,
  ].join(' ')
  return (
    <CardShell title="에너지 지원 안내" icon="💡" speakText={text}>
      <ul className="space-y-3">
        {welfare.programs.map((p) => (
          <li key={p.id} className="rounded-2xl border-2 border-line bg-canvas p-4">
            <div className="text-[26px] font-extrabold text-brand-dark">{p.title}</div>
            <div className="text-[24px] leading-snug">{p.summary}</div>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-[24px] font-semibold leading-snug">📞 {welfare.contact}</p>
    </CardShell>
  )
}

/* ④ 오늘의 계절 식단 */
export function DietCard({ diet }) {
  const names = diet.ingredients.map((i) => i.name).join(', ')
  const parts = [`오늘의 추천 식단은 ${josa(diet.menu, '이에요/예요')}.`, `추천 재료는 ${josa(names, '이에요/예요')}.`]
  diet.ingredients.filter((i) => i.alternative).forEach((i) => {
    parts.push(`${josa(i.name, '이/가')} 평소보다 ${i.change_pct}퍼센트 비싸요. 대신 ${josa(i.alternative.name, '을/를')} 드셔 보세요. ${i.alternative.reason}.`)
  })
  parts.push(diet.tip)

  return (
    <CardShell title="오늘의 식단" icon="🍲" speakText={parts.join(' ')}>
      <div className="text-[24px] font-semibold text-brand-dark">{diet.label}</div>
      <div className="text-[28px] font-extrabold leading-snug">{diet.menu}</div>
      <ul className="mt-1 divide-y-2 divide-line">
        {diet.ingredients.map((i) => (
          <li key={i.name} className="py-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[26px] font-bold">{i.name}</span>
              <span className="text-[24px] tabular-nums">{won(i.price)}<span className="text-ink-2"> / {i.unit}</span></span>
            </div>
            {i.alternative ? (
              <div className="mt-1 rounded-2xl bg-caution-soft px-3 py-2 text-[24px] leading-snug">
                <div className="font-bold text-caution-ink">평소보다 {i.change_pct}% 비싸요</div>
                <div>
                  대신 <b>{i.alternative.name}</b> {won(i.alternative.price)}
                  <span className="text-ink-2"> / {i.alternative.unit}</span>
                </div>
                <div className="text-ink-2">{i.alternative.reason}</div>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[24px] leading-snug text-ink-2">💬 {diet.tip}</p>
    </CardShell>
  )
}
