// Google Ads API v24 integration
export const GOOGLE_ADS_VERSION = 'v24'
export const GOOGLE_ADS_BASE = `https://googleads.googleapis.com/${GOOGLE_ADS_VERSION}`

export async function getGoogleAccessToken(): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID!,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET!,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN!,
      grant_type: 'refresh_token',
    }),
    cache: 'no-store',
  })
  const j = await res.json()
  if (j.error) throw new Error(`Google OAuth2: ${j.error} — ${j.error_description}`)
  return j.access_token
}

export function googleHeaders(accessToken: string, loginCustomerId?: string) {
  const h: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'developer-token': process.env.GOOGLE_ADS_DEVELOPER_TOKEN!,
    'Content-Type': 'application/json',
  }
  if (loginCustomerId) h['login-customer-id'] = loginCustomerId
  return h
}

export async function gaqlSearch<T>(
  customerId: string,
  query: string,
  accessToken: string,
  loginCustomerId?: string,
): Promise<T[]> {
  const mccId = loginCustomerId || process.env.GOOGLE_ADS_MCC_ID!
  const res = await fetch(
    `${GOOGLE_ADS_BASE}/customers/${customerId}/googleAds:search`,
    {
      method: 'POST',
      headers: googleHeaders(accessToken, mccId),
      body: JSON.stringify({ query }),
      cache: 'no-store',
    },
  )
  const j = await res.json()
  if (j.error) {
    const msg = j.error.details?.[0]?.errors?.[0]?.message || j.error.message
    throw new Error(msg)
  }
  return (j.results || []) as T[]
}

// Date helpers for Google Ads API (YYYY-MM-DD format)
export function googleDateRange(period: string): { startDate: string; endDate: string } {
  const today = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]

  const ranges: Record<string, { startDate: string; endDate: string }> = {
    today: { startDate: fmt(today), endDate: fmt(today) },
    yesterday: (() => { const d = new Date(today); d.setDate(d.getDate() - 1); return { startDate: fmt(d), endDate: fmt(d) } })(),
    last_7d: (() => { const d = new Date(today); d.setDate(d.getDate() - 7); return { startDate: fmt(d), endDate: fmt(today) } })(),
    last_14d: (() => { const d = new Date(today); d.setDate(d.getDate() - 14); return { startDate: fmt(d), endDate: fmt(today) } })(),
    last_28d: (() => { const d = new Date(today); d.setDate(d.getDate() - 28); return { startDate: fmt(d), endDate: fmt(today) } })(),
    this_month: (() => { const d = new Date(today.getFullYear(), today.getMonth(), 1); return { startDate: fmt(d), endDate: fmt(today) } })(),
    last_month: (() => {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const end = new Date(today.getFullYear(), today.getMonth(), 0)
      return { startDate: fmt(start), endDate: fmt(end) }
    })(),
  }
  return ranges[period] || ranges.last_7d
}
