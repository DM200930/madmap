'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'

const ADMIN_PASSCODE = 'madmix'

const LINKS = [
  { href: '/rewards', label: 'Rewards', icon: '🏆', color: '#7C5CC4' },
  { href: '/sos', label: 'Bring MadMix Here', icon: '🆘', color: '#E5394E' },
  { href: '/dashboard', label: 'Dashboard', icon: '📊', color: '#34B5E5' },
]

export default function TopNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [askLock, setAskLock] = useState(false)
  const [code, setCode] = useState('')
  const [err, setErr] = useState(false)

  function unlock(e: React.FormEvent) {
    e.preventDefault()
    if (code.trim().toLowerCase() === ADMIN_PASSCODE) {
      try { sessionStorage.setItem('madmap_admin', '1') } catch {}
      setAskLock(false)
      router.push('/admin')
    } else {
      setErr(true)
    }
  }

  return (
    <header className="sticky top-0 z-30 backdrop-blur-md" style={{ backgroundColor: 'rgba(231,222,250,0.82)', borderBottom: '1px solid rgba(124,92,196,0.18)' }}>
      <nav className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 mr-auto">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center text-lg" style={{ backgroundColor: '#7C5CC4' }}>🗺️</span>
          <span className="text-xl font-extrabold italic tracking-tight" style={{ color: '#2C2347' }}>
            Mad<span style={{ color: '#7C5CC4' }}>Map</span>
          </span>
        </Link>

        {/* Big menu buttons */}
        <div className="flex items-center gap-2">
          {LINKS.map(l => {
            const active = pathname === l.href
            const isSOS = l.href === '/sos'
            return (
              <Link
                key={l.href}
                href={l.href}
                className="px-3 sm:px-4 py-2 rounded-full font-bold text-sm transition-transform hover:scale-105 active:scale-95"
                style={
                  isSOS
                    ? { backgroundColor: '#E5394E', color: 'white', boxShadow: '0 6px 16px -6px rgba(229,57,78,0.8)' }
                    : active
                    ? { backgroundColor: l.color, color: 'white' }
                    : { backgroundColor: 'white', color: l.color, border: `2px solid ${l.color}` }
                }
              >
                <span className="mr-1">{l.icon}</span>
                <span className="hidden sm:inline">{l.label}</span>
                <span className="sm:hidden">{l.href === '/sos' ? 'SOS' : l.label}</span>
              </Link>
            )
          })}

          {/* Admin lock */}
          <button
            onClick={() => { setAskLock(true); setErr(false); setCode('') }}
            title="Administrator access"
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg transition-transform hover:scale-110 active:scale-95"
            style={{ backgroundColor: 'white', color: '#7C5CC4', border: '2px solid #7C5CC4' }}
          >
            🔒
          </button>
        </div>
      </nav>

      {/* Lock dialog */}
      {askLock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6" style={{ backgroundColor: 'rgba(44,35,71,0.45)' }} onClick={() => setAskLock(false)}>
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={unlock}
            className="bg-white rounded-2xl p-7 w-full max-w-xs text-center animate-slide-up"
          >
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-3" style={{ backgroundColor: '#F1ECFC' }}>🔒</div>
            <h2 className="text-lg font-bold mb-1" style={{ color: '#2C2347' }}>Administrator Access</h2>
            <p className="text-xs mb-4" style={{ color: '#6E6788' }}>Enter the passcode to unlock the strategy console.</p>
            <input
              autoFocus
              type="password"
              value={code}
              onChange={e => { setCode(e.target.value); setErr(false) }}
              placeholder="Passcode"
              className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 text-center"
              style={{ borderColor: err ? '#E5394E' : '#E5E7EB', color: '#2C2347' }}
            />
            {err && <p className="text-xs mt-2" style={{ color: '#E5394E' }}>Incorrect passcode.</p>}
            <button type="submit" className="w-full mt-4 py-3 rounded-full text-white font-semibold" style={{ backgroundColor: '#7C5CC4' }}>
              Unlock
            </button>
          </form>
        </div>
      )}
    </header>
  )
}
