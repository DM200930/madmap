'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import TopNav from '@/components/TopNav'
import ProductSelect from '@/components/ProductSelect'
import LocationPicker, { emptyLocation, hasLocation, type LocationState } from '@/components/LocationPicker'
import { POINTS } from '@/lib/types'

export default function FeedbackPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [category, setCategory] = useState('')
  const [flavour, setFlavour] = useState('')
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState<LocationState>(emptyLocation)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!category || !flavour) { setError('Please choose a product and flavour.'); return }
    if (!rating) { setError('Please rate your experience.'); return }
    if (!hasLocation(location)) { setError('Please share your location or enter a PIN code.'); return }

    setLoading(true)
    try {
      const points = POINTS.feedback
      const loc = location.share ? location.loc : null
      const payload = {
        product: category,
        flavour,
        rating,
        pin_code: location.share ? (loc?.pin_code || null) : (location.manualPin.trim() || null),
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

      router.push(`/success?earned=${points}&points=${total}&source=feedback`)
    } catch (err) {
      console.error('[Feedback] unexpected error:', err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
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

              <LocationPicker accent="#2F855A" onChange={setLocation} />

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
            </form>
          </div>
        </div>
      </main>
    </>
  )
}
