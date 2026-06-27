'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { EARN_TABLE, SUCCESS_MILESTONE } from '@/lib/types'

const CONFETTI = ['#7C5CC4', '#EE7B30', '#F5B301', '#7CBE3F', '#34B5E5', '#EA4C89']

/**
 * Full-page celebratory reward screen shown after an SOS report or feedback
 * submission. Animated glowing progress bar toward the 750-point hamper.
 */
export default function RewardSuccess({
  earned,
  currentPoints,
  headline = '🎉 Thanks for helping MadMix!',
  subtext,
}: {
  earned: number
  currentPoints: number
  headline?: string
  subtext?: string
}) {
  const milestone = SUCCESS_MILESTONE
  const pct = Math.min((currentPoints / milestone) * 100, 100)
  const remaining = Math.max(milestone - currentPoints, 0)

  const [animPct, setAnimPct] = useState(0)
  const [shownPoints, setShownPoints] = useState(Math.max(currentPoints - earned, 0))

  useEffect(() => {
    const t = setTimeout(() => setAnimPct(pct), 150)
    // count-up the points
    const start = Math.max(currentPoints - earned, 0)
    const steps = 24
    let i = 0
    const id = setInterval(() => {
      i++
      setShownPoints(Math.round(start + (earned * i) / steps))
      if (i >= steps) { setShownPoints(currentPoints); clearInterval(id) }
    }, 28)
    return () => { clearTimeout(t); clearInterval(id) }
  }, [pct, currentPoints, earned])

  return (
    <main className="flex-1 flex items-center justify-center p-6 animate-page relative overflow-hidden">
      {/* confetti */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-0">
        {Array.from({ length: 36 }).map((_, i) => (
          <span
            key={i}
            style={{
              position: 'absolute', left: `${(i / 36) * 100}%`, top: 0,
              width: 8, height: 13, borderRadius: 2,
              backgroundColor: CONFETTI[i % CONFETTI.length],
              animation: `confetti-fall ${1.2 + (i % 5) * 0.3}s ease-in ${(i % 8) * 0.12}s forwards`,
            }}
          />
        ))}
      </div>

      <div className="bg-white rounded-3xl p-8 shadow-2xl max-w-md w-full text-center animate-slide-up relative z-10">
        <div className="text-6xl mb-3 animate-celebrate">🎉</div>
        <h1 className="text-2xl font-extrabold mb-1" style={{ color: '#2C2347' }}>{headline}</h1>
        <p className="text-sm mb-2" style={{ color: '#6E6788' }}>
          {subtext || `You just earned +${earned} points.`}
        </p>
        <div className="text-5xl font-bold my-3 animate-count-up" style={{ color: '#7C5CC4' }}>+{earned}</div>

        {/* Glowing milestone progress bar */}
        <div className="mt-4 mb-2 relative">
          <div className="flex justify-between text-xs mb-1" style={{ color: '#6E6788' }}>
            <span>{shownPoints} pts</span>
            <span className="flex items-center gap-1">
              <span className="animate-sparkle">✨</span> {milestone} pts 🎁
            </span>
          </div>
          <div className="h-5 rounded-full overflow-hidden relative" style={{ backgroundColor: '#EFE9FB' }}>
            <div className="h-full rounded-full reward-fill progress-bar relative" style={{ width: `${animPct}%` }} />
            {/* milestone flag */}
            <div className="absolute top-0 -translate-x-1/2 text-lg" style={{ left: '100%' }}>🚩</div>
          </div>
          <p className="text-xs mt-2 font-semibold" style={{ color: '#EA4C89' }}>
            🎁 Reward at {milestone} points: Free MadMix Hamper
          </p>
        </div>

        {/* Current / Remaining / Percentage */}
        <div className="grid grid-cols-3 gap-2 my-4">
          {[
            { label: 'Current', value: currentPoints },
            { label: 'Remaining', value: remaining },
            { label: 'Complete', value: `${Math.round(pct)}%` },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-3" style={{ backgroundColor: '#F4F0FD' }}>
              <p className="text-lg font-bold" style={{ color: '#7C5CC4' }}>{s.value}</p>
              <p className="text-[11px]" style={{ color: '#6E6788' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Points table */}
        <div className="rounded-2xl overflow-hidden mb-5 text-left" style={{ border: '1px solid #EFE9FB' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: '#7C5CC4' }}>
                <th className="text-left px-4 py-2 text-white font-semibold">Action</th>
                <th className="text-right px-4 py-2 text-white font-semibold">Points</th>
              </tr>
            </thead>
            <tbody>
              {EARN_TABLE.map((r, i) => (
                <tr key={r.action} style={{ backgroundColor: i % 2 ? 'white' : '#F8F5FE' }}>
                  <td className="px-4 py-2" style={{ color: '#2C2347' }}>{r.icon} {r.action}</td>
                  <td className="px-4 py-2 text-right font-bold" style={{ color: '#7C5CC4' }}>{r.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3">
          <Link href="/rewards" className="block w-full py-3 rounded-full text-white font-semibold" style={{ backgroundColor: '#7C5CC4' }}>
            🏆 View My Rewards
          </Link>
          <Link href="/" className="text-sm" style={{ color: '#6E6788' }}>Back to Home</Link>
        </div>
      </div>
    </main>
  )
}
