import { BLENDED_UNIT_PRICE } from './salesData'

// ---- Consistent assumptions used across every revenue feature ----
// Each stock-out report represents a customer who would have bought roughly a
// month of repeat purchases (4 packs) had the product been available.
export const LOST_UNITS_PER_REPORT = 4
export const LOST_REVENUE_PER_REPORT = BLENDED_UNIT_PRICE * LOST_UNITS_PER_REPORT // ₹344
// Share of notified customers expected to return and buy.
export const RESTOCK_RETURN_RATE = 0.45
// Share of missed revenue realistically recoverable if actions are taken.
export const RECOVERY_RATE = 0.6

export interface SosLite {
  pin_code: string | null
  product: string | null
  flavour: string | null
  product_name: string | null
  city: string | null
  customer_phone: string | null
  notified: boolean | null
  created_at: string
}

export interface FeedbackLite {
  product: string | null
  flavour: string | null
  rating: number | null
  city: string | null
  created_at: string
}

const DAY = 86400000
const ageDays = (iso: string) => (Date.now() - new Date(iso).getTime()) / DAY

export function splitProduct(r: { product: string | null; flavour: string | null; product_name: string | null }) {
  const product = r.product || r.product_name?.split('—')[0]?.trim() || '—'
  const flavour = r.flavour || r.product_name?.split('—')[1]?.trim() || '—'
  return { product, flavour }
}

// ---------------------------------------------------------------------------
// 1) Hidden revenue
// ---------------------------------------------------------------------------
export interface LostOpportunity { pin_code: string; product: string; flavour: string; reports: number; revenueLost: number }
export interface HiddenRevenue { week: number; month: number; total: number; opportunities: LostOpportunity[] }

export function computeHiddenRevenue(sos: SosLite[]): HiddenRevenue {
  const week = sos.filter(r => ageDays(r.created_at) <= 7).length * LOST_REVENUE_PER_REPORT
  const month = sos.filter(r => ageDays(r.created_at) <= 30).length * LOST_REVENUE_PER_REPORT
  const total = sos.length * LOST_REVENUE_PER_REPORT

  const groups = new Map<string, LostOpportunity>()
  sos.forEach(r => {
    const { product, flavour } = splitProduct(r)
    const pin = r.pin_code || '—'
    const key = `${pin}|${product}|${flavour}`
    if (!groups.has(key)) groups.set(key, { pin_code: pin, product, flavour, reports: 0, revenueLost: 0 })
    const g = groups.get(key)!
    g.reports++
    g.revenueLost += LOST_REVENUE_PER_REPORT
  })
  const opportunities = Array.from(groups.values()).sort((a, b) => b.revenueLost - a.revenueLost)
  return { week, month, total, opportunities }
}

// ---------------------------------------------------------------------------
// 2) Restock recovery
// ---------------------------------------------------------------------------
export interface RestockCluster { pin_code: string; product: string; flavour: string; waiting: number }
export interface RestockStats {
  waiting: number
  sent: number
  recoveredCustomers: number
  recoveredRevenue: number
  clusters: RestockCluster[]
}

export function computeRestock(sos: SosLite[]): RestockStats {
  const waitingRows = sos.filter(r => r.customer_phone && !r.notified)
  const waitingPhones = new Set(waitingRows.map(r => r.customer_phone))
  const sent = sos.filter(r => r.notified).length
  const recoveredCustomers = Math.round(sent * RESTOCK_RETURN_RATE)
  const recoveredRevenue = recoveredCustomers * LOST_REVENUE_PER_REPORT

  const groups = new Map<string, { c: RestockCluster; phones: Set<string> }>()
  waitingRows.forEach(r => {
    const { product, flavour } = splitProduct(r)
    const pin = r.pin_code || '—'
    const key = `${pin}|${product}|${flavour}`
    if (!groups.has(key)) groups.set(key, { c: { pin_code: pin, product, flavour, waiting: 0 }, phones: new Set() })
    groups.get(key)!.phones.add(r.customer_phone!)
  })
  const clusters = Array.from(groups.values())
    .map(g => ({ ...g.c, waiting: g.phones.size }))
    .sort((a, b) => b.waiting - a.waiting)

  return { waiting: waitingPhones.size, sent, recoveredCustomers, recoveredRevenue, clusters }
}

// ---------------------------------------------------------------------------
// 3) AI executive summary (deterministic, derived from data)
// ---------------------------------------------------------------------------
export interface ExecSummary { insights: string[]; actions: string[]; recoverableRevenue: number }

function topCount<T extends string>(items: (T | null | undefined)[]): { name: T; count: number } | null {
  const m = new Map<T, number>()
  items.forEach(i => { if (i) m.set(i, (m.get(i) || 0) + 1) })
  const sorted = [...m.entries()].sort((a, b) => b[1] - a[1])
  return sorted.length ? { name: sorted[0][0], count: sorted[0][1] } : null
}

export function buildExecSummary(sos: SosLite[], feedback: FeedbackLite[]): ExecSummary {
  const insights: string[] = []
  const actions: string[] = []

  const recent = sos.filter(r => ageDays(r.created_at) <= 7)
  const prior = sos.filter(r => ageDays(r.created_at) > 7 && ageDays(r.created_at) <= 14)

  // Demand trend
  if (recent.length || prior.length) {
    const delta = prior.length ? Math.round(((recent.length - prior.length) / prior.length) * 100) : 100
    insights.push(`${recent.length} stock-out reports in the last 7 days (${delta >= 0 ? '▲' : '▼'} ${Math.abs(delta)}% vs the previous week).`)
  }

  // Rising-demand area
  const recentCity = topCount(recent.map(r => r.city))
  if (recentCity) insights.push(`Demand is rising fastest in ${recentCity.name} (${recentCity.count} recent reports).`)

  // Product / flavour with most SOS
  const topProduct = topCount(sos.map(r => splitProduct(r).product))
  if (topProduct) insights.push(`${topProduct.name} receives the most SOS reports (${topProduct.count}).`)
  const topFlavour = topCount(sos.map(r => splitProduct(r).flavour))
  if (topFlavour) insights.push(`Highest-demand flavour: ${topFlavour.name} (${topFlavour.count} requests).`)

  // Availability issue concentration
  const topPin = topCount(sos.map(r => r.pin_code))
  if (topPin) insights.push(`Availability issues concentrated around PIN ${topPin.name} (${topPin.count} reports).`)

  // Positive feedback trend
  const rated = feedback.filter(f => typeof f.rating === 'number')
  if (rated.length) {
    const avg = rated.reduce((a, f) => a + (f.rating || 0), 0) / rated.length
    const happy = Math.round((rated.filter(f => (f.rating || 0) >= 4).length / rated.length) * 100)
    insights.push(`Average product rating ${avg.toFixed(1)}/5 across ${rated.length} reviews — ${happy}% rated 4★ or higher.`)
    const bestProd = topCount(rated.filter(f => (f.rating || 0) >= 4).map(f => f.product))
    if (bestProd) insights.push(`Most-loved product: ${bestProd.name}.`)
  }

  // Recommended actions
  if (topPin) actions.push(`Increase inventory in PIN ${topPin.name}${recentCity ? ` and across ${recentCity.name}` : ''}.`)
  if (recentCity) actions.push(`Contact distributors serving ${recentCity.name} to close supply gaps.`)
  if (topProduct) actions.push(`Prioritise restock of ${topProduct.name}${topFlavour ? ` — ${topFlavour.name}` : ''} on quick-commerce.`)
  actions.push('Expand retail coverage in clusters with repeated stock-outs.')
  actions.push('Monitor products with rapidly increasing demand and pre-position stock.')

  const hidden = computeHiddenRevenue(sos)
  const recoverableRevenue = Math.round(hidden.month * RECOVERY_RATE)

  return { insights, actions, recoverableRevenue }
}
