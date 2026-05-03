import { NextResponse } from 'next/server'

const BASE = 'https://graph.facebook.com/v20.0'
const TOKEN = process.env.META_ACCESS_TOKEN!

const AD_FIELDS = [
  'spend', 'impressions', 'clicks', 'ctr', 'cpp', 'reach', 'frequency',
  'inline_link_clicks', 'outbound_clicks',
  'actions', 'cost_per_action_type',
  'video_30_sec_watched_actions',
  'video_thruplay_watched_actions',
].join(',')

const VALID_PRESETS = new Set([
  'today','yesterday','last_7d','last_14d','last_28d','this_month','last_month',
])

type ActionList = { action_type: string; value: string }[]

async function metaGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('access_token', TOKEN)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const r = await fetch(url.toString(), { cache: 'no-store' })
  const j = await r.json()
  if (j.error) throw new Error(j.error.message)
  return j
}

function buildTime(preset: string, since: string | null, until: string | null): Record<string, string> {
  if (since && until) return { time_range: JSON.stringify({ since, until }) }
  return { date_preset: preset }
}

function getAction(actions: ActionList | undefined, type: string) {
  return parseFloat(actions?.find(a => a.action_type === type)?.value || '0')
}

const RESULT_PRIORITY = [
  'purchase','omni_purchase',
  'onsite_conversion.messaging_conversation_started_7d',
  'lead','complete_registration',
]

function getBest(actions?: ActionList) {
  if (!actions) return { type: '', value: 0 }
  for (const t of RESULT_PRIORITY) {
    const f = actions.find(a => a.action_type === t)
    if (f && parseInt(f.value) > 0) return { type: t, value: parseInt(f.value) }
  }
  return { type: '', value: 0 }
}

function getCpr(cpa?: ActionList) {
  if (!cpa) return 0
  for (const t of RESULT_PRIORITY) {
    const v = parseFloat(cpa.find(a => a.action_type === t)?.value || '0')
    if (v > 0) return v
  }
  return 0
}

function processIns(d: Record<string, unknown> | undefined) {
  if (!d) return null
  const actions = d.actions as ActionList | undefined
  const cpa = d.cost_per_action_type as ActionList | undefined
  const thruplay = d.video_thruplay_watched_actions as ActionList | undefined
  const imp = parseInt(d.impressions as string || '0')
  const videoView = getAction(actions, 'video_view')
  const { type: resultType, value: results } = getBest(actions)

  return {
    spend: parseFloat(d.spend as string || '0'),
    impressions: imp,
    clicks: parseInt(d.clicks as string || '0'),
    reach: parseInt(d.reach as string || '0'),
    frequency: parseFloat(d.frequency as string || '0'),
    ctr: parseFloat(d.ctr as string || '0'),
    cpp: parseFloat(d.cpp as string || '0'),
    linkClicks: parseInt(d.inline_link_clicks as string || '0'),
    outboundClicks: getAction(d.outbound_clicks as ActionList, 'outbound_click'),
    hookRate: imp > 0 && videoView > 0 ? (videoView / imp) * 100 : 0,
    videoView3s: videoView,
    thruplayCount: getAction(thruplay, 'video_view'),
    addToCart: getAction(actions, 'add_to_cart') || getAction(actions, 'onsite_web_add_to_cart'),
    profileVisits: getAction(actions, 'onsite_conversion.profile_visit') || getAction(actions, 'instagram_profile_visit'),
    postEngagement: getAction(actions, 'post_engagement'),
    initiateCheckout: getAction(actions, 'initiate_checkout'),
    results,
    resultType,
    costPerResult: getCpr(cpa),
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const accountId = id.startsWith('act_') ? id : `act_${id}`
  const { searchParams } = new URL(req.url)

  const period = VALID_PRESETS.has(searchParams.get('period') || '')
    ? searchParams.get('period')! : 'this_month'
  const since = searchParams.get('since')
  const until = searchParams.get('until')
  const tp = buildTime(period, since, until)

  try {
    // 1. Get ALL active campaigns
    const campData = await metaGet(`/${accountId}/campaigns`, {
      fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget',
      filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }]),
      limit: '100',
    })
    const campaigns: { id: string; name: string; objective: string; effective_status: string; daily_budget?: string; lifetime_budget?: string }[] = campData.data || []

    // 2. For each active campaign: fetch insights + adsets in parallel
    const enriched = await Promise.all(campaigns.map(async (c) => {
      const [campIns, adsetsData] = await Promise.allSettled([
        metaGet(`/${c.id}/insights`, { fields: AD_FIELDS, ...tp }).then(r => r.data?.[0]),
        metaGet(`/${c.id}/adsets`, {
          fields: 'id,name,status,effective_status,daily_budget,lifetime_budget,targeting',
          filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }]),
          limit: '100',
        }).then(r => r.data || []),
      ])

      const adsets: { id: string; name: string; effective_status: string }[] =
        adsetsData.status === 'fulfilled' ? adsetsData.value : []

      // 3. For each active adset: fetch insights in parallel
      const adsetsWithIns = await Promise.all(adsets.map(async (s) => {
        try {
          const ins = await metaGet(`/${s.id}/insights`, { fields: AD_FIELDS, ...tp })
          return { ...s, insights: processIns(ins.data?.[0]) }
        } catch {
          return { ...s, insights: null }
        }
      }))

      adsetsWithIns.sort((a, b) => (b.insights?.spend || 0) - (a.insights?.spend || 0))

      return {
        ...c,
        insights: campIns.status === 'fulfilled' ? processIns(campIns.value) : null,
        adsets: adsetsWithIns,
      }
    }))

    // Sort campaigns: most spend first
    enriched.sort((a, b) => (b.insights?.spend || 0) - (a.insights?.spend || 0))

    return NextResponse.json({ campaigns: enriched, period })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
