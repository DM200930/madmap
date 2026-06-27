'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import TopNav from '@/components/TopNav'
import type { SupplyPin } from '@/components/AdminMap'

const AdminMap = dynamic(() => import('@/components/AdminMap'), { ssr: false })

const ADMIN_PASSCODE = 'madmix'
const AVG_ORDER_VALUE = 120 // ₹ assumed revenue per scanned pack/order
const QOQ_GROWTH = 0.12 // assumed quarter-on-quarter growth used for the rolling projection

interface Row { pin_code: string; product_name: string; created_at: string }

// Pairing / association suggestions per product line
const ASSOCIATIONS: { category: string; icon: string; pairs: string[]; brands: string[] }[] = [
  {
    category: 'Bhujia',
    icon: '🌶️',
    pairs: ['Masala chai & filter coffee', 'Cold drinks / sodas', 'Instant noodles topping', 'Chaat & sandwich mix-ins'],
    brands: ['Coca-Cola / Thums Up (namkeen + cola combos)', 'Tata Tea / Wagh Bakri (chai-time bundles)', 'Maggi (topping co-branding)', 'Amul (chaas + namkeen)'],
  },
  {
    category: 'Puffs',
    icon: '🍿',
    pairs: ['Movie & gaming snacking', 'Kids’ tiffin & lunchboxes', 'Dips & cheese spreads', 'Cold coffee / milkshakes'],
    brands: ['PVR / BookMyShow (cinema combos)', 'Netflix / JioCinema (watch-party packs)', 'Amul / Go Cheese (dip pairings)', 'Frooti / Paper Boat (kids combos)'],
  },
  {
    category: 'Raisins',
    icon: '🍇',
    pairs: ['Yogurt & smoothie bowls', 'Trail-mix & granola', 'Baking & desserts', 'Pre/post-workout snacking'],
    brands: ['Epigamia / Milky Mist (yogurt toppers)', 'Yoga Bar / RiteBite (trail-mix bars)', 'cure.fit / HealthifyMe (fitness boxes)', 'Whole Foods style D2C bakeries'],
  },
]

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [code, setCode] = useState('')
  const [err, setErr] = useState(false)

  const [scans, setScans] = useState<Row[]>([])
  const [sos, setSos] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [goal, setGoal] = useState('')

  useEffect(() => {
    try { if (sessionStorage.getItem('madmap_admin') === '1') setAuthed(true) } catch {}
  }, [])

  useEffect(() => {
    if (!authed) return
    async function load() {
      const [s, r] = await Promise.all([
        supabase.from('scans').select('pin_code, product_name, created_at'),
        supabase.from('sos_reports').select('pin_code, product_name, created_at'),
      ])
      setScans((s.data as Row[]) || [])
      setSos((r.data as Row[]) || [])
      setLoading(false)
    }
    load()
  }, [authed])

  // Build green (supplied) / red (unmet) supply-demand pins
  const pins: SupplyPin[] = useMemo(() => {
    const supplied = new Map<string, SupplyPin>()
    scans.forEach(s => {
      const k = s.pin_code
      if (!k) return
      if (!supplied.has(k)) supplied.set(k, { pin_code: k, count: 0, status: 'supplied', products: [] })
      const p = supplied.get(k)!
      p.count++
      if (s.product_name && !p.products.includes(s.product_name)) p.products.push(s.product_name)
    })
    const unmet = new Map<string, SupplyPin>()
    sos.forEach(r => {
      const k = r.pin_code
      if (!k || supplied.has(k)) return // demand met elsewhere → green wins
      if (!unmet.has(k)) unmet.set(k, { pin_code: k, count: 0, status: 'unmet', products: [] })
      const p = unmet.get(k)!
      p.count++
      if (r.product_name && !p.products.includes(r.product_name)) p.products.push(r.product_name)
    })
    return [...supplied.values(), ...unmet.values()]
  }, [scans, sos])

  // Sales projections from scan run-rate
  const projections = useMemo(() => {
    const now = Date.now()
    const within = (days: number) => scans.filter(s => now - new Date(s.created_at).getTime() <= days * 86400000).length
    const last30 = within(30)
    // fall back to a small demo baseline so the console is never empty
    const dailyRate = Math.max(last30 / 30, scans.length / 90 || 0, 6)
    const weekly = dailyRate * 7
    const monthly = dailyRate * 30
    const quarterUnits = dailyRate * 91 * (1 + QOQ_GROWTH)
    return {
      dailyRate,
      weekly: { units: Math.round(weekly), revenue: Math.round(weekly * AVG_ORDER_VALUE) },
      monthly: { units: Math.round(monthly), revenue: Math.round(monthly * AVG_ORDER_VALUE) },
      quarter: { units: Math.round(quarterUnits), revenue: Math.round(quarterUnits * AVG_ORDER_VALUE) },
    }
  }, [scans])

  const greenCount = pins.filter(p => p.status === 'supplied').length
  const redCount = pins.filter(p => p.status === 'unmet').length

  // Revenue-goal planner
  const plan = useMemo(() => {
    const target = parseFloat(goal.replace(/[^\d.]/g, ''))
    if (!target || target <= 0) return null
    const projected = projections.quarter.revenue
    const gap = target - projected
    const extraUnits = Math.max(0, Math.ceil(gap / AVG_ORDER_VALUE))
    const extraPerDay = Math.ceil(extraUnits / 91)
    const newPins = Math.ceil(extraUnits / Math.max(projections.monthly.units / Math.max(greenCount, 1), 8))
    return { target, projected, gap, extraUnits, extraPerDay, newPins, onTrack: gap <= 0 }
  }, [goal, projections, greenCount])

  function unlock(e: React.FormEvent) {
    e.preventDefault()
    if (code.trim().toLowerCase() === ADMIN_PASSCODE) {
      try { sessionStorage.setItem('madmap_admin', '1') } catch {}
      setAuthed(true)
    } else setErr(true)
  }

  // Lock gate
  if (!authed) {
    return (
      <>
        <TopNav />
        <main className="flex-1 flex items-center justify-center p-6 animate-page">
          <form onSubmit={unlock} className="bg-white rounded-3xl p-8 w-full max-w-xs text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3" style={{ backgroundColor: '#F1ECFC' }}>🔒</div>
            <h1 className="text-xl font-bold mb-1" style={{ color: '#2C2347' }}>Administrator Access</h1>
            <p className="text-sm mb-5" style={{ color: '#6E6788' }}>This is the internal MadMix strategy console.</p>
            <input
              autoFocus type="password" value={code}
              onChange={e => { setCode(e.target.value); setErr(false) }}
              placeholder="Passcode"
              className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 text-center"
              style={{ borderColor: err ? '#E5394E' : '#E5E7EB', color: '#2C2347' }}
            />
            {err && <p className="text-xs mt-2" style={{ color: '#E5394E' }}>Incorrect passcode.</p>}
            <button type="submit" className="w-full mt-4 py-3 rounded-full text-white font-semibold" style={{ backgroundColor: '#7C5CC4' }}>Unlock</button>
            <Link href="/" className="block text-xs mt-4" style={{ color: '#6E6788' }}>← Back to site</Link>
          </form>
        </main>
      </>
    )
  }

  const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

  return (
    <>
      <TopNav />
      <main className="flex-1 p-6 animate-page">
        <div className="max-w-5xl mx-auto flex flex-col gap-8">
          <div>
            <h1 className="text-3xl font-extrabold" style={{ color: '#2C2347' }}>🔐 Administrator Console</h1>
            <p className="text-sm" style={{ color: '#6E6788' }}>Pan-India supply vs demand, sales projections & growth strategy.</p>
          </div>

          {/* Pan-India supply/demand map */}
          <section className="bg-white rounded-3xl p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-xl font-bold" style={{ color: '#2C2347' }}>Demand vs Supply — Pan India</h2>
                <p className="text-sm" style={{ color: '#6E6788' }}>Where MadMix is reaching customers, and where demand is going unmet.</p>
              </div>
              <div className="flex gap-4 text-sm font-medium">
                <span className="flex items-center gap-1" style={{ color: '#7CBE3F' }}>🟢 Demand &amp; supply ({greenCount})</span>
                <span className="flex items-center gap-1" style={{ color: '#E5394E' }}>🔴 Demand, no supply ({redCount})</span>
              </div>
            </div>
            {loading ? (
              <div className="text-center py-20" style={{ color: '#6E6788' }}>Loading map…</div>
            ) : (
              <AdminMap pins={pins} />
            )}
          </section>

          {/* Projections */}
          <section>
            <h2 className="text-xl font-bold mb-3" style={{ color: '#2C2347' }}>Sales Projections</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Weekly', p: projections.weekly, color: '#34B5E5' },
                { label: 'Monthly', p: projections.monthly, color: '#7C5CC4' },
                { label: 'Rolling Quarter', p: projections.quarter, color: '#EE7B30' },
              ].map(c => (
                <div key={c.label} className="bg-white rounded-2xl p-5 shadow-sm">
                  <p className="text-sm font-semibold" style={{ color: '#6E6788' }}>{c.label}</p>
                  <p className="text-3xl font-bold mt-1" style={{ color: c.color }}>{inr(c.p.revenue)}</p>
                  <p className="text-xs mt-1" style={{ color: '#6E6788' }}>≈ {c.p.units.toLocaleString('en-IN')} units</p>
                </div>
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: '#6E6788' }}>
              Based on a {projections.dailyRate.toFixed(1)} units/day run-rate, {inr(AVG_ORDER_VALUE)} avg order value and {Math.round(QOQ_GROWTH * 100)}% quarterly growth.
            </p>
          </section>

          {/* Revenue goal planner */}
          <section className="bg-white rounded-3xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-1" style={{ color: '#2C2347' }}>Revenue Goal — Next Rolling Quarter</h2>
            <p className="text-sm mb-4" style={{ color: '#6E6788' }}>Enter a target and we&apos;ll map out how to get there.</p>
            <div className="flex gap-2 max-w-sm">
              <input
                type="text" inputMode="numeric" value={goal}
                onChange={e => setGoal(e.target.value)}
                placeholder="e.g. 2500000"
                className="flex-1 border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2"
                style={{ borderColor: '#E5E7EB', color: '#2C2347' }}
              />
            </div>

            {plan && (
              <div className="mt-5 animate-slide-up">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                  <Stat label="Target" value={inr(plan.target)} color="#2C2347" />
                  <Stat label="Projected" value={inr(plan.projected)} color="#7C5CC4" />
                  <Stat label={plan.onTrack ? 'Surplus' : 'Gap to close'} value={inr(Math.abs(plan.gap))} color={plan.onTrack ? '#7CBE3F' : '#E5394E'} />
                </div>
                <div className="rounded-2xl p-5" style={{ backgroundColor: plan.onTrack ? '#F2F8E9' : '#FCEDEF' }}>
                  <h3 className="font-bold mb-2" style={{ color: '#2C2347' }}>{plan.onTrack ? '✅ On track — push further' : '🎯 Suggested plan to hit the goal'}</h3>
                  <ul className="text-sm space-y-1.5" style={{ color: '#2C2347' }}>
                    {plan.onTrack ? (
                      <>
                        <li>• You&apos;re projected to beat the goal by {inr(Math.abs(plan.gap))}. Reinvest the surplus into expansion.</li>
                        <li>• Convert the {redCount} red “demand, no supply” PIN clusters to lock in upside.</li>
                        <li>• Raise avg order value with combo packs and the pairing brands below.</li>
                      </>
                    ) : (
                      <>
                        <li>• Sell ~<b>{plan.extraUnits.toLocaleString('en-IN')}</b> extra units this quarter (~<b>{plan.extraPerDay}/day</b> above run-rate).</li>
                        <li>• Activate distribution in ~<b>{plan.newPins}</b> new high-demand PIN clusters (start with the {redCount} red zones on the map).</li>
                        <li>• Convert SOS reporters to buyers with “back in stock” offers — every red cluster is pre-validated demand.</li>
                        <li>• Lift avg order value above {inr(AVG_ORDER_VALUE)} via combo packs &amp; the pairing partners below.</li>
                        <li>• Run referral pushes (+150 pts) and 5-scan streak campaigns to drive repeat purchases.</li>
                      </>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </section>

          {/* Associations */}
          <section>
            <h2 className="text-xl font-bold mb-1" style={{ color: '#2C2347' }}>Product Associations &amp; Co-Branding</h2>
            <p className="text-sm mb-4" style={{ color: '#6E6788' }}>Like McDonald&apos;s &amp; Coke — products and brands that pair naturally with each MadMix line.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {ASSOCIATIONS.map(a => (
                <div key={a.category} className="bg-white rounded-2xl p-5 shadow-sm">
                  <h3 className="font-bold mb-3 flex items-center gap-2" style={{ color: '#2C2347' }}>{a.icon} {a.category}</h3>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#7C5CC4' }}>Pairs well with</p>
                  <ul className="text-sm mb-3 space-y-1" style={{ color: '#6E6788' }}>
                    {a.pairs.map(p => <li key={p}>• {p}</li>)}
                  </ul>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#EE7B30' }}>Partner brands</p>
                  <ul className="text-sm space-y-1" style={{ color: '#6E6788' }}>
                    {a.brands.map(b => <li key={b}>• {b}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <Link href="/" className="text-sm" style={{ color: '#6E6788' }}>← Back to site</Link>
        </div>
      </main>
    </>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm">
      <p className="text-xs" style={{ color: '#6E6788' }}>{label}</p>
      <p className="text-xl font-bold mt-0.5" style={{ color }}>{value}</p>
    </div>
  )
}
