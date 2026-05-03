import { NextResponse } from 'next/server'
import { getAllAccounts } from '@/lib/meta-api'

const BASE_URL = 'https://graph.facebook.com/v20.0'
const TOKEN = process.env.META_ACCESS_TOKEN

const PURCHASE_TYPES = ['purchase', 'omni_purchase', 'fb_pixel_purchase', 'offsite_conversion.fb_pixel_purchase']
const LEAD_TYPES = ['lead', 'complete_registration', 'fb_pixel_lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped']
const CONV_TYPES = ['onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.messaging_first_reply', 'click_to_message_ad_contact_us', 'contact']
const CART_TYPES = ['add_to_cart', 'omni_add_to_cart', 'fb_pixel_add_to_cart', 'offsite_conversion.fb_pixel_add_to_cart']
const REVENUE_TYPES = ['omni_revenue', 'purchase_roas', 'offsite_conversion.fb_pixel_purchase.value', 'fb_pixel_purchase.value']
const CHECKOUT_TYPES = ['initiate_checkout', 'omni_initiated_checkout', 'fb_pixel_initiated_checkout']

function sumActions(actions: { action_type: string; value: string }[], types: string[]) {
  return actions.filter(a => types.includes(a.action_type)).reduce((s, a) => s + parseFloat(a.value || '0'), 0)
}

function detectType(leads: number, purchases: number, conversations: number): 'lead' | 'ecommerce' | 'conversa' {
  if (purchases > 0 && purchases >= leads && purchases >= conversations) return 'ecommerce'
  if (conversations > leads && conversations > purchases) return 'conversa'
  return 'lead'
}

async function fetchInsights(accountId: string, datePreset: string, since?: string, until?: string) {
  const url = new URL(`${BASE_URL}/${accountId}/insights`)
  url.searchParams.set('access_token', TOKEN!)
  url.searchParams.set('fields', 'spend,impressions,clicks,reach,ctr,cpm,cpp,actions,action_values')
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || 'this_month'
  const since = searchParams.get('since') || undefined
  const until = searchParams.get('until') || undefined

  try {
    const rawAccounts = await getAllAccounts()
    const activeAccounts = rawAccounts.filter((a: { account_status: number }) => a.account_status === 1)

    const results = await Promise.allSettled(
      activeAccounts.map(async (acc: { id: string; name: string }) => {
        try {
          const ins = await fetchInsights(acc.id, period, since, until)
          const actions: { action_type: string; value: string }[] = ins?.actions || []
          const actionValues: { action_type: string; value: string }[] = ins?.action_values || []
          const spend = parseFloat(ins?.spend || '0')

          const leads = Math.round(sumActions(actions, LEAD_TYPES))
          const purchases = Math.round(sumActions(actions, PURCHASE_TYPES))
          const conversations = Math.round(sumActions(actions, CONV_TYPES))
          const addToCart = Math.round(sumActions(actions, CART_TYPES))
          const initiateCheckout = Math.round(sumActions(actions, CHECKOUT_TYPES))
          const revenue = sumActions(actionValues, REVENUE_TYPES) || sumActions(actions, REVENUE_TYPES)
          const results = leads + purchases + conversations
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
    )

    const rows = results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<unknown>).value as ReturnType<typeof Object.assign>)
      .filter((r: { spend: number; results: number }) => r.spend > 0 || r.results > 0)
      .sort((a: { spend: number }, b: { spend: number }) => b.spend - a.spend)

    const totals = rows.reduce((acc: Record<string, number>, r: Record<string, number>) => ({
      spend: acc.spend + r.spend,
      leads: acc.leads + r.leads,
      purchases: acc.purchases + r.purchases,
      conversations: acc.conversations + r.conversations,
      addToCart: acc.addToCart + r.addToCart,
      revenue: acc.revenue + r.revenue,
      results: acc.results + r.results,
      impressions: acc.impressions + r.impressions,
      clicks: acc.clicks + r.clicks,
    }), { spend: 0, leads: 0, purchases: 0, conversations: 0, addToCart: 0, revenue: 0, results: 0, impressions: 0, clicks: 0 })

    return NextResponse.json({ rows, totals, period, total_accounts: activeAccounts.length })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
