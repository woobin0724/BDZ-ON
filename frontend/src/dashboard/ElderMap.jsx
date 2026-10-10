import { useEffect, useState } from 'react'
import { CircleMarker, GeoJSON, MapContainer, Pane, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { LEVEL, LEVEL_HEX } from '../lib/format'

// 전북 전체가 보이는 범위
const BOUNDS = [[35.28, 126.42], [36.17, 127.92]]
const BG_KEY = 'onitda.mapBg'

function readBg() {
  try { return localStorage.getItem(BG_KEY) || 'auto' } catch { return 'auto' }
}

function FlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    // 선택한 가구가 화면 밖에 있을 때만 이동 (전북 전체 보기 유지)
    if (target && !map.getBounds().pad(-0.1).contains([target.lat, target.lng])) {
      map.panTo([target.lat, target.lng], { animate: false })
    }
  }, [target, map])
  return null
}

/**
 * 가구별 위험도 마커 지도.
 * - 온라인: OpenStreetMap 타일 + 전북 시·군 경계
 * - 오프라인: 내장된 전북 시·군 경계(GeoJSON)만으로 표시 (타일 로딩 실패 시 자동 전환)
 */
export default function ElderMap({ elders, selectedId, onSelect, height = 460 }) {
  const [bg, setBg] = useState(readBg)            // auto / online / offline
  const [tilesFailed, setTilesFailed] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine)
  const [geo, setGeo] = useState(null)

  useEffect(() => {
    fetch('/jeonbuk.geo.json').then((r) => r.json()).then(setGeo).catch(() => {})
  }, [])

  const changeBg = (v) => {
    setBg(v)
    if (v !== 'offline') setTilesFailed(false)
    try { localStorage.setItem(BG_KEY, v) } catch { /* 저장 불가 환경 */ }
  }

  const showTiles = bg === 'online' || (bg === 'auto' && !tilesFailed)
  const selected = elders?.find((e) => e.id === selectedId)

  return (
    <div className="relative overflow-hidden rounded-2xl border border-line" style={{ height }}>
      <MapContainer bounds={BOUNDS} zoomSnap={0.25} minZoom={7} maxZoom={14} className="h-full w-full" scrollWheelZoom>
        {showTiles && (
          <TileLayer
            attribution='&copy; OpenStreetMap contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            eventHandlers={{ tileerror: () => bg === 'auto' && setTilesFailed(true) }}
          />
        )}
        {geo && (
          <GeoJSON
            key={showTiles ? 'on' : 'off'}
            data={geo}
            style={{
              color: '#b59c80',
              weight: 1,
              fillColor: '#fffaf3',
              fillOpacity: showTiles ? 0 : 1,
            }}
            onEachFeature={(f, layer) => {
              if (!showTiles) layer.bindTooltip(f.properties.name, { permanent: true, direction: 'center', className: 'region-label' })
            }}
          />
        )}
        <Pane name="elders" style={{ zIndex: 450 }}>
        {elders?.map((e) => {
          const level = e.risk?.level ?? 'safe'
          const red = e.checkin?.stage === 3
          const isSel = e.id === selectedId
          return (
            <CircleMarker
              key={`${e.id}-${level}-${red}-${isSel}`}
              center={[e.lat, e.lng]}
              pane="elders"
              radius={isSel ? 15 : 11}
              pathOptions={{
                color: red ? '#7a0f0f' : '#ffffff',
                weight: red ? 4 : 2,
                fillColor: LEVEL_HEX[level],
                fillOpacity: 1,
              }}
              eventHandlers={{ click: () => onSelect?.(e.id) }}
            >
              <Tooltip direction="top" offset={[0, -10]} permanent={level !== 'safe' || isSel}>
                <b>{e.name}</b> · {LEVEL[level].label}{red ? ' · 적색 경보' : ''}
              </Tooltip>
            </CircleMarker>
          )
        })}
        </Pane>
        <FlyTo target={selected} />
      </MapContainer>

      {/* 범례 */}
      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-xl border border-line bg-surface/95 px-3 py-2 text-sm">
        <div className="flex items-center gap-3">
          {['safe', 'caution', 'danger'].map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full border-2 border-white" style={{ background: LEVEL_HEX[k] }} />
              {LEVEL[k].label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full" style={{ background: LEVEL_HEX.danger, boxShadow: '0 0 0 2px #7a0f0f' }} />
            적색 경보
          </span>
        </div>
      </div>

      {/* 배경 전환 */}
      <div className="absolute right-3 top-3 z-[400] flex overflow-hidden rounded-lg border border-line bg-surface text-xs font-semibold">
        {[['auto', '자동'], ['online', '온라인 지도'], ['offline', '오프라인']].map(([v, label]) => (
          <button
            key={v}
            onClick={() => changeBg(v)}
            className={`px-2.5 py-1.5 ${bg === v ? 'bg-brand text-white' : 'text-ink-2 hover:bg-brand-wash'}`}
          >
            {label}
          </button>
        ))}
      </div>
      {bg === 'auto' && tilesFailed && (
        <div className="absolute right-3 top-12 z-[400] rounded-lg bg-surface/95 px-2.5 py-1 text-xs text-ink-3">
          인터넷 연결이 없어 오프라인 지도로 표시 중
        </div>
      )}
    </div>
  )
}
