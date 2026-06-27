'use client'

import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

export interface SupplyPin {
  pin_code: string
  count: number
  status: 'supplied' | 'unmet' // green = demand & supply, red = demand only
  products: string[]
}

const DEFAULT_MAP_CENTER: [number, number] = [22.9734, 78.6569]

const KNOWN_PIN_COORDS: Record<string, [number, number]> = {
  '110001': [28.6358, 77.2245],
  '400001': [18.9388, 72.8355],
  '560001': [12.9716, 77.5946],
  '700001': [22.5726, 88.3639],
  '600001': [13.0827, 80.2707],
  '500001': [17.385, 78.4867],
  '380001': [23.0225, 72.5714],
  '411001': [18.5204, 73.8567],
}

function getPinLocation(pin: string): [number, number] {
  const digits = (pin || '').replace(/\D/g, '').padEnd(6, '0').slice(0, 6)
  if (KNOWN_PIN_COORDS[digits]) return KNOWN_PIN_COORDS[digits]
  const lat = 6 + (parseInt(digits.slice(0, 3), 10) / 999) * 20
  const lng = 68 + (parseInt(digits.slice(3, 6), 10) / 999) * 25
  return [lat, lng]
}

export default function AdminMap({ pins }: { pins: SupplyPin[] }) {
  return (
    <div className="overflow-hidden rounded-3xl shadow-sm">
      <MapContainer center={DEFAULT_MAP_CENTER} zoom={5} scrollWheelZoom={false} className="w-full" style={{ height: '70vh', minHeight: 480 }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {pins.map(p => {
          const color = p.status === 'unmet' ? '#E5394E' : '#7CBE3F'
          return (
            <CircleMarker
              key={`${p.status}-${p.pin_code}`}
              center={getPinLocation(p.pin_code)}
              radius={Math.min(28, 9 + p.count * 3)}
              pathOptions={{ color, fillColor: color, fillOpacity: 0.4, weight: 2 }}
            >
              <Popup>
                <div className="text-sm">
                  <strong>{p.pin_code}</strong> — {p.status === 'unmet' ? '🔴 Demand, no supply' : '🟢 Demand & supply'}<br />
                  {p.products.join(', ')}<br />
                  {p.status === 'unmet' ? 'Reports' : 'Scans'}: {p.count}
                </div>
              </Popup>
            </CircleMarker>
          )
        })}
      </MapContainer>
    </div>
  )
}
