import { NextResponse } from 'next/server'
import { getAllAccounts } from '@/lib/meta-api'

const BASE_URL = 'https://graph.facebook.com/v20.0'
const TOKEN = process.env.META_ACCESS_TOKEN

type Action = { action_type: string; value: string }

// Priority-ordered lists — first non-zero wins to avoid double-counting pixel + CAPI
// Same logic used in Ads Manager: shows the campaign's primary conversion metric
const PURCHASE_PRIORITY = ['omni_purchase', 'purchase', 'fb_pixel_purchase']
const LEAD_PRIORITY = ['onsite_conversion.lead_grouped', 'lead', 'complete_registration', 'fb_pixel_lead']
const CONV_PRIORITY = [
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.messaging_first_reply',
  'messaging_conversation_started_7d',
]
const REVENUE_PRIORITY = ['omni_revenue', 'purchase.value', 'fb_pixel_purchase.value']

// Non-overlapping utility metrics (safe to sum)
const CART_TYPES = ['add_to_cart', 'omni_add_to_cart', 'fb_pixel_add_to_cart']
const CHECKOUT_TYPES = ['initiate_checkout', 'omni_initiated_checkout', 'fb_pixel_initiated_checkout']

// Priority ordering for the overall "Results" column (matches Ads Manager behaviour)
const RESULT_PRIORITY = [...PURCHASE_PRIORITY, ...CONV_PRIORITY, ...LEAD_PRIORITY]

// Returns value of the first matching type with a non-zero count
function getBest(actions: Action[], types: string[]): number {
  for (const t of types) {
    const a = actions.find(x => x.action_type === t)
    if (a) {
      const v = Math.round(parseFloat(a.value || '0'))
      if (v > 0) return v
    }
  }
  return 0
}

// Sums non-overlapping utility metrics (addToCart, checkout)
function sumActions(actions: Action[], types: string[]): number {
  return actions
    .filter(a => types.includes(a.action_type))
    .reduce((s, a) => s + parseFloat(a.value || '0'), 0)
}

function detectType(leads: number, purchases: number, conversations: number): 'lead' | 'ecommerce' | 'conversa' {
  if (purchases > 0 && purchases >= leads && purchases >= conversations) return 'ecommerce'
  if (conversations > leads && conversations > purchases) return 'conversa'
  return 'lead'
}

async function fetchInsights(accountId: string, datePreset: string, since?: string, until?: string) {
  const url = new URL(`${BASE_URL}/${accountId}/insights`)
  url.searchParams.set('access_token', TOKEN!)
  url.searchParams.set('fields', 'spend,impressions,clicks,reach,ctr,cpm,cpp,actions,action_values,cost_per_action_type')
  url.searchParams.set('level', 'account')
  if (since && until) {
    url.searchParams.set('time_range', JSON.stringify({ since, until }))
  } else {
    url.searchParams.set('date_preset', datePreset)
  }
  const res = await fetch(url.toString(), { cache: 'no-store' })
  const data = await res.json()
  return data.data?.[0] || null
}

function dateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

function getPrevPeriodParams(period: string): { datePreset?: string; since?: string; until?: string } | null {
  if (period === 'today') return { datePreset: 'yesterday' }
  if (period === 'this_month') return { datePreset: 'last_month' }
  if (period === 'this_week_sun_today') return { datePreset: 'last_week_sun_sat' }
  if (period === 'last_7d') {
    const now = new Date()
    const until = new Date(now); until.setDate(until.getDate() - 7)
    const since = new Date(now); since.setDate(since.getDate() - 14)
    return { since: dateStr(since), until: dateStr(until) }
  }
  return null
}

async function fetchTotalsForAccounts(
  accounts: { id: string }[],
  datePreset: string,
  since?: string,
  until?: string
): Promise<Record<string, number>> {
  const settled = await Promise.allSettled(
    accounts.map(async (acc) => {
      try {
        const ins = await fetchInsights(acc.id, datePreset, since, until)
        const actions: Action[] = ins?.actions || []
        const actionValues: Action[] = ins?.action_values || []
        const spend = parseFloat(ins?.spend || '0')
        const purchases = getBest(actions, PURCHASE_PRIORITY)
        const leads = getBest(actions, LEAD_PRIORITY)
        const conversations = getBest(actions, CONV_PRIORITY)
        const revenue = getBest(actionValues, REVENUE_PRIORITY)
        const results = getBest(actions, RESULT_PRIORITY)
        return { spend, leads, purchases, conversations, revenue, results }
      } catch {
        return { spend: 0, leads: 0, purchases: 0, conversations: 0, revenue: 0, results: 0 }
      }
    })
  )
  return settled
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<Record<string, number>>).value)
    .reduce((acc, r) => ({
      spend: acc.spend + r.spend,
      leads: acc.leads + r.leads,
      purchases: acc.purchases + r.purchases,
      conversations: acc.conversations + r.conversations,
      revenue: acc.revenue + r.revenue,
      results: acc.results + r.results,
    }), { spend: 0, leads: 0, purchases: 0, conversations: 0, revenue: 0, results: 0 })
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || 'this_month'
  const since = searchParams.get('since') || undefined
  const until = searchParams.get('until') || undefined

  try {
    const rawAccounts = await getAllAccounts()
    const activeAccounts = rawAccounts.filter((a: { account_status: number }) => a.account_status === 1)

    const prevParams = getPrevPeriodParams(period)

    const [settled, prevTotals] = await Promise.all([
      Promise.allSettled(
        activeAccounts.map(async (acc: { id: string; name: string }) => {
          try {
            const ins = await fetchInsights(acc.id, period, since, until)
            const actions: Action[] = ins?.actions || []
            const actionValues: Action[] = ins?.action_values || []
            const spend = parseFloat(ins?.spend || '0')

            const purchases    = getBest(actions, PURCHASE_PRIORITY)
            const leads        = getBest(actions, LEAD_PRIORITY)
            const conversations = getBest(actions, CONV_PRIORITY)
            const addToCart    = Math.round(sumActions(actions, CART_TYPES))
            const initiateCheckout = Math.round(sumActions(actions, CHECKOUT_TYPES))
            const revenue      = getBest(actionValues, REVENUE_PRIORITY)

            const results = getBest(actions, RESULT_PRIORITY)
            const cpp = results > 0 ? spend / results : 0
            const type = detectType(leads, purchases, conversations)

            return {
              id: acc.id,
              name: acc.name,
              type,
              spend,
              leads,
              purchases,
              conversations,
              addToCart,
              initiateCheckout,
              revenue,
              results,
              cpp,
              impressions: parseInt(ins?.impressions || '0'),
              clicks: parseInt(ins?.clicks || '0'),
              ctr: parseFloat(ins?.ctr || '0'),
              reach: parseInt(ins?.reach || '0'),
            }
          } catch {
            return {
              id: acc.id, name: acc.name, type: 'lead' as const,
              spend: 0, leads: 0, purchases: 0, conversations: 0,
              addToCart: 0, initiateCheckout: 0, revenue: 0,
              results: 0, cpp: 0, impressions: 0, clicks: 0, ctr: 0, reach: 0,
            }
          }
        })
      ),
      prevParams
        ? fetchTotalsForAccounts(activeAccounts, prevParams.datePreset || 'last_month', prevParams.since, prevParams.until)
        : Promise.resolve(null),
    ])

    const rows = settled
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<unknown>).value as ReturnType<typeof Object.assign>)
      .filter((r: { spend: number; results: number }) => r.spend > 0 || r.results > 0)
      .sort((a: { spend: number }, b: { spend: number }) => b.spend - a.spend)

    const totals = rows.reduce((acc: Record<string, number>, r: Record<string, number>) => ({
      spend:         acc.spend + r.spend,
      leads:         acc.leads + r.leads,
      purchases:     acc.purchases + r.purchases,
      conversations: acc.conversations + r.conversations,
      addToCart:     acc.addToCart + r.addToCart,
      revenue:       acc.revenue + r.revenue,
      results:       acc.results + r.results,
      impressions:   acc.impressions + r.impressions,
      clicks:        acc.clicks + r.clicks,
    }), { spend: 0, leads: 0, purchases: 0, conversations: 0, addToCart: 0, revenue: 0, results: 0, impressions: 0, clicks: 0 })

    return NextResponse.json({ rows, totals, period, total_accounts: activeAccounts.length, prev_totals: prevTotals })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
