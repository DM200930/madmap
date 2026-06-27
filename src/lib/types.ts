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
  pin_code: string
  product_name: string
  platform: Platform
  points_earned: number
  customer_phone?: string
  report_status?: 'pending' | 'finalized'
  screenshot_url?: string
  location_lat?: number
  location_lng?: number
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

export const PRODUCTS = [
  'MadMix Original',
  'MadMix Masala',
  'MadMix Peri Peri',
  'MadMix Cheese',
  'MadMix Tangy Tomato',
]

export const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'blinkit', label: 'Blinkit' },
  { value: 'instamart', label: 'Instamart' },
  { value: 'zepto', label: 'Zepto' },
  { value: 'store', label: 'Retail Store' },
]

export const POINTS = {
  first_scan: 100,
  regular_scan: 50,
  review: 25,
  sos_report: 30,
  referral: 150,
  app_download: 75,
}
