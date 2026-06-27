'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import TopNav from '@/components/TopNav'
import Reveal from '@/components/Reveal'
import { pinToCoord, type DemandPoint } from '@/lib/geo'
import { getSalesSummary, BLENDED_UNIT_PRICE } from '@/lib/salesData'

const DemandMap = dynamic(() => import('@/components/DemandMap'), { ssr: false })

const ADMIN_PASSCODE = 'madmix'

interface ScanRow { pin_code: string | null; product_name: string | null; created_at: string }
interface SosRow {
  pin_code: string | null; product: string | null; flavour: string | null; product_name: string | null
  city: string | null; location_lat: number | null; location_lng: number | null; created_at: string
}

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
  const [loading, setLoading] = useState(true)
  const [goal, setGoal] = useState('')

  const summary = useMemo(() => getSalesSummary(), [])

  useEffect(() => {
    try { if (sessionStorage.getItem('madmap_admin') === '1') setAuthed(true) } catch {}
  }, [])

  useEffect(() => {
    if (!authed) return
    async function load() {
      const [s, r] = await Promise.all([
        supabase.from('scans').select('pin_code, product_name, created_at'),
        supabase.from('sos_reports').select('*'),
      ])
      if (s.error) console.error('[Admin] scans load failed:', s.error.message)
      if (r.error) console.error('[Admin] sos load failed:', r.error.message)
      setScans((s.data as ScanRow[]) || [])
      setSos((r.data as SosRow[]) || [])
      setLoading(false)
    }
    load()
  }, [authed])

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
      const prod = r.product || r.product_name?.split('—')[0]?.trim(); const fla = r.flavour || r.product_name?.split('—')[1]?.trim()
      if (prod && !p.products.includes(prod)) p.products.push(prod)
      if (fla && !p.flavours.includes(fla)) p.flavours.push(fla)
    })
    return [...supplied.values(), ...unmet.values()]
  }, [scans, sos])

  const greenCount = points.filter(p => p.status === 'supplied').length
  const redCount = points.filter(p => p.status === 'unmet').length

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
                <div className="flex gap-4 text-sm font-medium">
                  <span style={{ color: '#7CBE3F' }}>🟢 Demand &amp; supply ({greenCount})</span>
                  <span style={{ color: '#E5394E' }}>🔴 Demand, no supply ({redCount})</span>
                </div>
              </div>
              {loading ? <div className="text-center py-20" style={{ color: '#6E6788' }}>Loading map…</div> : <DemandMap points={points} height="70vh" />}
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
