// Historical sales come straight from the provided workbook
// ("Copy of MadMix Quick Com Data.xlsx" → "Sales vs Spends" sheet),
// summing Big Basket + Instamart daily sales (₹). Projections below are
// computed from this series at runtime — no values are hardcoded.

export interface SalesPoint { date: string; sales: number }

export const SALES_HISTORY: SalesPoint[] = [
  { date: '2026-04-01', sales: 6060 },
  { date: '2026-04-02', sales: 7505 },
  { date: '2026-04-03', sales: 10490 },
  { date: '2026-04-04', sales: 10660 },
  { date: '2026-04-05', sales: 12050 },
  { date: '2026-04-06', sales: 7505 },
  { date: '2026-04-07', sales: 9520 },
  { date: '2026-04-08', sales: 10770 },
  { date: '2026-04-09', sales: 8400 },
  { date: '2026-04-10', sales: 9675 },
  { date: '2026-04-11', sales: 15170 },
  { date: '2026-04-12', sales: 16500 },
  { date: '2026-04-13', sales: 13535 },
  { date: '2026-04-14', sales: 16150 },
  { date: '2026-04-15', sales: 14255 },
  { date: '2026-04-16', sales: 13285 },
  { date: '2026-04-17', sales: 13465 },
  { date: '2026-04-18', sales: 14905 },
  { date: '2026-04-19', sales: 11170 },
  { date: '2026-04-20', sales: 12400 },
  { date: '2026-04-21', sales: 12720 },
  { date: '2026-04-22', sales: 15645 },
  { date: '2026-04-23', sales: 13050 },
  { date: '2026-04-24', sales: 13295 },
  { date: '2026-04-25', sales: 14125 },
  { date: '2026-04-26', sales: 12955 },
  { date: '2026-04-27', sales: 13215 },
  { date: '2026-04-28', sales: 10345 },
  { date: '2026-04-29', sales: 16140 },
  { date: '2026-04-30', sales: 17520 },
]

// Blended average selling price (₹) derived from the SKU Level Sales sheet
// (total MRP ÷ estimated units across Big Basket + Instamart). Used to turn
// projected revenue into projected units.
export const BLENDED_UNIT_PRICE = 86

export type Confidence = 'High' | 'Medium' | 'Low'

export interface Projection {
  label: string
  days: number
  revenue: number
  units: number
  growthPct: number // vs the equivalent trailing period
  trend: 'up' | 'down' | 'flat'
  confidence: Confidence
  confidencePct: number
}

interface Fit { slope: number; intercept: number; r2: number }

/** Ordinary least squares fit of sales over day-index. */
function linearFit(series: SalesPoint[]): Fit {
  const n = series.length
  const xs = series.map((_, i) => i)
  const ys = series.map(p => p.sales)
  const sx = xs.reduce((a, b) => a + b, 0)
  const sy = ys.reduce((a, b) => a + b, 0)
  const mx = sx / n
  const my = sy / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) { num += (xs[i] - mx) * (ys[i] - my); den += (xs[i] - mx) ** 2 }
  const slope = den === 0 ? 0 : num / den
  const intercept = my - slope * mx
  // R²
  let ssRes = 0, ssTot = 0
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * xs[i]
    ssRes += (ys[i] - pred) ** 2
    ssTot += (ys[i] - my) ** 2
  }
  const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot
  return { slope, intercept, r2 }
}

/** Sum of the fitted line over a forward window [from, from+days). */
function projectWindow(fit: Fit, from: number, days: number): number {
  let total = 0
  for (let i = from; i < from + days; i++) total += Math.max(0, fit.intercept + fit.slope * i)
  return total
}

function confidenceFromR2(r2: number, n: number): { label: Confidence; pct: number } {
  // shrink confidence when we have few data points
  const pct = Math.round(Math.max(0, Math.min(1, r2)) * Math.min(1, n / 30) * 100)
  if (r2 >= 0.5 && n >= 21) return { label: 'High', pct: Math.max(pct, 70) }
  if (r2 >= 0.2) return { label: 'Medium', pct: Math.max(pct, 45) }
  return { label: 'Low', pct }
}

function buildProjection(label: string, days: number, fit: Fit, n: number): Projection {
  const future = projectWindow(fit, n, days)
  const trailing = projectWindow(fit, n - days, days) // equivalent recent window on the fit
  const growthPct = trailing > 0 ? ((future - trailing) / trailing) * 100 : 0
  const conf = confidenceFromR2(fit.r2, n)
  return {
    label,
    days,
    revenue: Math.round(future),
    units: Math.round(future / BLENDED_UNIT_PRICE),
    growthPct: Math.round(growthPct * 10) / 10,
    trend: fit.slope > 1 ? 'up' : fit.slope < -1 ? 'down' : 'flat',
    confidence: conf.label,
    confidencePct: conf.pct,
  }
}

export interface SalesSummary {
  totalSales: number
  avgDaily: number
  daysOfData: number
  dailyTrendPct: number // implied daily growth from the fit
  projections: Projection[]
}

export function getSalesSummary(series: SalesPoint[] = SALES_HISTORY): SalesSummary {
  const n = series.length
  const fit = linearFit(series)
  const totalSales = series.reduce((a, p) => a + p.sales, 0)
  const avgDaily = totalSales / n
  const dailyTrendPct = avgDaily > 0 ? (fit.slope / avgDaily) * 100 : 0
  return {
    totalSales,
    avgDaily,
    daysOfData: n,
    dailyTrendPct: Math.round(dailyTrendPct * 100) / 100,
    projections: [
      buildProjection('Weekly', 7, fit, n),
      buildProjection('Monthly', 30, fit, n),
      buildProjection('Rolling Quarter', 91, fit, n),
    ],
  }
}
