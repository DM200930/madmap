'use client'

import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'

interface HeatmapPin {
  pin_code: string
  report_count: number
  products: string[]
  last_reported: string
}

const DEFAULT_MAP_CENTER: [number, number] = [22.9734, 78.6569]

const KNOWN_PIN_COORDS: Record<string, [number, number]> = {
  '110001': [28.6358, 77.2245],
  '400001': [18.9388, 72.8355],
  '560001': [12.9716, 77.5946],
  '700001': [22.5726, 88.3639],
  '600001': [13.0827, 80.2707],
}

function getPinLocation(pin: string): [number, number] {
  const digits = pin.replace(/\D/g, '').padEnd(6, '0').slice(0, 6)
  if (KNOWN_PIN_COORDS[digits]) return KNOWN_PIN_COORDS[digits]
  const lat = 6 + (parseInt(digits.slice(0, 3), 10) / 999) * 20
  const lng = 68 + (parseInt(digits.slice(3, 6), 10) / 999) * 25
  return [lat, lng]
}

function getHeatColor(count: number) {
  return count >= 5 ? '#E5394E' : count >= 2 ? '#F5B301' : '#7CBE3F'
}

export default function DashboardHeatmap({ heatmap }: { heatmap: HeatmapPin[] }) {
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold" style={{ color: '#2C2347' }}>Demand Heatmap by PIN Code</h2>
          <p className="text-sm mt-1" style={{ color: '#6E6788' }}>
            Real customer reports shown on a map. Hotter circles mean more requests from that postal cluster.
          </p>
        </div>
        <div className="flex gap-3 text-xs">
          <span>🟢 Low</span>
          <span>🟡 Medium</span>
          <span>🔴 High</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl shadow-sm mb-6">
        <MapContainer
          center={DEFAULT_MAP_CENTER}
          zoom={5}
          scrollWheelZoom={false}
          className="w-full h-96"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {heatmap.map(pin => (
            <CircleMarker
              key={pin.pin_code}
              center={getPinLocation(pin.pin_code)}
              radius={Math.min(24, 8 + pin.report_count * 3)}
              pathOptions={{ color: getHeatColor(pin.report_count), fillColor: getHeatColor(pin.report_count), fillOpacity: 0.35 }}
            >
              <Popup>
                <div className="text-sm">
                  <strong>{pin.pin_code}</strong><br />
                  {pin.products.join(', ')}<br />
                  Reports: {pin.report_count}
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {heatmap.length === 0 ? (
        <div className="text-center py-12" style={{ color: '#6E6788' }}>
          <p className="text-4xl mb-3">📍</p>
          <p>No SOS reports yet. Reports will appear here as customers submit them.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {heatmap.map(pin => (
            <div
              key={pin.pin_code}
              className="flex items-center gap-4 p-4 rounded-xl transition-all hover:shadow-md"
              style={{
                backgroundColor: pin.report_count >= 5 ? '#FCEDEF' : pin.report_count >= 2 ? '#FFFBEB' : '#F2F8E9',
              }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
                style={{
                  backgroundColor: pin.report_count >= 5 ? '#E5394E' : pin.report_count >= 2 ? '#F5B301' : '#7CBE3F',
                }}
              >
                {pin.report_count}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-mono font-bold" style={{ color: '#2C2347' }}>{pin.pin_code}</p>
                <p className="text-xs truncate" style={{ color: '#6E6788' }}>{pin.products.join(' · ')}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                  {new Date(pin.last_reported).toLocaleDateString('en-IN')}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
