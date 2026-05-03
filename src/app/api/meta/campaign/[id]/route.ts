import { NextResponse } from 'next/server'

const BASE_URL = 'https://graph.facebook.com/v20.0'
const TOKEN = process.env.META_ACCESS_TOKEN!

// Fields that give us everything needed for adset/ad analysis
const AD_FIELDS = [
  'spend', 'impressions', 'clicks', 'ctr', 'cpp', 'reach', 'frequency',
  'inline_link_clicks', 'outbound_clicks',
  'actions', 'cost_per_action_type',
  'video_30_sec_watched_actions',
  'video_thruplay_watched_actions',
].join(',')

const VALID_PRESETS = new Set([
  'today', 'yesterday', 'last_7d', 'last_14d', 'last_28d',
  'this_month', 'last_month',
])

async function metaFetch(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE_URL}${path}`)
  url.searchParams.set('access_token', TOKEN)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `Meta API ${res.status}`)
  }
  return res.json()
}

type ActionList = { action_type: string; value: string }[]

function getAction(actions: ActionList | undefined, type: string) {
  return parseFloat(actions?.find((a) => a.action_type === type)?.value || '0')
}

const RESULT_PRIORITY = [
  'purchase', 'omni_purchase',
  'onsite_conversion.messaging_conversation_started_7d',
  'lead',
  'complete_registration',
]

function getBestResult(actions?: ActionList) {
  if (!actions) return { type: '', value: 0 }
  for (const t of RESULT_PRIORITY) {
    const found = actions.find((a) => a.action_type === t)
    if (found && parseInt(found.value) > 0)
      return { type: t, value: parseInt(found.value) }
  }
  return { type: '', value: 0 }
}

function getCpr(cpa?: ActionList) {
  if (!cpa) return 0
  for (const t of RESULT_PRIORITY) {
    const v = parseFloat(cpa.find((a) => a.action_type === t)?.value || '0')
    if (v > 0) return v
  }
  return 0
}

function processInsights(d: Record<string, unknown> | undefined) {
  if (!d) return null
  const actions = d.actions as ActionList | undefined
  const cpa = d.cost_per_action_type as ActionList | undefined
  const videoViews30 = d.video_30_sec_watched_actions as ActionList | undefined
  const thruplay = d.video_thruplay_watched_actions as ActionList | undefined

  const impressions = parseInt(d.impressions as string || '0')
  const spend = parseFloat(d.spend as string || '0')

  // Hook Rate = 3-second video views / impressions × 100
  // Meta API: actions[video_view] = 3-second views
  const videoView3s = getAction(actions, 'video_view')
  const hookRate = impressions > 0 && videoView3s > 0
    ? (videoView3s / impressions) * 100
    : 0

  // ThruPlay count
  const thruplayCount = getAction(thruplay, 'video_view')

  // Video views at 30s (named differently by Meta)
  const videoView30s = getAction(videoViews30, 'video_view')

  // Link clicks on the ad (inline_link_clicks is a top-level field)
  const linkClicks = parseInt(d.inline_link_clicks as string || '0')

  // Outbound clicks (leaving to website)
  const outboundClicks = getAction(d.outbound_clicks as ActionList, 'outbound_click')

  // Instagram profile visits
  const profileVisits = getAction(actions, 'onsite_conversion.profile_visit')
    || getAction(actions, 'instagram_profile_visit')

  // Page/post engagement
  const postEngagement = getAction(actions, 'post_engagement')

  // Add to cart
  const addToCart = getAction(actions, 'add_to_cart') || getAction(actions, 'onsite_web_add_to_cart')

  const { value: results } = getBestResult(actions)
  const costPerResult = getCpr(cpa)

  return {
    spend,
    impressions,
    clicks: parseInt(d.clicks as string || '0'),
    reach: parseInt(d.reach as string || '0'),
    frequency: parseFloat(d.frequency as string || '0'),
    ctr: parseFloat(d.ctr as string || '0'),
    cpp: parseFloat(d.cpp as string || '0'),
    linkClicks,
    outboundClicks,
    hookRate,
    videoView3s,
    videoView30s,
    thruplayCount,
    profileVisits,
    postEngagement,
    addToCart,
    results,
    costPerResult,
  }
}

function buildTimeParams(preset: string, since: string | null, until: string | null): Record<string, string> {
  if (since && until) return { time_range: JSON.stringify({ since, until }) }
  return { date_preset: preset }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params
  const { searchParams } = new URL(req.url)

  const period = VALID_PRESETS.has(searchParams.get('period') || '')
    ? searchParams.get('period')!
    : 'this_month'
  const since = searchParams.get('since')
  const until = searchParams.get('until')
  const timeParams = buildTimeParams(period, since, until)

  try {
    // Campaign info
    const campaignInfo = await metaFetch(`/${campaignId}`, {
      fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget',
    })

    // All adsets for this campaign
    const adsetsData = await metaFetch(`/${campaignId}/adsets`, {
      fields: 'id,name,status,effective_status,daily_budget,lifetime_budget,targeting',
      limit: '100',
    })
    const adsets = adsetsData.data || []

    // Fetch insights for each adset in parallel
    const adsetsWithInsights = await Promise.all(
      adsets.map(async (adset: { id: string; name: string; status: string; effective_status: string }) => {
        try {
          const ins = await metaFetch(`/${adset.id}/insights`, {
            fields: AD_FIELDS,
            ...timeParams,
          })
          return {
            ...adset,
            insights: processInsights(ins.data?.[0]),
          }
        } catch {
          return { ...adset, insights: null }
        }
      })
    )

    // Sort: active first, then by spend
    adsetsWithInsights.sort((a, b) => {
      if (a.effective_status === 'ACTIVE' && b.effective_status !== 'ACTIVE') return -1
      if (b.effective_status === 'ACTIVE' && a.effective_status !== 'ACTIVE') return 1
      return (b.insights?.spend || 0) - (a.insights?.spend || 0)
    })

    // Campaign-level insights
    let campaignInsights = null
    try {
      const ci = await metaFetch(`/${campaignId}/insights`, {
        fields: AD_FIELDS,
        ...timeParams,
      })
      campaignInsights = processInsights(ci.data?.[0])
    } catch { /* ok */ }

    return NextResponse.json({
      campaign: campaignInfo,
      insights: campaignInsights,
      adsets: adsetsWithInsights,
      period,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
