export type Platform = 'blinkit' | 'instamart' | 'zepto' | 'store'

export interface QRCode {
  id: string
  code: string
  product_name: string
  is_redeemed: boolean
  created_at: string
}

export interface Scan {
  id: string
  qr_code: string
  pin_code: string
  product_name: string
  platform: Platform
  rating: number
  would_buy_again: boolean
  points_earned: number
  customer_phone?: string
  created_at: string
}

export interface SOSReport {
  id: string
  pin_code?: string
  product_name: string
  product?: string
  flavour?: string
  city?: string
  state?: string
  platform?: Platform
  points_earned: number
  customer_phone?: string
  report_status?: 'pending' | 'finalized'
  screenshot_url?: string
  location_lat?: number
  location_lng?: number
  created_at: string
}

export interface Feedback {
  id: string
  product?: string
  flavour?: string
  message: string
  pin_code?: string
  city?: string
  state?: string
  location_lat?: number
  location_lng?: number
  customer_phone?: string
  points_earned: number
  created_at: string
}

export interface Customer {
  id: string
  phone: string
  total_points: number
  total_scans: number
  total_sos: number
  created_at: string
}

/**
 * MadMix product line. Customers first pick a category, then a flavour.
 * Stored as "Category — Flavour" (e.g. "Puffs — Pizza Party").
 */
export const PRODUCT_CATALOG: Record<string, string[]> = {
  Puffs: ['Pizza Party', 'Flamin Fun', 'Chaat Corner', 'Mighty Masala', 'Cream & Onion'],
  Bhujia: ['Lemon Mirchi', 'BBQ Blast', 'Masala Masti', 'Pudina Picnic', 'Tangy Twist', 'Aloo Sev'],
  Raisins: ['Mango Mood', 'Anardana', 'Paan Pop'],
}

export const PRODUCT_CATEGORIES = Object.keys(PRODUCT_CATALOG)

export const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'blinkit', label: 'Blinkit' },
  { value: 'instamart', label: 'Instamart' },
  { value: 'zepto', label: 'Zepto' },
  { value: 'store', label: 'Retail Store' },
]

/** Reward economy. */
export const POINTS = {
  first_scan: 50, // first QR scan
  regular_scan: 50, // every QR scan
  scan_streak_5: 250, // bonus on every 5th scan, on top of the per-scan points
  member_month: 100, // being a member for over a month
  referral: 150, // referring the app to a friend
  sos_report: 75, // reporting a stockout
  feedback: 50, // submitting product feedback
}

/** First milestone for the all-actions progress bar (rewards hub). */
export const PROGRESS_GOAL = 1000

/** Milestone shown on the post-submission success screen. */
export const SUCCESS_MILESTONE = 750

/** Ordered "how to earn" table, shared across reward surfaces. */
export const EARN_TABLE: { action: string; pts: string; icon: string }[] = [
  { action: 'First QR Scan', pts: '+50', icon: '🎉' },
  { action: 'Every QR Scan', pts: '+50', icon: '📦' },
  { action: 'Every 5 Scans', pts: '+250', icon: '🔥' },
  { action: 'Member for 1 Month', pts: '+100', icon: '📅' },
  { action: 'Refer a Friend', pts: '+150', icon: '👥' },
  { action: 'SOS Report', pts: '+75', icon: '🆘' },
  { action: 'Product Feedback', pts: '+50', icon: '💬' },
]
