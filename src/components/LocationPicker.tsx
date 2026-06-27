'use client'

import { useState } from 'react'
import { captureHighAccuracyLocation, type ResolvedLocation } from '@/lib/location'

export interface LocationState {
  share: boolean
  loc: ResolvedLocation | null
  manualPin: string
  status: 'idle' | 'detecting' | 'ready' | 'denied'
}

export const emptyLocation: LocationState = { share: false, loc: null, manualPin: '', status: 'idle' }

/** Has the user provided a usable location by either method? */
export function hasLocation(s: LocationState) {
  return Boolean((s.share && s.loc) || s.manualPin.trim())
}

/**
 * Two-method location input shared by the SOS and Feedback forms.
 * Option 1: share current location (high-accuracy GPS → reverse geocoded).
 * Option 2: manual PIN entry. Only one is required.
 */
export default function LocationPicker({
  accent = '#7C5CC4',
  onChange,
}: {
  accent?: string
  onChange: (s: LocationState) => void
}) {
  const [state, setState] = useState<LocationState>(emptyLocation)

  function update(next: LocationState) {
    setState(next)
    onChange(next)
  }

  async function toggleShare(checked: boolean) {
    if (checked) {
      update({ share: true, loc: null, manualPin: '', status: 'detecting' })
      try {
        const r = await captureHighAccuracyLocation(50)
        update({ share: true, loc: r, manualPin: '', status: 'ready' })
      } catch {
        update({ share: false, loc: null, manualPin: state.manualPin, status: 'denied' })
      }
    } else {
      update({ share: false, loc: null, manualPin: state.manualPin, status: 'idle' })
    }
  }

  const { share, loc, manualPin, status } = state

  return (
    <div>
      <label className="block text-sm font-medium mb-2" style={{ color: '#2C2347' }}>Location *</label>

      <label className="flex items-center gap-3 cursor-pointer">
        <input type="checkbox" checked={share} onChange={e => toggleShare(e.target.checked)} className="w-5 h-5" style={{ accentColor: accent }} />
        <span className="text-sm" style={{ color: '#2C2347' }}>Share Current Location</span>
      </label>

      {/* Confirmation / status */}
      {share && status === 'detecting' && (
        <p className="text-xs mt-2" style={{ color: '#6E6788' }}>📍 Detecting your location…</p>
      )}
      {share && status === 'ready' && loc && (
        <p className="text-xs mt-2 font-medium" style={{ color: '#7CBE3F' }}>
          📍 Location captured{loc.city ? ` • ${loc.city}` : ''}{loc.pin_code ? ` • ${loc.pin_code}` : ''}{typeof loc.accuracy === 'number' ? ` • ±${Math.round(loc.accuracy)} m` : ''}
        </p>
      )}
      {status === 'denied' && (
        <p className="text-xs mt-2" style={{ color: '#E5394E' }}>Couldn&apos;t access location — enter your PIN code below instead.</p>
      )}

      {/* Manual PIN fallback */}
      {!share && (
        <input
          type="text" inputMode="numeric" maxLength={6}
          value={manualPin}
          onChange={e => update({ share: false, loc: null, manualPin: e.target.value, status })}
          placeholder="…or enter your 6-digit PIN code"
          className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 mt-2"
          style={{ borderColor: '#E5E7EB', color: '#2C2347' }}
        />
      )}
    </div>
  )
}
