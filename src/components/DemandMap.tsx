'use client'

import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet.heat'
import 'leaflet/dist/leaflet.css'
import type { DemandPoint } from '@/lib/geo'

export type { DemandPoint } from '@/lib/geo'

const DEFAULT_CENTER: [number, number] = [22.9734, 78.6569]

/** Density heat layer (green → yellow → red) driven by report counts. */
function HeatLayer({ points }: { points: DemandPoint[] }) {
  const map = useMap()
  useEffect(() => {
    if (!points.length) return
    const max = Math.max(...points.map(p => p.count), 1)
    const data = points.map(p => [p.lat, p.lng, p.count] as [number, number, number])
    const layer = L.heatLayer(data, {
      radius: 45,
      blur: 35,
      max,
      minOpacity: 0.35,
      gradient: { 0.2: '#22C55E', 0.45: '#A3CB38', 0.65: '#F5B301', 0.85: '#EE7B30', 1.0: '#E5394E' },
    })
    layer.addTo(map)
    return () => { map.removeLayer(layer) }
  }, [map, points])
  return null
}

export default function DemandMap({
  points,
  height = '70vh',
  showCircles = true,
}: {
  points: DemandPoint[]
  height?: string | number
  showCircles?: boolean
}) {
  return (
    <div className="overflow-hidden rounded-3xl shadow-sm">
      <MapContainer center={DEFAULT_CENTER} zoom={5} scrollWheelZoom={false} className="w-full" style={{ height, minHeight: 420 }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <HeatLayer points={points} />
        {showCircles && points.map(p => {
          const color = p.status === 'unmet' ? '#E5394E' : '#7CBE3F'
          // proportional, pixel-based radius → stays visible at every zoom level
          const radius = Math.max(10, Math.min(42, 8 + p.count * 4))
          return (
            <CircleMarker
              key={`${p.status}-${p.pin_code}`}
              center={[p.lat, p.lng]}
              radius={radius}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.45, weight: 2 }}
            >
              <Popup>
                <div className="text-xs leading-relaxed">
                  <strong>{p.status === 'unmet' ? '🔴 Demand, no supply' : '🟢 Demand & supply'}</strong><br />
                  <b>Product:</b> {p.products.join(', ') || '—'}<br />
                  <b>Flavour:</b> {p.flavours.join(', ') || '—'}<br />
                  <b>PIN:</b> {p.pin_code || '—'}<br />
                  <b>City:</b> {p.city || '—'}<br />
                  <b>Reports:</b> {p.count}<br />
                  <b>Latest:</b> {p.latest ? new Date(p.latest).toLocaleString('en-IN') : '—'}<br />
                  <b>Coords:</b> {p.lat.toFixed(4)}, {p.lng.toFixed(4)}
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}
