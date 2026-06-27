import { pinToCoord } from './geo'

export interface ResolvedLocation {
  lat: number
  lng: number
  pin_code: string
  city: string
  state: string
  accuracy?: number
}

/**
 * Capture the best GPS fix, aiming for ~targetAccuracy metres or better.
 * Uses watchPosition and keeps the most accurate reading until the target is
 * met or the timeout elapses, then returns the best fix obtained.
 */
export function getHighAccuracyPosition(
  targetAccuracy = 50,
  timeoutMs = 12000
): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator?.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'))
      return
    }
    let best: { lat: number; lng: number; accuracy: number } | null = null
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      navigator.geolocation.clearWatch(id)
      clearTimeout(timer)
      if (best) resolve(best)
      else reject(new Error('Could not obtain a location fix.'))
    }
    const id = navigator.geolocation.watchPosition(
      pos => {
        const acc = pos.coords.accuracy ?? 9999
        if (!best || acc < best.accuracy) {
          best = { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: acc }
        }
        if (acc <= targetAccuracy) finish()
      },
      err => { if (!best) { settled = true; navigator.geolocation.clearWatch(id); clearTimeout(timer); reject(err) } },
      { enableHighAccuracy: true, maximumAge: 0, timeout: timeoutMs }
    )
    const timer = setTimeout(finish, timeoutMs)
  })
}

/** High-accuracy GPS fix, reverse-geocoded to PIN/city/state. */
export async function captureHighAccuracyLocation(targetAccuracy = 50): Promise<ResolvedLocation> {
  const { lat, lng, accuracy } = await getHighAccuracyPosition(targetAccuracy)
  try {
    const r = await reverseGeocode(lat, lng)
    return { ...r, accuracy }
  } catch {
    return { lat, lng, pin_code: '', city: '', state: '', accuracy }
  }
}

/** Reverse-geocode coordinates into PIN / city / state via BigDataCloud (no key). */
export async function reverseGeocode(lat: number, lng: number): Promise<ResolvedLocation> {
  const res = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
  )
  const data = await res.json()
  return {
    lat,
    lng,
    pin_code: (data.postcode || '').toString().replace(/\D/g, '').slice(0, 6),
    city: data.city || data.locality || data.localityInfo?.administrative?.[3]?.name || '',
    state: data.principalSubdivision || '',
  }
}

// India's bounding box — used to reject any geocoding result outside India.
const IN_LAT_MIN = 6.5, IN_LAT_MAX = 37.6, IN_LNG_MIN = 67.0, IN_LNG_MAX = 97.5
const insideIndia = (lat: number, lng: number) =>
  lat >= IN_LAT_MIN && lat <= IN_LAT_MAX && lng >= IN_LNG_MIN && lng <= IN_LNG_MAX

/**
 * Resolve a manually entered 6-digit Indian PIN code to a location, restricted
 * to India. Validity is established via the India Post dataset (Indian PINs
 * only), then coordinates are fetched from Nominatim with countrycodes=in.
 * Returns null only when the PIN is not a valid Indian PIN code.
 */
export async function geocodeIndianPin(pin: string): Promise<ResolvedLocation | null> {
  const clean = (pin || '').replace(/\D/g, '').slice(0, 6)
  if (clean.length !== 6) return null

  let city = ''
  let state = ''
  let validIndianPin = false

  // 1) Validate + name the PIN using India Post (an India-only dataset).
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${clean}`)
    const json = await res.json()
    const rec = Array.isArray(json) ? json[0] : null
    if (rec && rec.Status === 'Success' && rec.PostOffice?.length) {
      const po = rec.PostOffice[0]
      city = po.District || po.Block || po.Name || ''
      state = po.State || ''
      validIndianPin = true
    }
  } catch {
    /* fall through to Nominatim */
  }

  // 2) Coordinates, explicitly restricted to India (country=IN).
  let lat = NaN
  let lng = NaN
  try {
    const url = city
      ? `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=in&addressdetails=1&limit=1&q=${encodeURIComponent(`${city}, ${state}, India`)}`
      : `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=in&addressdetails=1&limit=1&postalcode=${clean}`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    const data = await res.json()
    // Always choose a result inside India.
    const hit = Array.isArray(data) ? data.find((d) => d?.address?.country_code === 'in') : null
    if (hit) {
      const hlat = parseFloat(hit.lat)
      const hlng = parseFloat(hit.lon)
      if (insideIndia(hlat, hlng)) {
        lat = hlat; lng = hlng
        if (!state) state = hit.address?.state || ''
        if (!city) city = hit.address?.city || hit.address?.county || hit.address?.state_district || ''
        validIndianPin = true
      }
    }
  } catch {
    /* fall through to synthetic fallback */
  }

  // If neither source recognised the PIN, it is not a valid Indian PIN.
  if (!validIndianPin) return null

  // Valid Indian PIN but no precise coordinates → India-clamped fallback.
  if (!isFinite(lat) || !isFinite(lng) || !insideIndia(lat, lng)) {
    ;[lat, lng] = pinToCoord(clean)
  }

  return { lat, lng, pin_code: clean, city, state }
}

/** Promise wrapper around the browser geolocation API. */
export function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator?.geolocation) {
      reject(new Error('Geolocation is not supported by this browser.'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => reject(err),
      { enableHighAccuracy: true, timeout: 15000 }
    )
  })
}

/** Capture GPS and resolve full location in one call. */
export async function captureLocation(): Promise<ResolvedLocation> {
  const { lat, lng } = await getCurrentPosition()
  try {
    return await reverseGeocode(lat, lng)
  } catch {
    return { lat, lng, pin_code: '', city: '', state: '' }
  }
}
