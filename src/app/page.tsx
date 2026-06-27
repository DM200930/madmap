import Link from 'next/link'
import TopNav from '@/components/TopNav'
import PacketBackdrop from '@/components/PacketBackdrop'

export default function Home() {
  return (
    <>
      <TopNav />
      {/* denser packets just on the landing screen */}
      <PacketBackdrop dense />

      <main className="relative z-10 flex flex-col flex-1 animate-page">
        {/* Hero */}
        <section className="flex flex-col items-center justify-center flex-1 px-6 py-16 text-center">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl mb-6 animate-pulse-glow"
            style={{ backgroundColor: '#7C5CC4' }}
          >
            🗺️
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold italic tracking-tight mb-3" style={{ color: '#2C2347' }}>
            Mad<span style={{ color: '#7C5CC4' }}>Map</span>
          </h1>
          <p className="text-xl font-semibold mb-2" style={{ color: '#5B3FA6' }}>
            Every Scan Puts MadMix on the Map.
          </p>
          <p className="max-w-xl text-base mt-3 leading-relaxed" style={{ color: '#6E6788' }}>
            Scan the QR code inside your MadMix packet to earn rewards — and help us bring MadMix to every corner of India.
          </p>
        </section>

        {/* SOS — the bold, headline feature */}
        <section className="px-6 pb-16 w-full">
          <div className="max-w-2xl mx-auto">
            <Link
              href="/sos"
              className="group block rounded-3xl p-8 sm:p-10 text-center text-white animate-pulse-glow-red transition-transform hover:scale-[1.02] active:scale-95"
              style={{ background: 'linear-gradient(135deg, #E5394E, #C81E36)' }}
            >
              <div className="text-6xl mb-3">🆘</div>
              <h2 className="text-3xl sm:text-4xl font-extrabold mb-2">Bring MadMix Here</h2>
              <p className="text-base sm:text-lg opacity-95 max-w-md mx-auto">
                Can&apos;t find MadMix near you? Tap to report it. Every report puts your area on our map — and earns you points.
              </p>
              <span className="inline-block mt-5 px-7 py-3 rounded-full font-bold text-lg bg-white" style={{ color: '#E5394E' }}>
                Report a Stockout →
              </span>
            </Link>
          </div>
        </section>

        {/* Value table */}
        <section className="px-6 pb-16 max-w-3xl mx-auto w-full">
          <h2 className="text-2xl font-bold text-center mb-8" style={{ color: '#2C2347' }}>
            Every Action Creates Value
          </h2>
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: '#7C5CC4' }}>
                  <th className="text-left px-6 py-3 text-white font-semibold">Your Action</th>
                  <th className="text-left px-6 py-3 text-white font-semibold">Points</th>
                  <th className="text-left px-6 py-3 text-white font-semibold">Value Created</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { action: 'First QR scan', pts: '50', value: 'Confirms purchase location' },
                  { action: 'Every 5 scans', pts: '+250', value: 'Proven repeat buyer' },
                  { action: 'Member for 1 month', pts: '100', value: 'Loyalty & retention' },
                  { action: 'Press SOS', pts: '—', value: 'Lost-demand data' },
                  { action: 'Refer a friend', pts: '150', value: 'Customer acquisition' },
                ].map((row, i) => (
                  <tr key={row.action} style={{ backgroundColor: i % 2 === 0 ? '#F4F0FD' : 'white' }}>
                    <td className="px-6 py-3 font-medium" style={{ color: '#2C2347' }}>{row.action}</td>
                    <td className="px-6 py-3 font-bold" style={{ color: '#7C5CC4' }}>{row.pts}</td>
                    <td className="px-6 py-3" style={{ color: '#6E6788' }}>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mt-8 justify-center">
            <Link
              href="/rewards"
              className="px-8 py-4 rounded-full font-semibold text-white text-lg text-center transition-transform hover:scale-105 active:scale-95"
              style={{ backgroundColor: '#7C5CC4' }}
            >
              🏆 View My Rewards
            </Link>
            <Link
              href="/dashboard"
              className="px-8 py-4 rounded-full font-semibold text-lg text-center transition-transform hover:scale-105 active:scale-95 border-2"
              style={{ borderColor: '#34B5E5', color: '#34B5E5', backgroundColor: 'white' }}
            >
              📊 Dashboard
            </Link>
          </div>
        </section>
      </main>
    </>
  )
}
