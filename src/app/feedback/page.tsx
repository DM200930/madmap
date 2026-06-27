'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import TopNav from '@/components/TopNav'
import ProductSelect from '@/components/ProductSelect'
import RewardSuccess from '@/components/RewardSuccess'
import { POINTS } from '@/lib/types'
import { captureLocation, type ResolvedLocation } from '@/lib/location'

export default function FeedbackPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [category, setCategory] = useState('')
  const [flavour, setFlavour] = useState('')
  const [message, setMessage] = useState('')
  const [phone, setPhone] = useState('')

  // Location: two methods, only one required
  const [share, setShare] = useState(false)
  const [manualPin, setManualPin] = useState('')
  const [loc, setLoc] = useState<ResolvedLocation | null>(null)
  const [locState, setLocState] = useState<'idle' | 'detecting' | 'ready' | 'denied'>('idle')

  const [done, setDone] = useState(false)
  const [earned, setEarned] = useState(0)
  const [currentPoints, setCurrentPoints] = useState(0)

  async function toggleShare(checked: boolean) {
    setShare(checked)
    if (checked) {
      setLocState('detecting')
      try {
        const r = await captureLocation()
        setLoc(r)
        setLocState('ready')
        if (r.pin_code) setManualPin('')
      } catch {
        setLocState('denied')
        setShare(false)
      }
    } else {
      setLoc(null)
      setLocState('idle')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!category || !flavour) { setError('Please choose a product and flavour.'); return }
    if (!message.trim()) { setError('Please share your feedback.'); return }
    const hasLocation = (share && loc) || manualPin.trim()
    if (!hasLocation) { setError('Please share your location or enter a PIN code.'); return }

    setLoading(true)
    try {
      const points = POINTS.feedback
      const payload = {
        product: category,
        flavour,
        message: message.trim(),
        pin_code: share ? (loc?.pin_code || null) : (manualPin.trim() || null),
        city: share ? (loc?.city || null) : null,
        state: share ? (loc?.state || null) : null,
        location_lat: share ? (loc?.lat ?? null) : null,
        location_lng: share ? (loc?.lng ?? null) : null,
        customer_phone: phone || null,
        points_earned: points,
      }

      const { error: insertErr } = await supabase.from('feedback').insert(payload)
      if (insertErr) {
        console.error('[Feedback] insert failed:', insertErr.message, insertErr.details, payload)
        setError(`Could not submit feedback: ${insertErr.message}`)
        setLoading(false)
        return
      }

      let total = points
      if (phone) {
        try { localStorage.setItem('madmap_phone', phone) } catch {}
        const { error: rpcErr } = await supabase.rpc('award_points', { p_phone: phone, p_points: points })
        if (rpcErr) console.error('[Feedback] points RPC failed:', rpcErr.message)
        const { data: cust } = await supabase.from('customers').select('total_points').eq('phone', phone).single()
        if (cust?.total_points) total = cust.total_points
      }

      setEarned(points)
      setCurrentPoints(total)
      setDone(true)
    } catch (err) {
      console.error('[Feedback] unexpected error:', err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <>
        <TopNav />
        <RewardSuccess
          earned={earned}
          currentPoints={currentPoints}
          headline="🎉 Thanks for helping MadMix!"
          subtext={`We love hearing from you. You earned +${earned} points for your feedback.`}
        />
      </>
    )
  }

  return (
    <>
      <TopNav />
      <main className="flex-1 p-6 flex items-center justify-center animate-page">
        <div className="w-full max-w-sm">
          {/* Green banner (matches the home "tell us" button) */}
          <div className="rounded-3xl p-6 text-center text-white mb-5 animate-pulse-glow" style={{ background: 'linear-gradient(135deg, #2F855A, #1E5C3F)' }}>
            <div className="text-5xl mb-2">💬</div>
            <h1 className="text-2xl font-extrabold">We&apos;d Love Your Feedback</h1>
            <p className="text-sm opacity-95 mt-1">We&apos;re a startup — tell us what you loved and what to build next.</p>
          </div>

          <div className="rounded-3xl p-6 shadow-sm" style={{ background: 'linear-gradient(160deg, #F4F0FD, #FFFFFF)' }}>
            {error && (
              <div className="mb-4 p-3 rounded-xl text-sm" style={{ backgroundColor: '#FCEDEF', color: '#E5394E' }}>{error}</div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <ProductSelect category={category} flavour={flavour} onCategory={setCategory} onFlavour={setFlavour} accent="#2F855A" />

              {/* Location — two methods, only one required */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#2C2347' }}>Location</label>
                <label className="flex items-center gap-3 cursor-pointer mb-2">
                  <input type="checkbox" checked={share} onChange={e => toggleShare(e.target.checked)} className="w-5 h-5 accent-[#7C5CC4]" />
                  <span className="text-sm" style={{ color: '#2C2347' }}>
                    Share Current Location
                    {locState === 'detecting' && <span style={{ color: '#6E6788' }}> · detecting…</span>}
                    {locState === 'ready' && loc && <span style={{ color: '#7CBE3F' }}> · {loc.city || 'located'}{loc.pin_code ? ` ${loc.pin_code}` : ''}</span>}
                    {locState === 'denied' && <span style={{ color: '#E5394E' }}> · permission denied</span>}
                  </span>
                </label>
                {!share && (
                  <input
                    type="text" inputMode="numeric" maxLength={6}
                    value={manualPin}
                    onChange={e => setManualPin(e.target.value)}
                    placeholder="…or enter your 6-digit PIN code"
                    className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2"
                    style={{ borderColor: '#E5E7EB', color: '#2C2347' }}
                  />
                )}
              </div>

              {/* Feedback */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#2C2347' }}>Your Feedback *</label>
                <textarea
                  required rows={4} value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Tell us what you loved, what we can improve, or what products you'd like to see."
                  className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 resize-none"
                  style={{ borderColor: '#E5E7EB', color: '#2C2347' }}
                />
              </div>

              {/* Phone (optional) */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#2C2347' }}>
                  Phone Number <span style={{ color: '#6E6788' }}>(optional — to receive points)</span>
                </label>
                <input
                  type="tel" value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2"
                  style={{ borderColor: '#E5E7EB', color: '#2C2347' }}
                />
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full py-4 rounded-full text-white font-bold text-lg mt-1 transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
                style={{ backgroundColor: '#2F855A', boxShadow: '0 10px 24px -8px rgba(47,133,90,0.7)' }}
              >
                {loading ? 'Sending…' : 'Let Us Know!'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </>
  )
}
