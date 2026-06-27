export interface ResolvedLocation {
  lat: number
  lng: number
  pin_code: string
  city: string
  state: string
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
