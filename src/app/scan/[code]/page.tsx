'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { PLATFORMS, POINTS, type Platform } from '@/lib/types'
import ProductSelect from '@/components/ProductSelect'

type Step = 'form' | 'success' | 'already_used'

export default function ScanPage() {
  const params = useParams()
  const code = params.code as string

  const [step, setStep] = useState<Step>('form')
  const [pointsEarned, setPointsEarned] = useState(0)
  const [bonusEarned, setBonusEarned] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [category, setCategory] = useState('')
  const [flavour, setFlavour] = useState('')
  const [form, setForm] = useState({
    pin_code: '',
    platform: 'blinkit' as Platform,
    rating: 5,
    would_buy_again: true,
    customer_phone: '',
  })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!category || !flavour) {
      setError('Please choose your product and flavour.')
      return
    }
    setLoading(true)
    const product_name = `${category} — ${flavour}`

    try {
      const { data: qr, error: qrErr } = await supabase
        .from('qr_codes')
        .select('*')
        .eq('code', code)
        .single()

      if (qrErr || !qr) {
        setError('Invalid QR code. Please check and try again.')
        setLoading(false)
        return
      }

      if (qr.is_redeemed) {
        setStep('already_used')
        setLoading(false)
        return
      }

      const points = qr.first_scan ? POINTS.first_scan : POINTS.regular_scan

      const { error: scanErr } = await supabase.from('scans').insert({
        qr_code: code,
        pin_code: form.pin_code,
        product_name,
        platform: form.platform,
        rating: form.rating,
        would_buy_again: form.would_buy_again,
        points_earned: points,
        customer_phone: form.customer_phone || null,
      })

      if (scanErr) throw scanErr

      await supabase.from('qr_codes').update({ is_redeemed: true }).eq('code', code)

      let bonus = 0
      if (form.customer_phone) {
        try { localStorage.setItem('madmap_phone', form.customer_phone) } catch {}
        await supabase.rpc('add_customer_points', {
          p_phone: form.customer_phone,
          p_points: points,
          p_scan: true,
        })

        // 5-scan streak bonus: +250 on every 5th scan
        const { data: cust } = await supabase
          .from('customers')
          .select('total_scans')
          .eq('phone', form.customer_phone)
          .single()

        if (cust && cust.total_scans > 0 && cust.total_scans % 5 === 0) {
          bonus = POINTS.scan_streak_5
          await supabase.rpc('add_customer_points', {
            p_phone: form.customer_phone,
            p_points: bonus,
            p_scan: false,
          })
        }
      }

      setPointsEarned(points)
      setBonusEarned(bonus)
      setStep('success')
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'already_used') {
    return (
      <Overlay>
        <div className="text-5xl mb-4">😕</div>
        <h1 className="text-xl font-bold mb-2" style={{ color: '#2C2347' }}>Already Redeemed</h1>
        <p className="text-sm mb-6" style={{ color: '#6E6788' }}>
          This QR code has already been used. Each code can only be scanned once.
        </p>
        <Link href="/" className="block w-full py-3 rounded-full text-white font-semibold text-center" style={{ backgroundColor: '#7C5CC4' }}>
          Back to Home
        </Link>
      </Overlay>
    )
  }

  if (step === 'success') {
    const total = pointsEarned + bonusEarned
    return (
      <Overlay>
        <Confetti />
        <div className="text-6xl mb-4 animate-celebrate">🎉</div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: '#2C2347' }}>You earned points!</h1>
        <div className="text-6xl font-bold my-4 animate-count-up" style={{ color: '#7C5CC4' }}>+{total}</div>
        {bonusEarned > 0 && (
          <p className="text-sm font-semibold mb-2" style={{ color: '#EE7B30' }}>
            🔥 +{bonusEarned} bonus for your 5-scan streak!
          </p>
        )}
        <p className="text-sm mb-6" style={{ color: '#6E6788' }}>
          Thanks for scanning your MadMix packet. Keep scanning to unlock more rewards!
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/rewards" className="block w-full py-3 rounded-full text-white font-semibold" style={{ backgroundColor: '#7C5CC4' }}>
            🏆 View My Rewards
          </Link>
          <Link href="/sos" className="block w-full py-3 rounded-full font-semibold border-2" style={{ borderColor: '#E5394E', color: '#E5394E' }}>
            🆘 Report Unavailable Product
          </Link>
          <Link href="/" className="text-sm" style={{ color: '#6E6788' }}>Back to Home</Link>
        </div>
      </Overlay>
    )
  }

  // Auto-open question popup
  return (
    <Overlay wide>
      <div className="text-center mb-5">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3" style={{ backgroundColor: '#F1ECFC' }}>📦</div>
        <h1 className="text-2xl font-bold" style={{ color: '#2C2347' }}>Quick Questions</h1>
        <p className="text-sm mt-1" style={{ color: '#6E6788' }}>Answer to claim your points · <span className="font-mono">{code}</span></p>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl text-sm" style={{ backgroundColor: '#FCEDEF', color: '#E5394E' }}>{error}</div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
        <ProductSelect category={category} flavour={flavour} onCategory={setCategory} onFlavour={setFlavour} />

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#2C2347' }}>PIN Code *</label>
          <input
            type="text" inputMode="numeric" maxLength={6} required
            value={form.pin_code}
            onChange={e => setForm(f => ({ ...f, pin_code: e.target.value }))}
            placeholder="Enter your 6-digit PIN"
            className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2"
            style={{ borderColor: '#E5E7EB', color: '#2C2347' }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#2C2347' }}>Where did you buy it? *</label>
          <div className="grid grid-cols-2 gap-2">
            {PLATFORMS.map(pl => (
              <button
                type="button" key={pl.value}
                onClick={() => setForm(f => ({ ...f, platform: pl.value }))}
                className="py-2 px-3 rounded-xl border text-sm font-medium transition-all"
                style={{
                  borderColor: form.platform === pl.value ? '#7C5CC4' : '#E5E7EB',
                  backgroundColor: form.platform === pl.value ? '#F1ECFC' : 'white',
                  color: form.platform === pl.value ? '#7C5CC4' : '#6E6788',
                }}
              >
                {pl.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: '#2C2347' }}>Rating: {form.rating}/5</label>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map(n => (
              <button type="button" key={n} onClick={() => setForm(f => ({ ...f, rating: n }))} className="text-2xl transition-transform hover:scale-110">
                {n <= form.rating ? '⭐' : '☆'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, would_buy_again: !f.would_buy_again }))}
            className="w-6 h-6 rounded flex items-center justify-center border-2 transition-colors flex-shrink-0"
            style={{ borderColor: '#7C5CC4', backgroundColor: form.would_buy_again ? '#7C5CC4' : 'white' }}
          >
            {form.would_buy_again && <span className="text-white text-xs">✓</span>}
          </button>
          <label className="text-sm" style={{ color: '#2C2347' }}>Would you buy MadMix again?</label>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" style={{ color: '#2C2347' }}>
            Phone Number <span style={{ color: '#6E6788' }}>(to track your points)</span>
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
          className="w-full py-4 rounded-full text-white font-bold text-lg mt-2 transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
          style={{ backgroundColor: '#7C5CC4' }}
        >
          {loading ? 'Claiming...' : '🎁 Claim Points'}
        </button>
      </form>
    </Overlay>
  )
}

/** Dimmed full-screen backdrop with a centered card — the auto-opening popup. */
function Overlay({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="fixed inset-0 z-20 flex items-center justify-center p-4 overflow-y-auto" style={{ backgroundColor: 'rgba(44,35,71,0.55)' }}>
      <div className={`relative bg-white rounded-3xl p-7 w-full ${wide ? 'max-w-md' : 'max-w-sm'} my-8 shadow-2xl animate-slide-up text-center`}>
        {children}
      </div>
    </main>
  )
}

function Confetti() {
  const colors = ['#7C5CC4', '#EE7B30', '#F5B301', '#7CBE3F', '#34B5E5', '#EA4C89']
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0 overflow-visible">
      {Array.from({ length: 24 }).map((_, i) => (
        <span
          key={i}
          style={{
            position: 'absolute',
            left: `${(i / 24) * 100}%`,
            top: 0,
            width: 8,
            height: 12,
            borderRadius: 2,
            backgroundColor: colors[i % colors.length],
            animation: `confetti-fall ${1 + (i % 5) * 0.25}s ease-in ${(i % 6) * 0.1}s forwards`,
          }}
        />
      ))}
    </div>
  )
}
