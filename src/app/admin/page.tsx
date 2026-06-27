'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import TopNav from '@/components/TopNav'
import Reveal from '@/components/Reveal'
import { pinToCoord, type DemandPoint } from '@/lib/geo'
import { getSalesSummary, BLENDED_UNIT_PRICE } from '@/lib/salesData'
import {
  computeHiddenRevenue, computeRestock, buildExecSummary, splitProduct,
  LOST_REVENUE_PER_REPORT, RESTOCK_RETURN_RATE,
  type SosLite, type FeedbackLite, type RestockCluster,
} from '@/lib/insights'

const DemandMap = dynamic(() => import('@/components/DemandMap'), { ssr: false })

const ADMIN_PASSCODE = 'madmix'

interface ScanRow { pin_code: string | null; product_name: string | null; created_at: string }
interface SosRow extends SosLite { id: string; location_lat: number | null; location_lng: number | null }
interface FeedbackRow extends FeedbackLite { id: string; pin_code: string | null; location_lat: number | null; location_lng: number | null }

const ASSOCIATIONS: { category: string; icon: string; pairs: string[]; brands: string[] }[] = [
  { category: 'Bhujia', icon: '🌶️',
    pairs: ['Masala chai & filter coffee', 'Cold drinks / sodas', 'Instant noodles topping', 'Chaat & sandwich mix-ins'],
    brands: ['Coca-Cola / Thums Up (namkeen + cola combos)', 'Tata Tea / Wagh Bakri (chai-time bundles)', 'Maggi (topping co-branding)', 'Amul (chaas + namkeen)'] },
  { category: 'Puffs', icon: '🍿',
    pairs: ['Movie & gaming snacking', 'Kids’ tiffin & lunchboxes', 'Dips & cheese spreads', 'Cold coffee / milkshakes'],
    brands: ['PVR / BookMyShow (cinema combos)', 'Netflix / JioCinema (watch-party packs)', 'Amul / Go Cheese (dip pairings)', 'Frooti / Paper Boat (kids combos)'] },
  { category: 'Raisins', icon: '🍇',
    pairs: ['Yogurt & smoothie bowls', 'Trail-mix & granola', 'Baking & desserts', 'Pre/post-workout snacking'],
    brands: ['Epigamia / Milky Mist (yogurt toppers)', 'Yoga Bar / RiteBite (trail-mix bars)', 'cure.fit / HealthifyMe (fitness boxes)', 'D2C bakeries & granola brands'] },
]

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [code, setCode] = useState('')
  const [err, setErr] = useState(false)

  const [scans, setScans] = useState<ScanRow[]>([])
  const [sos, setSos] = useState<SosRow[]>([])
  const [feedback, setFeedback] = useState<FeedbackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [goal, setGoal] = useState('')
  const [showAI, setShowAI] = useState(false)
  const [restockingKey, setRestockingKey] = useState('')

  const summary = useMemo(() => getSalesSummary(), [])

  useEffect(() => {
    try { if (sessionStorage.getItem('madmap_admin') === '1') setAuthed(true) } catch {}
  }, [])

  const load = useCallback(async () => {
    const [s, r, f] = await Promise.all([
      supabase.from('scans').select('pin_code, product_name, created_at'),
      supabase.from('sos_reports').select('*'),
      supabase.from('feedback').select('*'),
    ])
    if (s.error) console.error('[Admin] scans load failed:', s.error.message)
    if (r.error) console.error('[Admin] sos load failed:', r.error.message)
    if (f.error) console.error('[Admin] feedback load failed:', f.error.message)
    setScans((s.data as ScanRow[]) || [])
    setSos((r.data as SosRow[]) || [])
    setFeedback((f.data as FeedbackRow[]) || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!authed) return
    load()
    // Live updates: re-pull whenever a new SOS report or feedback lands.
    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sos_reports' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [authed, load])

  // green = demand & supply (scans), red = demand only (SOS without a scan in that PIN)
  const points: DemandPoint[] = useMemo(() => {
    const supplied = new Map<string, DemandPoint>()
    scans.forEach(s => {
      const k = s.pin_code; if (!k) return
      const [lat, lng] = pinToCoord(k)
      if (!supplied.has(k)) supplied.set(k, { pin_code: k, lat, lng, count: 0, status: 'supplied', products: [], flavours: [], city: '', latest: s.created_at })
      const p = supplied.get(k)!; p.count++
      const prod = s.product_name?.split('—')[0]?.trim(); const fla = s.product_name?.split('—')[1]?.trim()
      if (prod && !p.products.includes(prod)) p.products.push(prod)
      if (fla && !p.flavours.includes(fla)) p.flavours.push(fla)
    })
    const unmet = new Map<string, DemandPoint>()
    sos.forEach(r => {
      const k = r.pin_code || (r.location_lat ? `${r.location_lat},${r.location_lng}` : 'unknown')
      if (supplied.has(k)) return
      const [lat, lng] = r.location_lat && r.location_lng ? [r.location_lat, r.location_lng] : pinToCoord(r.pin_code || '')
      if (!unmet.has(k)) unmet.set(k, { pin_code: r.pin_code || '—', lat, lng, count: 0, status: 'unmet', products: [], flavours: [], city: r.city || '', latest: r.created_at })
      const p = unmet.get(k)!; p.count++
      const { product, flavour } = splitProduct(r)
      if (product !== '—' && !p.products.includes(product)) p.products.push(product)
      if (flavour !== '—' && !p.flavours.includes(flavour)) p.flavours.push(flavour)
    })
    // feedback = confirmed customer engagement / market presence (green)
    const engaged = new Map<string, DemandPoint>()
    feedback.forEach(r => {
      const k = r.pin_code || (r.location_lat ? `${r.location_lat},${r.location_lng}` : 'unknown')
      const [lat, lng] = r.location_lat && r.location_lng ? [r.location_lat, r.location_lng] : pinToCoord(r.pin_code || '')
      if (!engaged.has(k)) engaged.set(k, { pin_code: r.pin_code || '—', lat, lng, count: 0, status: 'feedback', products: [], flavours: [], city: r.city || '', latest: r.created_at })
      const p = engaged.get(k)!; p.count++
      if (r.product && !p.products.includes(r.product)) p.products.push(r.product)
      if (r.flavour && !p.flavours.includes(r.flavour)) p.flavours.push(r.flavour)
    })
    return [...supplied.values(), ...unmet.values(), ...engaged.values()]
  }, [scans, sos, feedback])

  const greenCount = points.filter(p => p.status === 'supplied').length
  const redCount = points.filter(p => p.status === 'unmet').length
  const feedbackCount = points.filter(p => p.status === 'feedback').length

  const hidden = useMemo(() => computeHiddenRevenue(sos), [sos])
  const restock = useMemo(() => computeRestock(sos), [sos])
  const exec = useMemo(() => buildExecSummary(sos, feedback), [sos, feedback])

  const plan = useMemo(() => {
    const target = parseFloat(goal.replace(/[^\d.]/g, ''))
    if (!target || target <= 0) return null
    const projected = summary.projections[2].revenue // rolling quarter
    const gap = target - projected
    const extraUnits = Math.max(0, Math.ceil(gap / BLENDED_UNIT_PRICE))
    const extraPerDay = Math.ceil(extraUnits / 91)
    const newPins = Math.max(1, Math.ceil(extraUnits / 900))
    return { target, projected, gap, extraUnits, extraPerDay, newPins, onTrack: gap <= 0 }
  }, [goal, summary])

  // Mark a product available again in a location → notify waiting customers
  async function markRestocked(c: RestockCluster) {
    const key = `${c.pin_code}|${c.product}|${c.flavour}`
    setRestockingKey(key)
    const ids = sos
      .filter(r => !r.notified && r.customer_phone)
      .filter(r => { const sp = splitProduct(r); return (r.pin_code || '—') === c.pin_code && sp.product === c.product && sp.flavour === c.flavour })
      .map(r => r.id)
    if (ids.length) {
      const { error } = await supabase.from('sos_reports')
        .update({ notified: true, restocked_at: new Date().toISOString() })
        .in('id', ids)
      if (error) console.error('[Admin] restock notify failed:', error.message)
      else setSos(prev => prev.map(r => ids.includes(r.id) ? { ...r, notified: true } : r))
    }
    setRestockingKey('')
  }

  function unlock(e: React.FormEvent) {
    e.preventDefault()
    if (code.trim().toLowerCase() === ADMIN_PASSCODE) {
      try { sessionStorage.setItem('madmap_admin', '1') } catch {}
      setAuthed(true)
    } else setErr(true)
  }

  if (!authed) {
    return (
      <>
        <TopNav />
        <main className="flex-1 flex items-center justify-center p-6 animate-page">
          <form onSubmit={unlock} className="bg-white rounded-3xl p-8 w-full max-w-xs text-center shadow-sm">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3" style={{ backgroundColor: '#F1ECFC' }}>🔒</div>
            <h1 className="text-xl font-bold mb-1" style={{ color: '#2C2347' }}>Administrator Access</h1>
            <p className="text-sm mb-5" style={{ color: '#6E6788' }}>This is the internal MadMix strategy console.</p>
            <input autoFocus type="password" value={code}
              onChange={e => { setCode(e.target.value); setErr(false) }}
              placeholder="Passcode"
              className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 text-center"
              style={{ borderColor: err ? '#E5394E' : '#E5E7EB', color: '#2C2347' }} />
            {err && <p className="text-xs mt-2" style={{ color: '#E5394E' }}>Incorrect passcode.</p>}
            <button type="submit" className="w-full mt-4 py-3 rounded-full text-white font-semibold" style={{ backgroundColor: '#7C5CC4' }}>Unlock</button>
            <Link href="/" className="block text-xs mt-4" style={{ color: '#6E6788' }}>← Back to site</Link>
          </form>
        </main>
      </>
    )
  }

  return (
    <>
      <TopNav />
      <main className="flex-1 p-6 animate-page">
        <div className="max-w-5xl mx-auto flex flex-col gap-8">
          <Reveal>
            <div>
              <h1 className="text-3xl font-extrabold" style={{ color: '#2C2347' }}>🔐 Administrator Console</h1>
              <p className="text-sm" style={{ color: '#6E6788' }}>Pan-India supply vs demand, data-driven sales projections & growth strategy.</p>
            </div>
          </Reveal>

          {/* Pan-India density map */}
          <Reveal delay={60}>
            <section className="bg-white rounded-3xl p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-xl font-bold" style={{ color: '#2C2347' }}>Demand vs Supply — Pan India</h2>
                  <p className="text-sm" style={{ color: '#6E6788' }}>Density heatmap glows green→red by report intensity; circles mark each cluster.</p>
                </div>
                <div className="flex flex-wrap gap-4 text-sm font-medium">
                  <span style={{ color: '#E5394E' }}>🔴 SOS — unmet demand ({redCount})</span>
                  <span style={{ color: '#22C55E' }}>🟢 Feedback — engagement ({feedbackCount})</span>
                  <span style={{ color: '#7CBE3F' }}>🟢 Scans — supply ({greenCount})</span>
                </div>
              </div>
              {loading ? <div className="text-center py-20" style={{ color: '#6E6788' }}>Loading map…</div> : <DemandMap points={points} height="70vh" />}
            </section>
          </Reveal>

          {/* 💰 Hidden Revenue */}
          <Reveal delay={60}>
            <section className="bg-white rounded-3xl p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-1" style={{ color: '#2C2347' }}>💰 Hidden Revenue</h2>
              <p className="text-sm mb-4" style={{ color: '#6E6788' }}>
                Revenue likely lost because customers couldn&apos;t find products. Each stock-out ≈ {inr(LOST_REVENUE_PER_REPORT)} of missed sales (a month of repeat purchase at the ₹{BLENDED_UNIT_PRICE} blended price).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <div className="rounded-2xl p-5" style={{ backgroundColor: '#FCEDEF' }}>
                  <p className="text-sm" style={{ color: '#6E6788' }}>Estimated Missed Revenue · This Week</p>
                  <p className="text-3xl font-bold mt-1" style={{ color: '#E5394E' }}>{inr(hidden.week)}</p>
                </div>
                <div className="rounded-2xl p-5" style={{ backgroundColor: '#FCEDEF' }}>
                  <p className="text-sm" style={{ color: '#6E6788' }}>Estimated Missed Revenue · This Month</p>
                  <p className="text-3xl font-bold mt-1" style={{ color: '#E5394E' }}>{inr(hidden.month)}</p>
                </div>
              </div>

              <h3 className="font-bold mb-2" style={{ color: '#2C2347' }}>Top Lost Opportunities</h3>
              {hidden.opportunities.length === 0 ? (
                <p className="text-sm" style={{ color: '#6E6788' }}>No stock-out reports yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-2xl" style={{ border: '1px solid #EFE9FB' }}>
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: '#7C5CC4' }}>
                        {['Rank', 'PIN Code', 'Flavour', 'Est. Revenue Lost'].map(h => (
                          <th key={h} className={`px-4 py-2 text-white font-semibold ${h === 'Est. Revenue Lost' ? 'text-right' : 'text-left'}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {hidden.opportunities.slice(0, 5).map((o, i) => (
                        <tr key={`${o.pin_code}-${o.product}-${o.flavour}`} style={{ backgroundColor: i % 2 ? 'white' : '#F8F5FE' }}>
                          <td className="px-4 py-2 font-bold" style={{ color: '#7C5CC4' }}>{i + 1}</td>
                          <td className="px-4 py-2 font-mono" style={{ color: '#2C2347' }}>{o.pin_code}</td>
                          <td className="px-4 py-2" style={{ color: '#2C2347' }}>{o.flavour}</td>
                          <td className="px-4 py-2 text-right font-bold" style={{ color: '#E5394E' }}>{inr(o.revenueLost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </Reveal>

          {/* 🔔 Restock Recovery */}
          <Reveal delay={60}>
            <section className="bg-white rounded-3xl p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-1" style={{ color: '#2C2347' }}>🔔 Restock Recovery</h2>
              <p className="text-sm mb-4" style={{ color: '#6E6788' }}>
                Close the loop — notify customers who reported a stock-out once the product is back, and track how many you re-engage.
              </p>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
                <Stat label="Customers waiting" value={restock.waiting.toLocaleString('en-IN')} color="#EE7B30" />
                <Stat label="Notifications sent" value={restock.sent.toLocaleString('en-IN')} color="#7C5CC4" />
                <Stat label="Est. recovered customers" value={restock.recoveredCustomers.toLocaleString('en-IN')} color="#34B5E5" />
                <Stat label="Est. recovered revenue" value={inr(restock.recoveredRevenue)} color="#7CBE3F" />
              </div>

              <h3 className="font-bold mb-2" style={{ color: '#2C2347' }}>Mark a product back in stock → notify waiting customers</h3>
              {restock.clusters.length === 0 ? (
                <p className="text-sm" style={{ color: '#6E6788' }}>No customers are currently waiting for a restock.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {restock.clusters.map(c => {
                    const key = `${c.pin_code}|${c.product}|${c.flavour}`
                    return (
                      <div key={key} className="flex items-center justify-between gap-3 p-3 rounded-xl heat-cell" style={{ backgroundColor: '#FBF3DA' }}>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate" style={{ color: '#2C2347' }}>{c.product} — {c.flavour}</p>
                          <p className="text-xs" style={{ color: '#6E6788' }}>PIN {c.pin_code} · {c.waiting} waiting</p>
                        </div>
                        <button
                          onClick={() => markRestocked(c)} disabled={restockingKey === key}
                          className="px-4 py-2 rounded-full text-white font-semibold text-xs whitespace-nowrap transition-transform hover:scale-105 active:scale-95 disabled:opacity-60"
                          style={{ backgroundColor: '#7CBE3F' }}
                        >
                          {restockingKey === key ? 'Notifying…' : `✅ Mark restocked & notify`}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
              <p className="text-xs mt-3" style={{ color: '#6E6788' }}>
                Assumes {Math.round(RESTOCK_RETURN_RATE * 100)}% of notified customers return to purchase.
              </p>
            </section>
          </Reveal>

          {/* Sales projections from workbook data */}
          <Reveal delay={60}>
            <section>
              <h2 className="text-xl font-bold mb-1" style={{ color: '#2C2347' }}>Sales Projections</h2>
              <p className="text-sm mb-3" style={{ color: '#6E6788' }}>
                From {summary.daysOfData} days of historical quick-commerce sales (₹{Math.round(summary.totalSales).toLocaleString('en-IN')} total,
                {' '}avg {inr(summary.avgDaily)}/day, trend {summary.dailyTrendPct >= 0 ? '▲' : '▼'} {Math.abs(summary.dailyTrendPct)}%/day).
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {summary.projections.map((p, i) => {
                  const color = ['#34B5E5', '#7C5CC4', '#EE7B30'][i]
                  const arrow = p.trend === 'up' ? '▲' : p.trend === 'down' ? '▼' : '—'
                  const arrowColor = p.trend === 'up' ? '#7CBE3F' : p.trend === 'down' ? '#E5394E' : '#6E6788'
                  return (
                    <Reveal as="div" key={p.label} delay={i * 90} className="bg-white rounded-2xl p-5 shadow-sm">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold" style={{ color: '#6E6788' }}>{p.label}</p>
                        <span className="text-sm font-bold" style={{ color: arrowColor }}>{arrow} {Math.abs(p.growthPct)}%</span>
                      </div>
                      <p className="text-3xl font-bold mt-1" style={{ color }}>{inr(p.revenue)}</p>
                      <p className="text-xs mt-1" style={{ color: '#6E6788' }}>≈ {p.units.toLocaleString('en-IN')} units</p>
                      <div className="mt-3">
                        <div className="flex justify-between text-[11px] mb-1" style={{ color: '#6E6788' }}>
                          <span>Confidence: {p.confidence}</span><span>{p.confidencePct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#EFE9FB' }}>
                          <div className="h-full rounded-full progress-bar" style={{ width: `${p.confidencePct}%`, backgroundColor: color }} />
                        </div>
                      </div>
                    </Reveal>
                  )
                })}
              </div>
              <p className="text-xs mt-2" style={{ color: '#6E6788' }}>
                Projected via least-squares trend on daily sales; units use a ₹{BLENDED_UNIT_PRICE} blended price derived from SKU-level data.
              </p>
            </section>
          </Reveal>

          {/* Revenue goal planner */}
          <Reveal delay={60}>
            <section className="bg-white rounded-3xl p-6 shadow-sm">
              <h2 className="text-xl font-bold mb-1" style={{ color: '#2C2347' }}>Revenue Goal — Next Rolling Quarter</h2>
              <p className="text-sm mb-4" style={{ color: '#6E6788' }}>Enter a target and we&apos;ll map out how to get there.</p>
              <input type="text" inputMode="numeric" value={goal} onChange={e => setGoal(e.target.value)}
                placeholder="e.g. 2500000"
                className="w-full max-w-sm border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2"
                style={{ borderColor: '#E5E7EB', color: '#2C2347' }} />
              {plan && (
                <div className="mt-5 animate-slide-up">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                    <Stat label="Target" value={inr(plan.target)} color="#2C2347" />
                    <Stat label="Projected (data-driven)" value={inr(plan.projected)} color="#7C5CC4" />
                    <Stat label={plan.onTrack ? 'Surplus' : 'Gap to close'} value={inr(Math.abs(plan.gap))} color={plan.onTrack ? '#7CBE3F' : '#E5394E'} />
                  </div>
                  <div className="rounded-2xl p-5" style={{ backgroundColor: plan.onTrack ? '#F2F8E9' : '#FCEDEF' }}>
                    <h3 className="font-bold mb-2" style={{ color: '#2C2347' }}>{plan.onTrack ? '✅ On track — push further' : '🎯 Suggested plan to hit the goal'}</h3>
                    <ul className="text-sm space-y-1.5" style={{ color: '#2C2347' }}>
                      {plan.onTrack ? (
                        <>
                          <li>• Projected to beat the goal by {inr(Math.abs(plan.gap))}. Reinvest the surplus into expansion.</li>
                          <li>• Convert the {redCount} red “demand, no supply” clusters to lock in upside.</li>
                          <li>• Raise basket size with combo packs and the pairing brands below.</li>
                        </>
                      ) : (
                        <>
                          <li>• Sell ~<b>{plan.extraUnits.toLocaleString('en-IN')}</b> extra units this quarter (~<b>{plan.extraPerDay}/day</b> above the trend).</li>
                          <li>• Activate distribution in ~<b>{plan.newPins}</b> new high-demand PIN clusters (start with the {redCount} red zones on the map).</li>
                          <li>• Convert SOS reporters with “back in stock” offers — each red cluster is pre-validated demand.</li>
                          <li>• Lift basket size above ₹{BLENDED_UNIT_PRICE} via combo packs &amp; the co-branding partners below.</li>
                          <li>• Run referral (+150) and 5-scan streak campaigns to drive repeat purchases.</li>
                        </>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </section>
          </Reveal>

          {/* Associations */}
          <Reveal delay={60}>
            <section>
              <h2 className="text-xl font-bold mb-1" style={{ color: '#2C2347' }}>Product Associations &amp; Co-Branding</h2>
              <p className="text-sm mb-4" style={{ color: '#6E6788' }}>Like McDonald&apos;s &amp; Coke — products and brands that pair naturally with each MadMix line.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {ASSOCIATIONS.map((a, i) => (
                  <Reveal as="div" key={a.category} delay={i * 90} className="bg-white rounded-2xl p-5 shadow-sm">
                    <h3 className="font-bold mb-3 flex items-center gap-2" style={{ color: '#2C2347' }}>{a.icon} {a.category}</h3>
                    <p className="text-xs font-semibold mb-1" style={{ color: '#7C5CC4' }}>Pairs well with</p>
                    <ul className="text-sm mb-3 space-y-1" style={{ color: '#6E6788' }}>{a.pairs.map(p => <li key={p}>• {p}</li>)}</ul>
                    <p className="text-xs font-semibold mb-1" style={{ color: '#EE7B30' }}>Partner brands</p>
                    <ul className="text-sm space-y-1" style={{ color: '#6E6788' }}>{a.brands.map(b => <li key={b}>• {b}</li>)}</ul>
                  </Reveal>
                ))}
              </div>
            </section>
          </Reveal>

          <Link href="/" className="text-sm" style={{ color: '#6E6788' }}>← Back to site</Link>
        </div>
      </main>

      {/* ✨ Floating AI assistant */}
      <button
        onClick={() => setShowAI(true)}
        className="fixed bottom-5 right-5 z-40 rounded-2xl px-5 py-3 text-white font-semibold text-sm shadow-xl flex items-center gap-2 transition-transform hover:scale-105 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #7C5CC4, #EA4C89)', boxShadow: '0 12px 28px -8px rgba(124,92,196,0.85)' }}
      >
        <span className="animate-sparkle">✨</span> AI Summary
      </button>

      {/* AI side panel */}
      <div
        className="fixed inset-0 z-50"
        style={{ pointerEvents: showAI ? 'auto' : 'none' }}
        aria-hidden={!showAI}
      >
        <div
          onClick={() => setShowAI(false)}
          className="absolute inset-0 transition-opacity duration-300"
          style={{ backgroundColor: 'rgba(44,35,71,0.45)', opacity: showAI ? 1 : 0 }}
        />
        <aside
          className="absolute top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl overflow-y-auto transition-transform duration-300"
          style={{ transform: showAI ? 'translateX(0)' : 'translateX(100%)' }}
        >
          <div className="p-6">
            <div className="flex items-start justify-between mb-1">
              <h2 className="text-xl font-extrabold flex items-center gap-2" style={{ color: '#2C2347' }}>
                <span style={{ background: 'linear-gradient(135deg, #7C5CC4, #EA4C89)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>✨ AI Executive Summary</span>
              </h2>
              <button onClick={() => setShowAI(false)} className="text-2xl leading-none" style={{ color: '#6E6788' }} aria-label="Close">×</button>
            </div>
            <p className="text-xs mb-5" style={{ color: '#6E6788' }}>Auto-generated from live SOS &amp; feedback data.</p>

            <h3 className="font-bold mb-2" style={{ color: '#2C2347' }}>📈 Weekly Consumer Intelligence Summary</h3>
            <ul className="text-sm space-y-2 mb-6">
              {exec.insights.length ? exec.insights.map((s, i) => (
                <li key={i} className="flex gap-2" style={{ color: '#2C2347' }}><span>•</span><span>{s}</span></li>
              )) : <li className="text-sm" style={{ color: '#6E6788' }}>Not enough data yet — insights appear as reports arrive.</li>}
            </ul>

            <h3 className="font-bold mb-2" style={{ color: '#2C2347' }}>✅ Recommended Actions</h3>
            <ul className="text-sm space-y-2 mb-6">
              {exec.actions.map((s, i) => (
                <li key={i} className="flex gap-2" style={{ color: '#2C2347' }}><span>→</span><span>{s}</span></li>
              ))}
            </ul>

            <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(135deg, #7CBE3F, #2F855A)' }}>
              <p className="text-sm opacity-90">💸 Estimated Recoverable Revenue</p>
              <p className="text-3xl font-bold mt-1">{inr(exec.recoverableRevenue)}</p>
              <p className="text-xs opacity-90 mt-1">If the recommended actions are implemented this month.</p>
            </div>
          </div>
        </aside>
      </div>
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
