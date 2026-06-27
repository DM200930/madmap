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
 * Resolve a manually entered 6-digit Indian PIN code to real coordinates.
 *
 * Strategy:
 *  1. Validate the PIN via the India Post API. Invalid → return null.
 *  2. From the response, take the Post Office, District and State.
 *  3. Geocode by place name ("Post Office, District, State, India", then
 *     "District, State, India") with countrycodes=in — far more reliable than
 *     geocoding a raw PIN.
 *  4. Choose a result inside India.
 *
 * There is NO synthetic fallback: a valid PIN either resolves to real
 * coordinates or returns null (so the form shows the validation message).
 */
export async function geocodeIndianPin(pin: string): Promise<ResolvedLocation | null> {
  const clean = (pin || '').replace(/\D/g, '').slice(0, 6)
  if (clean.length !== 6) return null

  // 1) Validate + name the PIN using India Post (an India-only dataset).
  let postOffice = ''
  let district = ''
  let state = ''
  try {
    const res = await fetch(`https://api.postalpincode.in/pincode/${clean}`)
    const json = await res.json()
    const rec = Array.isArray(json) ? json[0] : null
    if (!rec || rec.Status !== 'Success' || !rec.PostOffice?.length) return null
    const po = rec.PostOffice[0]
    postOffice = po.Name || po.Block || ''
    district = po.District || ''
    state = po.State || ''
  } catch {
    // Could not validate the PIN → treat as unresolved (no synthetic coords).
    return null
  }

  // 2) Build place-name queries from the postal data, most specific first.
  const queries = [
    [postOffice, district, state, 'India'],
    [district, state, 'India'],
  ]
    .map(parts => parts.filter(Boolean).join(', '))
    .filter((q, i, arr) => q && arr.indexOf(q) === i)

  // 3) Geocode each candidate, restricted to India, choosing a result in India.
  for (const q of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=in&addressdetails=1&limit=5&q=${encodeURIComponent(q)}`
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      const data = await res.json()
      if (!Array.isArray(data)) continue
      const hit = data.find(d => {
        const la = parseFloat(d?.lat)
        const ln = parseFloat(d?.lon)
        return d?.address?.country_code === 'in' && insideIndia(la, ln)
      })
      if (hit) {
        return {
          lat: parseFloat(hit.lat),
          lng: parseFloat(hit.lon),
          pin_code: clean,
          city: district || hit.address?.city || hit.address?.state_district || '',
          state,
        }
      }
    } catch {
      // try the next, coarser query
    }
  }

  // Valid Indian PIN but no real coordinates found → fail (no estimation).
  return null
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
