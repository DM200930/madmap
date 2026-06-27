'use client'

/**
 * Decorative MadMix packets scattered along a NW → SE diagonal.
 * Each packet is a small tilted "pillow pack" in one of the real MadMix
 * pack colours, with the madmix wordmark hint. Purely decorative.
 */

const PACK_COLORS = [
  '#7C5CC4', // purple
  '#EE7B30', // orange
  '#F5B301', // golden
  '#7CBE3F', // green
  '#34B5E5', // sky blue
  '#EA4C89', // magenta
  '#4F46E5', // royal blue
  '#E5394E', // crimson
  '#2BB3A3', // teal
  '#A3CB38', // lime
]

// positions roughly along the top-left → bottom-right diagonal, with scatter
const PACKS = [
  { top: 4, left: 2, size: 78, rot: -26, c: 0, d: 0 },
  { top: 14, left: 16, size: 56, rot: -34, c: 2, d: 0.6 },
  { top: 2, left: 30, size: 46, rot: -20, c: 4, d: 1.2 },
  { top: 26, left: 9, size: 50, rot: -30, c: 5, d: 0.3 },
  { top: 30, left: 33, size: 70, rot: -28, c: 3, d: 0.9 },
  { top: 22, left: 48, size: 44, rot: -22, c: 1, d: 1.5 },
  { top: 44, left: 22, size: 58, rot: -32, c: 6, d: 0.2 },
  { top: 48, left: 50, size: 74, rot: -27, c: 7, d: 1.1 },
  { top: 40, left: 66, size: 48, rot: -24, c: 8, d: 0.7 },
  { top: 62, left: 38, size: 52, rot: -30, c: 9, d: 0.4 },
  { top: 66, left: 62, size: 64, rot: -29, c: 0, d: 1.3 },
  { top: 58, left: 80, size: 46, rot: -20, c: 2, d: 0.8 },
  { top: 82, left: 54, size: 56, rot: -33, c: 4, d: 0.5 },
  { top: 80, left: 78, size: 72, rot: -26, c: 5, d: 1.0 },
  { top: 70, left: 92, size: 44, rot: -22, c: 3, d: 0.1 },
  { top: 92, left: 88, size: 52, rot: -30, c: 6, d: 0.9 },
]

function Packet({ size, rot, color, delay }: { size: number; rot: number; color: string; delay: number }) {
  return (
    <div
      style={{
        width: size,
        height: size * 1.28,
        // @ts-expect-error custom prop consumed by the keyframe
        '--rot': `${rot}deg`,
        transform: `rotate(${rot}deg)`,
        animation: `float-pack 7s ease-in-out ${delay}s infinite`,
        background: `linear-gradient(150deg, ${color}, ${color}cc)`,
        borderRadius: size * 0.18,
        boxShadow: `0 10px 24px -8px ${color}99`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* crimped top & bottom edges */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: size * 0.12, background: 'rgba(255,255,255,0.22)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: size * 0.12, background: 'rgba(0,0,0,0.12)' }} />
      {/* wordmark hint */}
      <div
        style={{
          position: 'absolute',
          top: '42%',
          left: 0,
          right: 0,
          textAlign: 'center',
          color: 'rgba(255,255,255,0.92)',
          fontWeight: 800,
          fontStyle: 'italic',
          fontSize: size * 0.2,
          letterSpacing: '-0.04em',
        }}
      >
        madmix
      </div>
    </div>
  )
}

export default function PacketBackdrop({ dense = false }: { dense?: boolean }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden"
      style={{ zIndex: 0, opacity: dense ? 0.5 : 0.22 }}
    >
      {PACKS.map((p, i) => (
        <div key={i} style={{ position: 'absolute', top: `${p.top}%`, left: `${p.left}%` }}>
          <Packet size={p.size} rot={p.rot} color={PACK_COLORS[p.c]} delay={p.d} />
        </div>
      ))}
    </div>
  )
}
