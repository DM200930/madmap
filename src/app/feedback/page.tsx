'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import TopNav from '@/components/TopNav'
import ProductSelect from '@/components/ProductSelect'
import RewardSuccess from '@/components/RewardSuccess'
import { POINTS } from '@/lib/types'
import { captureHighAccuracyLocation, type ResolvedLocation } from '@/lib/location'

export default function FeedbackPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [category, setCategory] = useState('')
  const [flavour, setFlavour] = useState('')
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [phone, setPhone] = useState('')

  const [loc, setLoc] = useState<ResolvedLocation | null>(null)
  const [locState, setLocState] = useState<'detecting' | 'ready' | 'denied'>('detecting')

  const [done, setDone] = useState(false)
  const [earned, setEarned] = useState(0)
  const [currentPoints, setCurrentPoints] = useState(0)

  // Automatically request a high-accuracy (~50 m) location on open.
  useEffect(() => {
    let cancelled = false
    setLocState('detecting')
    captureHighAccuracyLocation(50)
      .then(r => { if (!cancelled) { setLoc(r); setLocState('ready') } })
      .catch(() => { if (!cancelled) setLocState('denied') })
    return () => { cancelled = true }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!category || !flavour) { setError('Please choose a product and flavour.'); return }
    if (!rating) { setError('Please rate your experience.'); return }

    setLoading(true)
    try {
      const points = POINTS.feedback
      const payload = {
        product: category,
        flavour,
        rating,
        pin_code: loc?.pin_code || null,
        city: loc?.city || null,
        state: loc?.state || null,
        location_lat: loc?.lat ?? null,
        location_lng: loc?.lng ?? null,
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
          subtext={`Thanks for rating us. You earned +${earned} points for your feedback.`}
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
            <p className="text-sm opacity-95 mt-1">We&apos;re a startup — your rating helps us build what you want next.</p>
          </div>

          <div className="rounded-3xl p-6 shadow-sm" style={{ background: 'linear-gradient(160deg, #F4F0FD, #FFFFFF)' }}>
            {error && (
              <div className="mb-4 p-3 rounded-xl text-sm" style={{ backgroundColor: '#FCEDEF', color: '#E5394E' }}>{error}</div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <ProductSelect category={category} flavour={flavour} onCategory={setCategory} onFlavour={setFlavour} accent="#2F855A" />

              {/* 5-star rating */}
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#2C2347' }}>Rate your experience *</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      type="button" key={n}
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHover(n)}
                      onMouseLeave={() => setHover(0)}
                      className="text-4xl transition-transform hover:scale-125 active:scale-110"
                      aria-label={`${n} star${n > 1 ? 's' : ''}`}
                    >
                      {n <= (hover || rating) ? '⭐' : '☆'}
                    </button>
                  ))}
                  {rating > 0 && <span className="ml-2 text-sm font-semibold" style={{ color: '#2F855A' }}>{rating}/5</span>}
                </div>
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

              <p className="text-xs text-center" style={{ color: '#6E6788' }}>
                {locState === 'detecting' && '📍 Detecting your location…'}
                {locState === 'ready' && `📍 Location captured${loc?.city ? ` · ${loc.city}` : ''}${loc?.pin_code ? ` · ${loc.pin_code}` : ''}${loc?.accuracy ? ` · ±${Math.round(loc.accuracy)}m` : ''}`}
                {locState === 'denied' && '📍 Location off — enabling it helps us map where to improve.'}
              </p>
            </form>
          </div>
        </div>
      </main>
    </>
  )
}
