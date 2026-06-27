'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import TopNav from '@/components/TopNav'
import Reveal from '@/components/Reveal'
import { pinToCoord, type DemandPoint } from '@/lib/geo'

const DemandMap = dynamic(() => import('@/components/DemandMap'), { ssr: false })

interface Row {
  pin_code: string | null
  product: string | null
  flavour: string | null
  product_name: string | null
  city: string | null
  location_lat: number | null
  location_lng: number | null
  created_at: string
}

export default function DashboardPage() {
  const [points, setPoints] = useState<DemandPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('sos_reports')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) console.error('[Dashboard] load failed:', error.message)

      const rows = (data as Row[]) || []
      const map = new Map<string, DemandPoint>()
      rows.forEach(r => {
        const key = r.pin_code || (r.location_lat ? `${r.location_lat},${r.location_lng}` : 'unknown')
        const [lat, lng] = r.location_lat && r.location_lng
          ? [r.location_lat, r.location_lng]
          : pinToCoord(r.pin_code || '')
        if (!map.has(key)) {
          map.set(key, {
            pin_code: r.pin_code || '—', lat, lng, count: 0, status: 'unmet',
            products: [], flavours: [], city: r.city || '', latest: r.created_at,
          })
        }
        const p = map.get(key)!
        p.count++
        const prod = r.product || r.product_name?.split('—')[0]?.trim()
        const fla = r.flavour || r.product_name?.split('—')[1]?.trim()
        if (prod && !p.products.includes(prod)) p.products.push(prod)
        if (fla && !p.flavours.includes(fla)) p.flavours.push(fla)
      })
      setPoints(Array.from(map.values()).sort((a, b) => b.count - a.count))
      setLoading(false)
    }
    load()
  }, [])

  return (
    <>
      <TopNav />
      <main className="flex-1 p-6 animate-page">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          <Reveal>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold" style={{ color: '#2C2347' }}>🗺️ Demand Heatmap</h1>
                <p className="text-sm" style={{ color: '#6E6788' }}>Where customers are asking for MadMix across India.</p>
              </div>
              <Link href="/" className="text-sm" style={{ color: '#6E6788' }}>← Home</Link>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div className="bg-white rounded-3xl p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <p className="text-sm" style={{ color: '#6E6788' }}>
                  Hotter areas mean more requests — the map glows from green to red as demand grows.
                </p>
                <div className="flex gap-3 text-xs font-medium">
                  <span style={{ color: '#22C55E' }}>● Low</span>
                  <span style={{ color: '#F5B301' }}>● Medium</span>
                  <span style={{ color: '#E5394E' }}>● High</span>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-20" style={{ color: '#6E6788' }}>Loading demand map…</div>
              ) : points.length === 0 ? (
                <div className="text-center py-20" style={{ color: '#6E6788' }}>
                  <p className="text-4xl mb-3">📍</p>
                  <p>No demand reports yet. They&apos;ll appear here as customers tap “Bring MadMix Here”.</p>
                </div>
              ) : (
                <DemandMap points={points} height="70vh" />
              )}
            </div>
          </Reveal>
        </div>
      </main>
    </>
  )
}
