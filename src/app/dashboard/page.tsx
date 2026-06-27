'use client'

import dynamic from 'next/dynamic'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import TopNav from '@/components/TopNav'

const DashboardHeatmap = dynamic(() => import('@/components/DashboardHeatmap'), { ssr: false })

interface HeatmapPin {
  pin_code: string
  report_count: number
  products: string[]
  last_reported: string
}

interface Stats {
  total_scans: number
  total_sos: number
  total_customers: number
  top_products: { product_name: string; count: number }[]
}

function DemandBadge({ count }: { count: number }) {
  if (count >= 5) return <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#E5394E' }}>🔴 High</span>
  if (count >= 2) return <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white" style={{ backgroundColor: '#F5B301', color: '#2C2347' }}>🟡 Medium</span>
  return <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{ backgroundColor: '#7CBE3F20', color: '#7CBE3F' }}>🟢 Low</span>
}

export default function DashboardPage() {
  const [heatmap, setHeatmap] = useState<HeatmapPin[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'heatmap' | 'scans' | 'overview'>('overview')

  useEffect(() => {
    async function load() {
      // Aggregate SOS reports by PIN code
      const { data: sosData } = await supabase
        .from('sos_reports')
        .select('pin_code, product_name, created_at')
        .order('created_at', { ascending: false })

      if (sosData) {
        const pinMap = new Map<string, HeatmapPin>()
        sosData.forEach(r => {
          if (!pinMap.has(r.pin_code)) {
            pinMap.set(r.pin_code, {
              pin_code: r.pin_code,
              report_count: 0,
              products: [],
              last_reported: r.created_at,
            })
          }
          const pin = pinMap.get(r.pin_code)!
          pin.report_count++
          if (!pin.products.includes(r.product_name)) pin.products.push(r.product_name)
        })
        setHeatmap(Array.from(pinMap.values()).sort((a, b) => b.report_count - a.report_count))
      }

      // Stats
      const [scansRes, sosRes, customersRes] = await Promise.all([
        supabase.from('scans').select('product_name', { count: 'exact' }),
        supabase.from('sos_reports').select('id', { count: 'exact' }),
        supabase.from('customers').select('id', { count: 'exact' }),
      ])

      // Top products from scans
      const productCounts: Record<string, number> = {}
      scansRes.data?.forEach(s => {
        productCounts[s.product_name] = (productCounts[s.product_name] || 0) + 1
      })
      const top_products = Object.entries(productCounts)
        .map(([product_name, count]) => ({ product_name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5)

      setStats({
        total_scans: scansRes.count || 0,
        total_sos: sosRes.count || 0,
        total_customers: customersRes.count || 0,
        top_products,
      })

      setLoading(false)
    }

    load()
  }, [])

  return (
    <>
      <TopNav />
      <main className="flex-1 p-6 animate-page">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#2C2347' }}>
              🗺️ MadMap Dashboard
            </h1>
            <p className="text-sm" style={{ color: '#6E6788' }}>Consumer Intelligence — Internal View</p>
          </div>
          <Link href="/" className="text-sm" style={{ color: '#6E6788' }}>← Home</Link>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(['overview', 'heatmap', 'scans'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 rounded-full text-sm font-medium capitalize transition-all"
              style={activeTab === tab
                ? { backgroundColor: '#7C5CC4', color: 'white' }
                : { backgroundColor: 'white', color: '#6E6788' }
              }
            >
              {tab === 'overview' ? '📊 Overview' : tab === 'heatmap' ? '🗺️ Demand Heatmap' : '📦 Scans'}
            </button>
          ))}
        </div>

        {loading && (
          <div className="text-center py-12" style={{ color: '#6E6788' }}>
            Loading data…
          </div>
        )}

        {!loading && activeTab === 'overview' && stats && (
          <div className="flex flex-col gap-6">
            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: 'Total Scans', value: stats.total_scans, icon: '📦', color: '#7C5CC4' },
                { label: 'SOS Reports', value: stats.total_sos, icon: '🆘', color: '#E5394E' },
                { label: 'Customers', value: stats.total_customers, icon: '👥', color: '#7CBE3F' },
              ].map(kpi => (
                <div key={kpi.label} className="bg-white rounded-2xl p-5 shadow-sm text-center">
                  <p className="text-3xl mb-1">{kpi.icon}</p>
                  <p className="text-3xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
                  <p className="text-xs mt-1" style={{ color: '#6E6788' }}>{kpi.label}</p>
                </div>
              ))}
            </div>

            {/* Top products */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-bold mb-4" style={{ color: '#2C2347' }}>Top Scanned Products</h2>
              {stats.top_products.length === 0 && (
                <p className="text-sm" style={{ color: '#6E6788' }}>No scan data yet.</p>
              )}
              {stats.top_products.map((p, i) => (
                <div key={p.product_name} className="mb-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span style={{ color: '#2C2347' }}>{p.product_name}</span>
                    <span className="font-bold" style={{ color: '#7C5CC4' }}>{p.count}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#F3F4F6' }}>
                    <div
                      className="h-full rounded-full progress-bar"
                      style={{
                        width: `${(p.count / (stats.top_products[0]?.count || 1)) * 100}%`,
                        backgroundColor: i === 0 ? '#7C5CC4' : i === 1 ? '#F5B301' : '#7CBE3F',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* High demand PINs */}
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <h2 className="font-bold mb-1" style={{ color: '#2C2347' }}>High Demand Areas</h2>
              <p className="text-xs mb-4" style={{ color: '#6E6788' }}>PIN codes with the most SOS reports</p>
              {heatmap.slice(0, 5).length === 0 && (
                <p className="text-sm" style={{ color: '#6E6788' }}>No SOS reports yet.</p>
              )}
              {heatmap.slice(0, 5).map(pin => (
                <div key={pin.pin_code} className="flex items-center justify-between py-3 border-b last:border-0" style={{ borderColor: '#F3F4F6' }}>
                  <div>
                    <p className="font-mono font-bold text-sm" style={{ color: '#2C2347' }}>{pin.pin_code}</p>
                    <p className="text-xs" style={{ color: '#6E6788' }}>{pin.products.join(', ')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color: '#E5394E' }}>{pin.report_count}</span>
                    <DemandBadge count={pin.report_count} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && activeTab === 'heatmap' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col gap-4 mb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold" style={{ color: '#2C2347' }}>Demand Heatmap by PIN Code</h2>
                <p className="text-sm mt-1" style={{ color: '#6E6788' }}>
                  Real customer reports shown on a map. Hotter circles mean more requests from that postal cluster.
                </p>
              </div>
              <div className="flex gap-3 text-xs">
                <span>🟢 Low</span>
                <span>🟡 Medium</span>
                <span>🔴 High</span>
              </div>
            </div>

            <DashboardHeatmap heatmap={heatmap} />

            {heatmap.length === 0 ? (
              <div className="text-center py-12" style={{ color: '#6E6788' }}>
                <p className="text-4xl mb-3">📍</p>
                <p>No SOS reports yet. Reports will appear here as customers submit them.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {heatmap.map(pin => (
                  <div
                    key={pin.pin_code}
                    className="flex items-center gap-4 p-4 rounded-xl transition-all hover:shadow-md"
                    style={{
                      backgroundColor: pin.report_count >= 5 ? '#FCEDEF' : pin.report_count >= 2 ? '#FFFBEB' : '#F2F8E9',
                    }}
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm text-white flex-shrink-0"
                      style={{
                        backgroundColor: pin.report_count >= 5 ? '#E5394E' : pin.report_count >= 2 ? '#F5B301' : '#7CBE3F',
                      }}
                    >
                      {pin.report_count}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono font-bold" style={{ color: '#2C2347' }}>{pin.pin_code}</p>
                      <p className="text-xs truncate" style={{ color: '#6E6788' }}>{pin.products.join(' · ')}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <DemandBadge count={pin.report_count} />
                      <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                        {new Date(pin.last_reported).toLocaleDateString('en-IN')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && activeTab === 'scans' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm">
            <h2 className="font-bold mb-4" style={{ color: '#2C2347' }}>QR Scan Analytics</h2>
            <ScanTable />
          </div>
        )}
      </div>
    </main>
    </>
  )
}

function ScanTable() {
  const [scans, setScans] = useState<{
    id: string; pin_code: string; product_name: string; platform: string; rating: number; created_at: string
  }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('scans')
      .select('id, pin_code, product_name, platform, rating, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setScans(data || [])
        setLoading(false)
      })
  }, [])

  if (loading) return <p className="text-sm" style={{ color: '#6E6788' }}>Loading…</p>
  if (scans.length === 0) return (
    <div className="text-center py-8" style={{ color: '#6E6788' }}>
      <p className="text-3xl mb-2">📦</p>
      <p>No scans yet. Share QR codes to start collecting data.</p>
    </div>
  )

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: '2px solid #F3F4F6' }}>
            {['PIN', 'Product', 'Platform', 'Rating', 'Date'].map(h => (
              <th key={h} className="text-left pb-3 pr-4 font-semibold" style={{ color: '#6E6788' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {scans.map(s => (
            <tr key={s.id} style={{ borderBottom: '1px solid #F9FAFB' }}>
              <td className="py-2 pr-4 font-mono font-medium" style={{ color: '#2C2347' }}>{s.pin_code}</td>
              <td className="py-2 pr-4" style={{ color: '#2C2347' }}>{s.product_name.replace('MadMix ', '')}</td>
              <td className="py-2 pr-4 capitalize" style={{ color: '#6E6788' }}>{s.platform}</td>
              <td className="py-2 pr-4" style={{ color: '#F5B301' }}>{'⭐'.repeat(s.rating)}</td>
              <td className="py-2" style={{ color: '#9CA3AF' }}>{new Date(s.created_at).toLocaleDateString('en-IN')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
