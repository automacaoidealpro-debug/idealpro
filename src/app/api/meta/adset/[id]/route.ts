import { NextResponse } from 'next/server'

const BASE_URL = 'https://graph.facebook.com/v20.0'
const TOKEN = process.env.META_ACCESS_TOKEN!

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
  const text = await res.text()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let j: any
  try { j = JSON.parse(text) } catch {
    throw new Error(`Meta API HTTP ${res.status}: resposta inválida. ${text.slice(0, 120)}`)
  }
  if (j?.error) throw new Error(j.error?.message || String(j.error))
  return j
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
  const thruplay = d.video_thruplay_watched_actions as ActionList | undefined

  const impressions = parseInt(d.impressions as string || '0')
  const videoView3s = getAction(actions, 'video_view')

  return {
    spend: parseFloat(d.spend as string || '0'),
    impressions,
    clicks: parseInt(d.clicks as string || '0'),
    reach: parseInt(d.reach as string || '0'),
    ctr: parseFloat(d.ctr as string || '0'),
    cpp: parseFloat(d.cpp as string || '0'),
    linkClicks: parseInt(d.inline_link_clicks as string || '0'),
    outboundClicks: getAction(d.outbound_clicks as ActionList, 'outbound_click'),
    hookRate: impressions > 0 && videoView3s > 0 ? (videoView3s / impressions) * 100 : 0,
    videoView3s,
    thruplayCount: getAction(thruplay, 'video_view'),
    profileVisits: getAction(actions, 'onsite_conversion.profile_visit')
      || getAction(actions, 'instagram_profile_visit'),
    postEngagement: getAction(actions, 'post_engagement'),
    addToCart: getAction(actions, 'add_to_cart') || getAction(actions, 'onsite_web_add_to_cart'),
    results: getBestResult(actions).value,
    costPerResult: getCpr(cpa),
  }
}

function buildTimeParams(preset: string, since: string | null, until: string | null): Record<string, string> {
  if (since && until) return { time_range: JSON.stringify({ since, until }) }
  return { date_preset: preset }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: adsetId } = await params
  const { searchParams } = new URL(req.url)

  const period = VALID_PRESETS.has(searchParams.get('period') || '')
    ? searchParams.get('period')!
    : 'this_month'
  const since = searchParams.get('since')
  const until = searchParams.get('until')
  const timeParams = buildTimeParams(period, since, until)

  try {
    const adsData = await metaFetch(`/${adsetId}/ads`, {
      fields: 'id,name,status,effective_status,creative{id,name,thumbnail_url,body,title}',
      limit: '200',
    })

    const ads = (adsData.data || []) as { id: string; name: string; effective_status: string }[]

    const adsWithInsights = await Promise.all(
      ads.map(async (ad) => {
        try {
          const ins = await metaFetch(`/${ad.id}/insights`, { fields: AD_FIELDS, ...timeParams })
          return { ...ad, insights: processInsights(ins.data?.[0]) }
        } catch {
          return { ...ad, insights: null }
        }
      })
    )

    adsWithInsights.sort((a, b) => (b.insights?.spend || 0) - (a.insights?.spend || 0))

    return NextResponse.json({ ads: adsWithInsights })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
