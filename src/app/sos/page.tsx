'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { PRODUCTS, PLATFORMS, POINTS, type Platform } from '@/lib/types'

export default function SOSPage() {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    pin_code: '',
    product_name: PRODUCTS[0],
    platform: 'blinkit' as Platform,
    customer_phone: '',
  })
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null)
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationStatus, setLocationStatus] = useState('Detecting your current location...')

  useEffect(() => {
    if (!navigator?.geolocation) {
      setLocationStatus('Location is not available in this browser.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
        setLocationStatus('Location captured from this device.')
      },
      () => {
        setLocationStatus('Allow location access so we can record where the report was submitted from.')
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (!screenshotFile) {
      setError('Please attach a screenshot of the missing MadMix item to submit the report.')
      setLoading(false)
      return
    }

    try {
      const payload: Record<string, unknown> = {
        pin_code: form.pin_code,
        product_name: form.product_name,
        platform: form.platform,
        points_earned: 0,
        report_status: 'pending',
        customer_phone: form.customer_phone || null,
        location_lat: location?.lat ?? null,
        location_lng: location?.lng ?? null,
      }

      const { error: err } = await supabase.from('sos_reports').insert(payload)

      if (err) throw err
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: '#F7F4FD' }}>
        <div className="bg-white rounded-2xl p-8 shadow-sm max-w-sm w-full text-center animate-slide-up">
          <div className="text-6xl mb-4 animate-celebrate">📍</div>
          <h1 className="text-2xl font-bold mb-2" style={{ color: '#2C2347' }}>Report Received!</h1>
          <p className="text-sm mb-4" style={{ color: '#6E6788' }}>
            Your report is now pending review. Once verified, you will be awarded <span className="font-bold" style={{ color: '#7C5CC4' }}>+{POINTS.sos_report} points</span>.
          </p>
          <p className="text-sm mb-6" style={{ color: '#6E6788' }}>
            We captured the location information from your device and the screenshot has been included with your report.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/rewards"
              className="block w-full py-3 rounded-full text-white font-semibold"
              style={{ backgroundColor: '#7C5CC4' }}
            >
              🏆 View My Points
            </Link>
            <button
              onClick={() => setSubmitted(false)}
              className="w-full py-3 rounded-full font-semibold border-2"
              style={{ borderColor: '#E5394E', color: '#E5394E' }}
            >
              🆘 Report Another
            </button>
            <Link href="/" className="text-sm" style={{ color: '#6E6788' }}>
              Back to Home
            </Link>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen p-6 flex items-center justify-center" style={{ backgroundColor: '#F7F4FD' }}>
      <div className="bg-white rounded-2xl p-8 shadow-sm max-w-sm w-full">
        <div className="text-center mb-6">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3"
            style={{ backgroundColor: '#FCEDEF' }}
          >
            🆘
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#2C2347' }}>Bring MadMix Here</h1>
          <p className="text-sm mt-1" style={{ color: '#6E6788' }}>
            Can't find MadMix? Report it and earn{' '}
            <span className="font-bold" style={{ color: '#7C5CC4' }}>+{POINTS.sos_report} points</span>.
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl text-sm" style={{ backgroundColor: '#FCEDEF', color: '#E5394E' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#2C2347' }}>Your PIN Code *</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={form.pin_code}
              onChange={e => setForm(f => ({ ...f, pin_code: e.target.value }))}
              placeholder="Enter your 6-digit PIN"
              className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2"
              style={{ borderColor: '#E5E7EB', color: '#2C2347' }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#2C2347' }}>Product you couldn't find *</label>
            <select
              required
              value={form.product_name}
              onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))}
              className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 bg-white"
              style={{ borderColor: '#E5E7EB', color: '#2C2347' }}
            >
              {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#2C2347' }}>Where did you check? *</label>
            <div className="grid grid-cols-2 gap-2">
              {PLATFORMS.map(pl => (
                <button
                  type="button"
                  key={pl.value}
                  onClick={() => setForm(f => ({ ...f, platform: pl.value }))}
                  className="py-2 px-3 rounded-xl border text-sm font-medium transition-all"
                  style={{
                    borderColor: form.platform === pl.value ? '#E5394E' : '#E5E7EB',
                    backgroundColor: form.platform === pl.value ? '#FCEDEF' : 'white',
                    color: form.platform === pl.value ? '#E5394E' : '#6E6788',
                  }}
                >
                  {pl.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-[#FBF3DA] border border-[#FDE68A] p-4 text-sm" style={{ color: '#6E6788' }}>
            <p className="font-medium" style={{ color: '#2C2347' }}>Current location</p>
            <p className="mt-1">{location ? `${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}` : locationStatus}</p>
            <p className="text-xs mt-2">We use your current location to validate where the SOS request was submitted from.</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#2C2347' }}>Screenshot of missing item *</label>
            <input
              type="file"
              accept="image/*"
              required
              onChange={e => setScreenshotFile(e.target.files?.[0] ?? null)}
              className="w-full text-sm outline-none"
            />
            {screenshotFile && (
              <p className="text-xs mt-2" style={{ color: '#2C2347' }}>
                Attached: {screenshotFile.name}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#2C2347' }}>
              Phone Number <span style={{ color: '#6E6788' }}>(optional — to receive points after review)</span>
            </label>
            <input
              type="tel"
              value={form.customer_phone}
              onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))}
              placeholder="+91 98765 43210"
              className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2"
              style={{ borderColor: '#E5E7EB', color: '#2C2347' }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 rounded-full text-white font-bold text-lg mt-2 transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
            style={{ backgroundColor: '#E5394E' }}
          >
            {loading ? 'Reporting...' : '🆘 Report Stockout'}
          </button>
        </form>

        <p className="text-xs text-center mt-4" style={{ color: '#6E6788' }}>
          Your report helps MadMix prioritise distribution to your area.
        </p>

        <div className="mt-4 text-center">
          <Link href="/" className="text-sm" style={{ color: '#6E6788' }}>
            ← Back to Home
          </Link>
        </div>
      </div>
    </main>
  )
}
