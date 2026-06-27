'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import TopNav from '@/components/TopNav'
import ProductSelect from '@/components/ProductSelect'
import LocationPicker, { emptyLocation, hasLocation, type LocationState } from '@/components/LocationPicker'
import { POINTS } from '@/lib/types'
import { uploadScreenshot } from '@/lib/upload'

export default function SOSPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [category, setCategory] = useState('')
  const [flavour, setFlavour] = useState('')
  const [phone, setPhone] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [location, setLocation] = useState<LocationState>(emptyLocation)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!category || !flavour) { setError('Please choose which product you couldn’t find.'); return }
    if (!hasLocation(location)) { setError('Please share your location or enter a PIN code.'); return }
    setLoading(true)

    try {
      // Optional evidence upload (never blocks submission)
      let screenshot_url: string | null = null
      if (file) screenshot_url = await uploadScreenshot(file)

      const points = POINTS.sos_report
      const loc = location.share ? location.loc : null
      const payload = {
        product: category,
        flavour,
        product_name: `${category} — ${flavour}`,
        pin_code: location.share ? (loc?.pin_code || null) : (location.manualPin.trim() || null),
        city: loc?.city || null,
        state: loc?.state || null,
        location_lat: loc?.lat ?? null,
        location_lng: loc?.lng ?? null,
        screenshot_url,
        points_earned: points,
        report_status: 'pending',
        customer_phone: phone || null,
      }

      const { error: insertErr } = await supabase.from('sos_reports').insert(payload)
      if (insertErr) {
        console.error('[SOS] insert failed:', insertErr.message, insertErr.details, payload)
        setError(`Could not submit report: ${insertErr.message}`)
        setLoading(false)
        return
      }

      let total = points
      if (phone) {
        try { localStorage.setItem('madmap_phone', phone) } catch {}
        const { error: rpcErr } = await supabase.rpc('add_customer_points', { p_phone: phone, p_points: points, p_scan: false })
        if (rpcErr) console.error('[SOS] points RPC failed:', rpcErr.message)
        const { data: cust } = await supabase.from('customers').select('total_points').eq('phone', phone).single()
        if (cust?.total_points) total = cust.total_points
      }

      router.push(`/success?earned=${points}&points=${total}&source=sos`)
    } catch (err) {
      console.error('[SOS] unexpected error:', err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
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

              <LocationPicker accent="#E5394E" onChange={setLocation} />

              {/* Evidence upload */}
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: '#2C2347' }}>Upload Screenshot</label>
                <p className="text-xs mb-2" style={{ color: '#6E6788' }}>
                  Upload a photo showing that the product is unavailable (optional but recommended).
                </p>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:text-white file:bg-[#E5394E]"
                  style={{ color: '#6E6788' }}
                />
                {file && <p className="text-xs mt-2" style={{ color: '#7CBE3F' }}>📎 {file.name}</p>}
              </div>

              {/* Phone (optional, never blocks) */}
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
                style={{ backgroundColor: '#E5394E', boxShadow: '0 10px 24px -8px rgba(229,57,78,0.8)' }}
              >
                {loading ? 'Reporting…' : '🆘 Report Stockout'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </>
  )
}
