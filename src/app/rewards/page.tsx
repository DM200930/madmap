'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { POINTS, type Customer } from '@/lib/types'

export default function RewardsPage() {
  const [phone, setPhone] = useState('')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)

  async function lookup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('phone', phone)
      .single()
    setCustomer(data)
    setSearched(true)
    setLoading(false)
  }

  const tier = (pts: number) => {
    if (pts >= 500) return { name: 'Gold', color: '#F5B301', icon: '🥇' }
    if (pts >= 200) return { name: 'Silver', color: '#9CA3AF', icon: '🥈' }
    return { name: 'Bronze', color: '#5B3FA6', icon: '🥉' }
  }

  return (
    <main className="min-h-screen p-6 flex flex-col items-center" style={{ backgroundColor: '#F7F4FD' }}>
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3"
            style={{ backgroundColor: '#F1ECFC' }}
          >
            🏆
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#2C2347' }}>My Rewards</h1>
          <p className="text-sm mt-1" style={{ color: '#6E6788' }}>Look up your points balance</p>
        </div>

        {/* Phone lookup */}
        <form onSubmit={lookup} className="bg-white rounded-2xl p-6 shadow-sm mb-6">
          <label className="block text-sm font-medium mb-2" style={{ color: '#2C2347' }}>Phone Number</label>
          <div className="flex gap-2">
            <input
              type="tel"
              required
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+91 98765 43210"
              className="flex-1 border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2"
              style={{ borderColor: '#E5E7EB', color: '#2C2347' }}
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-60"
              style={{ backgroundColor: '#7C5CC4' }}
            >
              {loading ? '…' : 'Go'}
            </button>
          </div>
        </form>

        {/* Results */}
        {searched && !customer && (
          <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
            <p className="text-4xl mb-3">🔍</p>
            <p className="font-semibold" style={{ color: '#2C2347' }}>No account found</p>
            <p className="text-sm mt-1" style={{ color: '#6E6788' }}>
              Scan a QR code with this phone number to create your account.
            </p>
          </div>
        )}

        {customer && (() => {
          const t = tier(customer.total_points)
          const nextTierPts = customer.total_points < 200 ? 200 : customer.total_points < 500 ? 500 : null
          const progress = nextTierPts ? Math.min((customer.total_points / nextTierPts) * 100, 100) : 100

          return (
            <div className="flex flex-col gap-4 animate-slide-up">
              {/* Points card */}
              <div
                className="rounded-2xl p-6 text-white"
                style={{ background: 'linear-gradient(135deg, #7C5CC4, #F5B301)' }}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-sm opacity-80">Total Points</p>
                    <p className="text-5xl font-bold mt-1 animate-count-up">{customer.total_points}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl">{t.icon}</span>
                    <p className="text-sm font-semibold mt-1">{t.name} Member</p>
                  </div>
                </div>

                {nextTierPts && (
                  <div>
                    <div className="flex justify-between text-xs opacity-80 mb-1">
                      <span>Progress to next tier</span>
                      <span>{customer.total_points}/{nextTierPts}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden bg-white/30">
                      <div
                        className="h-full rounded-full bg-white progress-bar"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                  <p className="text-3xl font-bold" style={{ color: '#7C5CC4' }}>{customer.total_scans}</p>
                  <p className="text-xs mt-1" style={{ color: '#6E6788' }}>QR Scans</p>
                </div>
                <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                  <p className="text-3xl font-bold" style={{ color: '#E5394E' }}>{customer.total_sos}</p>
                  <p className="text-xs mt-1" style={{ color: '#6E6788' }}>SOS Reports</p>
                </div>
              </div>

              {/* Rewards */}
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h2 className="font-bold mb-4" style={{ color: '#2C2347' }}>Available Rewards</h2>
                <div className="flex flex-col gap-3">
                  {[
                    { pts: 200, label: '10% Off Coupon', icon: '🏷️' },
                    { pts: 350, label: 'Free MadMix Pack', icon: '🎁' },
                    { pts: 500, label: 'Exclusive Flavour Drop', icon: '✨' },
                  ].map(r => {
                    const canRedeem = customer.total_points >= r.pts
                    return (
                      <div
                        key={r.label}
                        className="flex items-center justify-between p-3 rounded-xl"
                        style={{ backgroundColor: canRedeem ? '#F2F8E9' : '#F9FAFB' }}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">{r.icon}</span>
                          <div>
                            <p className="text-sm font-medium" style={{ color: '#2C2347' }}>{r.label}</p>
                            <p className="text-xs" style={{ color: '#6E6788' }}>{r.pts} points</p>
                          </div>
                        </div>
                        <button
                          disabled={!canRedeem}
                          className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                          style={canRedeem
                            ? { backgroundColor: '#7CBE3F', color: 'white' }
                            : { backgroundColor: '#E5E7EB', color: '#9CA3AF' }
                          }
                        >
                          {canRedeem ? 'Redeem' : `${r.pts - customer.total_points} more`}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })()}

        {/* How to earn */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mt-4">
          <h2 className="font-bold mb-4" style={{ color: '#2C2347' }}>How to Earn Points</h2>
          {[
            { action: 'First QR scan', pts: POINTS.first_scan, icon: '🎉' },
            { action: 'Regular scan', pts: POINTS.regular_scan, icon: '📦' },
            { action: 'SOS report', pts: POINTS.sos_report, icon: '🆘' },
            { action: 'Refer a friend', pts: POINTS.referral, icon: '👥' },
            { action: 'Download app', pts: POINTS.app_download, icon: '📲' },
          ].map(item => (
            <div key={item.action} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: '#F3F4F6' }}>
              <span className="text-sm flex items-center gap-2" style={{ color: '#6E6788' }}>
                {item.icon} {item.action}
              </span>
              <span className="font-bold text-sm" style={{ color: '#7C5CC4' }}>+{item.pts}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-center gap-6 text-sm">
          <Link href="/scan/demo-qr-001" style={{ color: '#7C5CC4' }}>📦 Scan QR</Link>
          <Link href="/sos" style={{ color: '#E5394E' }}>🆘 SOS</Link>
          <Link href="/" style={{ color: '#6E6788' }}>← Home</Link>
        </div>
      </div>
    </main>
  )
}
