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
  'today', 'yesterday', 'last_7d', 'last_14d', 'last_28d', 'this_month', 'last_month',
])

type ActionList = { action_type: string; value: string }[]

async function metaGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('access_token', TOKEN)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const r = await fetch(url.toString(), { cache: 'no-store' })
  const text = await r.text()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let j: any
  try { j = JSON.parse(text) } catch {
    throw new Error(`Meta API HTTP ${r.status}: resposta inválida. ${text.slice(0, 120)}`)
  }
  if (j?.error) throw new Error(j.error?.message || String(j.error))
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
  'purchase', 'omni_purchase',
  'onsite_conversion.messaging_conversation_started_7d',
  'lead', 'complete_registration',
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

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i <= retries; i++) {
    try { return await fn() } catch (e) {
      lastErr = e
      if (i < retries) await new Promise(r => setTimeout(r, 600 * (i + 1)))
    }
  }
  throw lastErr
}

async function concurrentMap<T, R>(items: T[], fn: (item: T) => Promise<R>, limit = 5): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const i = idx++
      results[i] = await fn(items[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
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
    const [nameResult, campResult] = await Promise.allSettled([
      metaGet(`/${accountId}`, { fields: 'name' }),
      metaGet(`/${accountId}/campaigns`, {
        fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget',
        filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] }]),
        limit: '200',
      }),
    ])

    const accountName = nameResult.status === 'fulfilled' ? (nameResult.value.name || accountId) : accountId

    // Campaign list — fallback without filtering if API rejects the filtering param
    let campaigns: { id: string; name: string; objective: string; effective_status: string; daily_budget?: string; lifetime_budget?: string }[] = []
    if (campResult.status === 'fulfilled') {
      campaigns = campResult.value.data || []
    } else {
      try {
        const fb = await metaGet(`/${accountId}/campaigns`, {
          fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget',
          limit: '200',
        })
        campaigns = (fb.data || []).filter((c: { effective_status: string }) =>
          c.effective_status === 'ACTIVE' || c.effective_status === 'PAUSED')
      } catch { campaigns = [] }
    }

    // Fetch insights per campaign — 3 at a time with retry to handle rate limits
    const enriched = await concurrentMap(campaigns, async (c) => {
      try {
        const ins = await withRetry(() => metaGet(`/${c.id}/insights`, { fields: AD_FIELDS, ...tp }))
        return { ...c, insights: processIns(ins.data?.[0]), adsets: [] }
      } catch {
        return { ...c, insights: null, adsets: [] }
      }
    }, 3)

    // Always show ACTIVE; show PAUSED only if they had spend in the selected period
    const visible = enriched.filter(c =>
      c.effective_status === 'ACTIVE' || (c.insights?.spend || 0) > 0
    )

    visible.sort((a, b) => {
      if (a.effective_status === 'ACTIVE' && b.effective_status !== 'ACTIVE') return -1
      if (b.effective_status === 'ACTIVE' && a.effective_status !== 'ACTIVE') return 1
      return (b.insights?.spend || 0) - (a.insights?.spend || 0)
    })

    return NextResponse.json({ campaigns: visible, period, name: accountName })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
