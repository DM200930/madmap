'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import TopNav from '@/components/TopNav'
import { POINTS, PROGRESS_GOAL, type Customer } from '@/lib/types'

export default function RewardsPage() {
  const [phone, setPhone] = useState('')
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [searched, setSearched] = useState(false)
  const [loading, setLoading] = useState(false)
  const [joining, setJoining] = useState(false)
  const [copied, setCopied] = useState(false)

  const fetchCustomer = useCallback(async (p: string): Promise<Customer | null> => {
    const { data } = await supabase.from('customers').select('*').eq('phone', p).single()
    return data as Customer | null
  }, [])

  // Award the "member for over a month" bonus once.
  const maybeAwardMemberBonus = useCallback(async (c: Customer) => {
    const monthMs = 30 * 24 * 60 * 60 * 1000
    const isOldEnough = c.created_at && Date.now() - new Date(c.created_at).getTime() > monthMs
    const flag = `madmap_membonus_${c.phone}`
    let already = false
    try { already = localStorage.getItem(flag) === '1' } catch {}
    if (isOldEnough && !already) {
      await supabase.rpc('add_customer_points', { p_phone: c.phone, p_points: POINTS.member_month, p_scan: false })
      try { localStorage.setItem(flag, '1') } catch {}
      const refreshed = await fetchCustomer(c.phone)
      if (refreshed) setCustomer(refreshed)
    }
  }, [fetchCustomer])

  const load = useCallback(async (p: string) => {
    setLoading(true)
    const c = await fetchCustomer(p)
    setCustomer(c)
    setSearched(true)
    setLoading(false)
    if (c) await maybeAwardMemberBonus(c)
  }, [fetchCustomer, maybeAwardMemberBonus])

  // Auto-load the signed-in member
  useEffect(() => {
    let saved = ''
    try { saved = localStorage.getItem('madmap_phone') || '' } catch {}
    if (saved) { setPhone(saved); load(saved) }
  }, [load])

  async function lookup(e: React.FormEvent) {
    e.preventDefault()
    try { localStorage.setItem('madmap_phone', phone) } catch {}
    load(phone)
  }

  // Membership / auth: register a phone number as a member.
  async function becomeMember() {
    if (!/\d{6,}/.test(phone)) return
    setJoining(true)
    // Ensure a customer row exists (0-point upsert) then sign in.
    await supabase.rpc('add_customer_points', { p_phone: phone, p_points: 0, p_scan: false })
    try { localStorage.setItem('madmap_phone', phone) } catch {}
    await load(phone)
    setJoining(false)
  }

  function shareReferral() {
    const url = typeof window !== 'undefined' ? window.location.origin : 'https://madmap.app'
    const text = `Join me on MadMap! Scan MadMix packets & earn rewards. ${url}`
    if (navigator.share) {
      navigator.share({ title: 'MadMap', text, url }).catch(() => {})
    } else {
      navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
    }
  }

  const tier = (pts: number) => {
    if (pts >= 500) return { name: 'Gold', icon: '🥇' }
    if (pts >= 200) return { name: 'Silver', icon: '🥈' }
    return { name: 'Bronze', icon: '🥉' }
  }

  const memberSince = (iso?: string) => {
    if (!iso) return null
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / (24 * 60 * 60 * 1000))
    return days
  }

  return (
    <>
      <TopNav />
      <main className="flex-1 p-6 flex flex-col items-center animate-page">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3" style={{ backgroundColor: '#F1ECFC' }}>🏆</div>
            <h1 className="text-2xl font-bold" style={{ color: '#2C2347' }}>My Rewards</h1>
            <p className="text-sm mt-1" style={{ color: '#6E6788' }}>Sign in with your phone to track points</p>
          </div>

          {/* Phone / membership */}
          {!customer && (
            <div className="bg-white rounded-2xl p-6 shadow-sm mb-6">
              <label className="block text-sm font-medium mb-2" style={{ color: '#2C2347' }}>Phone Number</label>
              <form onSubmit={lookup} className="flex gap-2">
                <input
                  type="tel" required value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="flex-1 border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2"
                  style={{ borderColor: '#E5E7EB', color: '#2C2347' }}
                />
                <button type="submit" disabled={loading} className="px-5 py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-60" style={{ backgroundColor: '#7C5CC4' }}>
                  {loading ? '…' : 'Sign in'}
                </button>
              </form>
              {searched && !customer && (
                <div className="mt-4 text-center">
                  <p className="text-sm mb-3" style={{ color: '#6E6788' }}>No member found with this number.</p>
                  <button onClick={becomeMember} disabled={joining} className="w-full py-3 rounded-full text-white font-semibold disabled:opacity-60" style={{ backgroundColor: '#7CBE3F' }}>
                    {joining ? 'Creating…' : '✨ Become a Member'}
                  </button>
                  <p className="text-xs mt-2" style={{ color: '#6E6788' }}>Members earn 100 bonus points after one month.</p>
                </div>
              )}
            </div>
          )}

          {customer && (() => {
            const t = tier(customer.total_points)
            const progress = Math.min((customer.total_points / PROGRESS_GOAL) * 100, 100)
            const days = memberSince(customer.created_at)
            return (
              <div className="flex flex-col gap-4 animate-slide-up">
                {/* Points card with progress to 1000 */}
                <div className="rounded-2xl p-6 text-white" style={{ background: 'linear-gradient(135deg, #7C5CC4, #EA4C89)' }}>
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-sm opacity-80">Total Points</p>
                      <p className="text-5xl font-bold mt-1 animate-count-up">{customer.total_points}</p>
                      {days !== null && <p className="text-xs opacity-80 mt-1">Member for {days} day{days === 1 ? '' : 's'}</p>}
                    </div>
                    <div className="text-right">
                      <span className="text-2xl">{t.icon}</span>
                      <p className="text-sm font-semibold mt-1">{t.name} Member</p>
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs opacity-80 mb-1">
                      <span>Progress to {PROGRESS_GOAL.toLocaleString()} points</span>
                      <span>{customer.total_points}/{PROGRESS_GOAL}</span>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden bg-white/30">
                      <div className="h-full rounded-full bg-white progress-bar" style={{ width: `${progress}%` }} />
                    </div>
                  </div>
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

                {/* Refer a friend */}
                <button onClick={shareReferral} className="w-full rounded-2xl p-4 text-white font-semibold flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]" style={{ background: 'linear-gradient(135deg, #34B5E5, #4F46E5)' }}>
                  👥 {copied ? 'Link copied!' : `Refer a friend · +${POINTS.referral} pts`}
                </button>

                {/* Rewards catalogue */}
                <div className="bg-white rounded-2xl p-6 shadow-sm">
                  <h2 className="font-bold mb-4" style={{ color: '#2C2347' }}>Available Rewards</h2>
                  <div className="flex flex-col gap-3">
                    {[
                      { pts: 200, label: '10% Off Coupon', icon: '🏷️' },
                      { pts: 350, label: 'Free MadMix Pack', icon: '🎁' },
                      { pts: 500, label: 'Exclusive Flavour Drop', icon: '✨' },
                      { pts: 1000, label: 'MadMix Mega Hamper', icon: '📦' },
                    ].map(r => {
                      const canRedeem = customer.total_points >= r.pts
                      return (
                        <div key={r.label} className="flex items-center justify-between p-3 rounded-xl heat-cell" style={{ backgroundColor: canRedeem ? '#F2F8E9' : '#F9FAFB' }}>
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{r.icon}</span>
                            <div>
                              <p className="text-sm font-medium" style={{ color: '#2C2347' }}>{r.label}</p>
                              <p className="text-xs" style={{ color: '#6E6788' }}>{r.pts} points</p>
                            </div>
                          </div>
                          <button disabled={!canRedeem} className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all" style={canRedeem ? { backgroundColor: '#7CBE3F', color: 'white' } : { backgroundColor: '#E5E7EB', color: '#9CA3AF' }}>
                            {canRedeem ? 'Redeem' : `${r.pts - customer.total_points} more`}
                          </button>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <button
                  onClick={() => { try { localStorage.removeItem('madmap_phone') } catch {}; setCustomer(null); setSearched(false); setPhone('') }}
                  className="text-sm py-2" style={{ color: '#6E6788' }}
                >
                  Sign out
                </button>
              </div>
            )
          })()}

          {/* How to earn */}
          <div className="bg-white rounded-2xl p-6 shadow-sm mt-4">
            <h2 className="font-bold mb-4" style={{ color: '#2C2347' }}>How to Earn Points</h2>
            {[
              { action: 'First QR scan', pts: `+${POINTS.first_scan}`, icon: '🎉' },
              { action: 'Each QR scan', pts: `+${POINTS.regular_scan}`, icon: '📦' },
              { action: 'Every 5 scans (streak bonus)', pts: `+${POINTS.scan_streak_5}`, icon: '🔥' },
              { action: 'Member for over a month', pts: `+${POINTS.member_month}`, icon: '📅' },
              { action: 'Refer the app to a friend', pts: `+${POINTS.referral}`, icon: '👥' },
            ].map(item => (
              <div key={item.action} className="flex items-center justify-between py-2 border-b last:border-0" style={{ borderColor: '#F3F4F6' }}>
                <span className="text-sm flex items-center gap-2" style={{ color: '#6E6788' }}>{item.icon} {item.action}</span>
                <span className="font-bold text-sm" style={{ color: '#7C5CC4' }}>{item.pts}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-center">
            <Link href="/" className="text-sm" style={{ color: '#6E6788' }}>← Home</Link>
          </div>
        </div>
      </main>
    </>
  )
}
