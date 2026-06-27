'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import TopNav from '@/components/TopNav'
import ProductSelect from '@/components/ProductSelect'

export default function SOSPage() {
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [category, setCategory] = useState('')
  const [flavour, setFlavour] = useState('')
  const [form, setForm] = useState({ pin_code: '', customer_phone: '' })
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [locationStatus, setLocationStatus] = useState('Detecting your location to find your PIN code…')
  const [autoPin, setAutoPin] = useState(false)

  useEffect(() => {
    if (!navigator?.geolocation) {
      setLocationStatus('Location is not available — please enter your PIN code manually.')
      return
    }

    navigator.geolocation.getCurrentPosition(
      async position => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setLocation({ lat, lng })

        // Reverse-geocode coordinates → PIN code
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
          )
          const data = await res.json()
          const pin = (data.postcode || '').replace(/\D/g, '').slice(0, 6)
          if (pin) {
            setForm(f => ({ ...f, pin_code: pin }))
            setAutoPin(true)
            setLocationStatus(`Detected PIN ${pin} from your location.`)
          } else {
            setLocationStatus('Location captured — please confirm your PIN code below.')
          }
        } catch {
          setLocationStatus('Location captured — please confirm your PIN code below.')
        }
      },
      () => {
        setLocationStatus('Allow location access to auto-fill your PIN, or enter it manually.')
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!category || !flavour) {
      setError('Please choose which product you couldn’t find.')
      return
    }
    setLoading(true)

    try {
      const { error: err } = await supabase.from('sos_reports').insert({
        pin_code: form.pin_code,
        product_name: `${category} — ${flavour}`,
        points_earned: 0,
        report_status: 'pending',
        customer_phone: form.customer_phone || null,
        location_lat: location?.lat ?? null,
        location_lng: location?.lng ?? null,
      })

      if (err) throw err
      if (form.customer_phone) { try { localStorage.setItem('madmap_phone', form.customer_phone) } catch {} }
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <>
        <TopNav />
        <main className="flex-1 flex items-center justify-center p-6 animate-page">
          <div className="bg-white rounded-3xl p-8 shadow-sm max-w-sm w-full text-center animate-slide-up">
            <div className="text-6xl mb-4 animate-celebrate">📍</div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: '#2C2347' }}>Report Received!</h1>
            <p className="text-sm mb-4" style={{ color: '#6E6788' }}>
              Your area is now on our demand map. Once verified you&apos;ll be rewarded with points.
            </p>
            <p className="text-sm mb-6" style={{ color: '#6E6788' }}>
              Thank you for helping us bring MadMix closer to you.
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/rewards" className="block w-full py-3 rounded-full text-white font-semibold" style={{ backgroundColor: '#7C5CC4' }}>
                🏆 View My Points
              </Link>
              <button
                onClick={() => { setSubmitted(false); setCategory(''); setFlavour('') }}
                className="w-full py-3 rounded-full font-semibold border-2"
                style={{ borderColor: '#E5394E', color: '#E5394E' }}
              >
                🆘 Report Another
              </button>
              <Link href="/" className="text-sm" style={{ color: '#6E6788' }}>Back to Home</Link>
            </div>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <TopNav />
      <main className="flex-1 p-6 flex items-center justify-center animate-page">
        <div className="w-full max-w-sm">
          {/* Bold red SOS banner */}
          <div className="rounded-3xl p-6 text-center text-white mb-5 animate-pulse-glow-red" style={{ background: 'linear-gradient(135deg, #E5394E, #C81E36)' }}>
            <div className="text-5xl mb-2">🆘</div>
            <h1 className="text-2xl font-extrabold">Bring MadMix Here</h1>
            <p className="text-sm opacity-95 mt-1">Can&apos;t find it? Report the stockout and put your area on the map.</p>
          </div>

          {/* Lavender, engaging form */}
          <div className="rounded-3xl p-6 shadow-sm" style={{ background: 'linear-gradient(160deg, #F4F0FD, #FFFFFF)' }}>
            {error && (
              <div className="mb-4 p-3 rounded-xl text-sm" style={{ backgroundColor: '#FCEDEF', color: '#E5394E' }}>{error}</div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <ProductSelect category={category} flavour={flavour} onCategory={setCategory} onFlavour={setFlavour} accent="#E5394E" />

              {/* Location → PIN */}
              <div className="rounded-2xl p-4 text-sm" style={{ backgroundColor: '#EFE9FB', color: '#6E6788' }}>
                <p className="font-medium flex items-center gap-1" style={{ color: '#2C2347' }}>📍 Your location</p>
                <p className="mt-1">{locationStatus}</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#2C2347' }}>
                  PIN Code * {autoPin && <span style={{ color: '#7CBE3F' }}>· auto-filled</span>}
                </label>
                <input
                  type="text" inputMode="numeric" maxLength={6} required
                  value={form.pin_code}
                  onChange={e => { setForm(f => ({ ...f, pin_code: e.target.value })); setAutoPin(false) }}
                  placeholder="6-digit PIN"
                  className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2"
                  style={{ borderColor: '#E5E7EB', color: '#2C2347' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#2C2347' }}>
                  Phone Number <span style={{ color: '#6E6788' }}>(optional — to receive points)</span>
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
                type="submit" disabled={loading}
                className="w-full py-4 rounded-full text-white font-bold text-lg mt-1 transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
                style={{ backgroundColor: '#E5394E', boxShadow: '0 10px 24px -8px rgba(229,57,78,0.8)' }}
              >
                {loading ? 'Reporting…' : '🆘 Report Stockout'}
              </button>
            </form>

            <p className="text-xs text-center mt-4" style={{ color: '#6E6788' }}>
              Your report helps MadMix prioritise distribution to your area.
            </p>
          </div>
        </div>
      </main>
    </>
  )
}
