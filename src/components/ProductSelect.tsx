'use client'

import { PRODUCT_CATALOG, PRODUCT_CATEGORIES } from '@/lib/types'

const CATEGORY_ICON: Record<string, string> = {
  Puffs: '🍿',
  Bhujia: '🌶️',
  Raisins: '🍇',
}

/**
 * Two-step product picker. Parent owns `category` and `flavour` state.
 * Choosing a category reveals its flavour dropdown.
 */
export default function ProductSelect({
  category,
  flavour,
  onCategory,
  onFlavour,
  accent = '#7C5CC4',
}: {
  category: string
  flavour: string
  onCategory: (c: string) => void
  onFlavour: (f: string) => void
  accent?: string
}) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="block text-sm font-medium mb-2" style={{ color: '#2C2347' }}>Product *</label>
        <div className="grid grid-cols-3 gap-2">
          {PRODUCT_CATEGORIES.map(c => {
            const selected = category === c
            return (
              <button
                type="button"
                key={c}
                onClick={() => { onCategory(c); onFlavour('') }}
                className="py-3 rounded-xl border text-sm font-semibold transition-all"
                style={{
                  borderColor: selected ? accent : '#E5E7EB',
                  backgroundColor: selected ? `${accent}1A` : 'white',
                  color: selected ? accent : '#6E6788',
                }}
              >
                <span className="block text-xl mb-0.5">{CATEGORY_ICON[c]}</span>
                {c}
              </button>
            )
          })}
        </div>
      </div>

      {category && (
        <div className="animate-slide-up">
          <label className="block text-sm font-medium mb-1" style={{ color: '#2C2347' }}>{category} flavour *</label>
          <select
            required
            value={flavour}
            onChange={e => onFlavour(e.target.value)}
            className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 bg-white"
            style={{ borderColor: '#E5E7EB', color: '#2C2347' }}
          >
            <option value="" disabled>Choose a flavour…</option>
            {PRODUCT_CATALOG[category].map(f => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}
