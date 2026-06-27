// Leaflet-free geo helpers, safe to import from server-rendered pages.

export interface DemandPoint {
  pin_code: string
  lat: number
  lng: number
  count: number
  status: 'supplied' | 'unmet' | 'feedback' // green = supply, red = unmet demand, bright green = feedback engagement
  products: string[]
  flavours: string[]
  city: string
  latest: string
}

const KNOWN_PIN_COORDS: Record<string, [number, number]> = {
  '110001': [28.6358, 77.2245], '400001': [18.9388, 72.8355], '560001': [12.9716, 77.5946],
  '700001': [22.5726, 88.3639], '600001': [13.0827, 80.2707], '500001': [17.385, 78.4867],
  '380001': [23.0225, 72.5714], '411001': [18.5204, 73.8567], '201301': [28.5708, 77.321],
  '122001': [28.4595, 77.0266],
}

export function pinToCoord(pin: string): [number, number] {
  const digits = (pin || '').replace(/\D/g, '').padEnd(6, '0').slice(0, 6)
  if (KNOWN_PIN_COORDS[digits]) return KNOWN_PIN_COORDS[digits]
  const lat = 6 + (parseInt(digits.slice(0, 3), 10) / 999) * 20
  const lng = 68 + (parseInt(digits.slice(3, 6), 10) / 999) * 25
  return [lat, lng]
}
