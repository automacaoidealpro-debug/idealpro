import { NextResponse } from 'next/server'

const BASE = 'https://graph.facebook.com/v20.0'
const TOKEN = process.env.META_ACCESS_TOKEN!

const INSIGHT_FIELDS = [
  'spend', 'impressions', 'clicks', 'ctr', 'cpp', 'cpm', 'reach', 'frequency',
  'inline_link_clicks',
  'actions', 'cost_per_action_type', 'action_values',
  'video_30_sec_watched_actions', 'video_thruplay_watched_actions',
].join(',')

const BREAKDOWN_FIELDS = 'spend,impressions,clicks,ctr,cpp,reach,actions,cost_per_action_type'
const POSITION_FIELDS  = 'spend,impressions,clicks,ctr,cpp,reach'
const HOURLY_FIELDS    = 'spend,impressions,clicks,ctr,cpp,reach'  // actions not supported with hourly
const DAILY_FIELDS     = 'spend,impressions,clicks,ctr,cpp,reach,actions,cost_per_action_type'

type ActionList = { action_type: string; value: string }[]

async function metaGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('access_token', TOKEN)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const r = await fetch(url.toString(), { cache: 'no-store' })
  const j = await r.json()
  if (j.error) throw new Error(`Meta API: ${j.error.message}`)
  return j
}

function getAction(actions: ActionList | undefined, type: string): number {
  return parseFloat(actions?.find(a => a.action_type === type)?.value || '0')
}

// All known purchase-type actions
const PURCHASE_TYPES = [
  'purchase', 'omni_purchase',
  'fb_pixel_purchase', 'offsite_conversion.fb_pixel_purchase',
  'app_store_purchase', 'web_in_app_purchase',
]

// All known conversation/messaging-type actions
const CONVERSATION_TYPES = [
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.messaging_first_reply',
  'onsite_conversion.total_messaging_connection',
  'click_to_message_ad_contact_us',
  'onsite_conversion.messaging_welcome_message_view',
  'messaging_conversation_started_7d',
]

// All known lead-type actions
const LEAD_TYPES = [
  'lead', 'complete_registration',
  'fb_pixel_lead', 'offsite_conversion.fb_pixel_lead',
  'onsite_conversion.lead_grouped',
  'contact', 'submit_application',
  'find_location', 'schedule',
]

const RESULT_PRIORITY = [
  ...PURCHASE_TYPES,
  ...LEAD_TYPES,
  ...CONVERSATION_TYPES,
]

// Returns total count for a group of action types
function sumActions(actions: ActionList | undefined, types: string[]): number {
  if (!actions) return 0
  return types.reduce((acc, t) => {
    const row = actions.find(a => a.action_type === t)
    return acc + (row ? Math.round(parseFloat(row.value)) : 0)
  }, 0)
}

// Returns per-type conversion breakdown (leads, purchases, conversations, total)
function getConversionBreakdown(actions: ActionList | undefined) {
  const purchases = sumActions(actions, PURCHASE_TYPES)
  const conversations = sumActions(actions, CONVERSATION_TYPES)
  const leads = sumActions(actions, LEAD_TYPES)
  const total = purchases + conversations + leads
  // Use highest volume as primary type (works for lead gen AND messaging campaigns)
  let primaryType = ''
  if (purchases > 0 && purchases >= leads && purchases >= conversations) primaryType = 'purchase'
  else if (leads > 0 && leads >= conversations) primaryType = 'lead'
  else if (conversations > 0) primaryType = 'conversation'
  return { purchases, conversations, leads, total, primaryType }
}

function getBest(actions?: ActionList): { type: string; value: number } {
  if (!actions) return { type: '', value: 0 }
  let best = { type: '', value: 0 }
  for (const t of RESULT_PRIORITY) {
    const f = actions.find(a => a.action_type === t)
    if (f) { const val = parseInt(f.value); if (val > best.value) best = { type: t, value: val } }
  }
  return best
}

function getCpr(cpa?: ActionList, resultType?: string): number {
  if (!cpa) return 0
  if (resultType) {
    const v = parseFloat(cpa.find(a => a.action_type === resultType)?.value || '0')
    if (v > 0) return v
  }
  for (const t of RESULT_PRIORITY) {
    const v = parseFloat(cpa.find(a => a.action_type === t)?.value || '0')
    if (v > 0) return v
  }
  return 0
}

function processInsights(d: Record<string, unknown> | undefined) {
  if (!d) return null
  const actions = d.actions as ActionList | undefined
  const cpa = d.cost_per_action_type as ActionList | undefined
  const thruplay = d.video_thruplay_watched_actions as ActionList | undefined
  const actionValues = d.action_values as ActionList | undefined
  const imp = parseInt(d.impressions as string || '0')
  const videoView = getAction(actions, 'video_view')
  const spend = parseFloat(d.spend as string || '0')
  const { type: resultType, value: results } = getBest(actions)
  const purchaseValue = getAction(actionValues, 'purchase') || getAction(actionValues, 'omni_purchase')

  return {
    spend,
    impressions: imp,
    clicks: parseInt(d.clicks as string || '0'),
    reach: parseInt(d.reach as string || '0'),
    frequency: parseFloat(d.frequency as string || '0'),
    ctr: parseFloat(d.ctr as string || '0'),
    cpp: parseFloat(d.cpp as string || '0'),
    cpm: parseFloat(d.cpm as string || '0'),
    linkClicks: parseInt(d.inline_link_clicks as string || '0'),
    hookRate: imp > 0 && videoView > 0 ? (videoView / imp) * 100 : 0,
    videoView3s: videoView,
    thruplayCount: getAction(thruplay, 'video_view'),
    addToCart: getAction(actions, 'add_to_cart') || getAction(actions, 'onsite_web_add_to_cart'),
    profileVisits: getAction(actions, 'onsite_conversion.profile_visit') || getAction(actions, 'instagram_profile_visit'),
    postEngagement: getAction(actions, 'post_engagement'),
    initiateCheckout: getAction(actions, 'initiate_checkout'),
    results,
    resultType,
    costPerResult: getCpr(cpa, resultType),
    purchaseValue,
    roas: purchaseValue > 0 && spend > 0 ? purchaseValue / spend : 0,
    messaging_conversations: getAction(actions, 'onsite_conversion.messaging_conversation_started_7d'),
    leads: getAction(actions, 'lead') || getAction(actions, 'complete_registration'),
  }
}

function processBreakdown(rows: Record<string, unknown>[] | undefined, segmentKey: string) {
  if (!rows || rows.length === 0) return []
  return rows.map(r => {
    const actions = r.actions as ActionList | undefined
    const cpa = r.cost_per_action_type as ActionList | undefined
    const { type: resultType, value: results } = getBest(actions)
    const conv = getConversionBreakdown(actions)
    return {
      segment: String(r[segmentKey] || ''),
      spend: parseFloat(r.spend as string || '0'),
      impressions: parseInt(r.impressions as string || '0'),
      clicks: parseInt(r.clicks as string || '0'),
      ctr: parseFloat(r.ctr as string || '0'),
      cpp: parseFloat(r.cpp as string || '0'),
      reach: parseInt(r.reach as string || '0'),
      results: conv.total > 0 ? conv.total : results,
      resultType: conv.primaryType || resultType,
      costPerResult: getCpr(cpa, resultType),
      leads: conv.leads,
      purchases: conv.purchases,
      conversations: conv.conversations,
    }
  }).filter(r => r.spend > 0).sort((a, b) => b.spend - a.spend)
}

// ── Hourly: 0-23 ──────────────────────────────────────────────────────────────
function processHourly(rows: Record<string, unknown>[] | undefined) {
  if (!rows || rows.length === 0) return []
  return rows.map(r => {
    const hourStr = String(r.hourly_stats_aggregated_by_advertiser_time_zone || '0')
    const hour = parseInt(hourStr)
    const spend = parseFloat(r.spend as string || '0')
    const impressions = parseInt(r.impressions as string || '0')
    const clicks = parseInt(r.clicks as string || '0')
    return {
      hour,
      label: `${String(hour).padStart(2, '0')}h`,
      spend,
      impressions,
      clicks,
      ctr: parseFloat(r.ctr as string || '0'),
      cpp: parseFloat(r.cpp as string || '0'),
    }
  }).filter(r => r.spend > 0).sort((a, b) => a.hour - b.hour)
}

// ── Daily → day-of-week + week-of-month ──────────────────────────────────────
const DAY_NAMES = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function processDailyData(rows: Record<string, unknown>[] | undefined) {
  if (!rows || rows.length === 0) return { byDayOfWeek: [], byWeekOfMonth: [] }

  type Bucket = { spend: number; results: number; clicks: number; impressions: number; days: number }
  const dow: Record<number, Bucket> = {}
  const wom: Record<number, Bucket> = {}

  for (const r of rows) {
    const dateStr = r.date_start as string
    if (!dateStr) continue
    const date = new Date(`${dateStr}T12:00:00Z`)
    const dayOfWeek = date.getUTCDay()           // 0=Sun … 6=Sat
    const week = Math.min(Math.ceil(date.getUTCDate() / 7), 4) // 1-4

    const actions = r.actions as ActionList | undefined
    const { value: results } = getBest(actions)
    const spend = parseFloat(r.spend as string || '0')
    const clicks = parseInt(r.clicks as string || '0')
    const impressions = parseInt(r.impressions as string || '0')

    for (const [map, key] of [[dow, dayOfWeek], [wom, week]] as [Record<number, Bucket>, number][]) {
      if (!map[key]) map[key] = { spend: 0, results: 0, clicks: 0, impressions: 0, days: 0 }
      map[key].spend += spend
      map[key].results += results
      map[key].clicks += clicks
      map[key].impressions += impressions
      map[key].days += 1
    }
  }

  const byDayOfWeek = Object.entries(dow).map(([d, b]) => ({
    day: parseInt(d),
    name: DAY_NAMES[parseInt(d)],
    spend: b.spend,
    results: b.results,
    clicks: b.clicks,
    impressions: b.impressions,
    avgSpend: b.days > 0 ? b.spend / b.days : 0,
    ctr: b.impressions > 0 ? (b.clicks / b.impressions) * 100 : 0,
    costPerResult: b.spend > 0 && b.results > 0 ? b.spend / b.results : 0,
  })).filter(d => d.spend > 0).sort((a, b) => a.day - b.day)

  const byWeekOfMonth = Object.entries(wom).map(([w, b]) => ({
    week: parseInt(w),
    name: `${parseInt(w)}ª semana`,
    spend: b.spend,
    results: b.results,
    clicks: b.clicks,
    impressions: b.impressions,
    ctr: b.impressions > 0 ? (b.clicks / b.impressions) * 100 : 0,
    costPerResult: b.spend > 0 && b.results > 0 ? b.spend / b.results : 0,
  })).filter(w => w.spend > 0).sort((a, b) => a.week - b.week)

  return { byDayOfWeek, byWeekOfMonth }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const accountId = id.startsWith('act_') ? id : `act_${id}`
  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') || 'last_7d'
  const since = searchParams.get('since')
  const until = searchParams.get('until')
  const tp: Record<string, string> = since && until
    ? { time_range: JSON.stringify({ since, until }) }
    : { date_preset: period }

  // For daily breakdown we need at least 14d to see day-of-week patterns
  const dailyTp: Record<string, string> = since && until
    ? { time_range: JSON.stringify({ since, until }) }
    : { date_preset: ['today', 'yesterday'].includes(period) ? 'last_14d' : period }

  try {
    // ── 1. All account-level calls in parallel ────────────────────────────────
    const [
      accountInfo,
      campData, accountIns,
      genderBreak, ageBreak,
      platformBreak, posBreak,
      regionBreak, cityBreak,
      hourlyBreak, dailyData,
      deviceBreak,
    ] = await Promise.allSettled([
      metaGet(`/${accountId}`, { fields: 'name' }),
      metaGet(`/${accountId}/campaigns`, {
        fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,bid_strategy',
        filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }]),
        limit: '50',
      }),
      metaGet(`/${accountId}/insights`, { fields: INSIGHT_FIELDS, ...tp }).then(r => r.data?.[0]),
      // demographic
      metaGet(`/${accountId}/insights`, { fields: BREAKDOWN_FIELDS, breakdowns: 'gender', ...tp }).then(r => r.data),
      metaGet(`/${accountId}/insights`, { fields: BREAKDOWN_FIELDS, breakdowns: 'age', ...tp }).then(r => r.data),
      // platform WITH actions (platform alone allows actions)
      metaGet(`/${accountId}/insights`, { fields: BREAKDOWN_FIELDS, breakdowns: 'publisher_platform', ...tp }).then(r => r.data).catch(() => []),
      // position detail WITHOUT actions (combined breakdown restriction)
      metaGet(`/${accountId}/insights`, { fields: POSITION_FIELDS, breakdowns: 'publisher_platform,platform_position', ...tp }).then(r => r.data).catch(() => []),
      // geographic
      metaGet(`/${accountId}/insights`, { fields: BREAKDOWN_FIELDS, breakdowns: 'region', ...tp }).then(r => r.data),
      metaGet(`/${accountId}/insights`, { fields: BREAKDOWN_FIELDS, breakdowns: 'city', ...tp }).then(r => r.data),
      // temporal
      metaGet(`/${accountId}/insights`, { fields: HOURLY_FIELDS, breakdowns: 'hourly_stats_aggregated_by_advertiser_time_zone', ...tp }).then(r => r.data),
      metaGet(`/${accountId}/insights`, { fields: DAILY_FIELDS, time_increment: '1', ...dailyTp }).then(r => r.data),
      // device (mobile/desktop/tablet)
      metaGet(`/${accountId}/insights`, { fields: BREAKDOWN_FIELDS, breakdowns: 'impression_device', ...tp }).then(r => r.data).catch(() => []),
    ])

    const accountName = accountInfo.status === 'fulfilled' ? (accountInfo.value.name as string) : accountId

    const campaigns: Record<string, unknown>[] =
      campData.status === 'fulfilled' ? (campData.value.data || []) : []

    // ── 2. Each campaign: insights + adsets ──────────────────────────────────
    const enrichedCampaigns = await Promise.all(campaigns.map(async (c) => {
      const cid = c.id as string
      const [campInsResult, adsetsResult] = await Promise.allSettled([
        metaGet(`/${cid}/insights`, { fields: INSIGHT_FIELDS, ...tp }).then(r => r.data?.[0]),
        metaGet(`/${cid}/adsets`, {
          fields: 'id,name,status,effective_status,daily_budget,lifetime_budget,targeting,bid_strategy,optimization_goal',
          filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }]),
          limit: '50',
        }).then(r => r.data || []),
      ])

      const adsets: Record<string, unknown>[] =
        adsetsResult.status === 'fulfilled' ? adsetsResult.value : []

      // ── 3. Each adset: insights + ads ──────────────────────────────────────
      const adsetsWithData = await Promise.all(adsets.map(async (s) => {
        const sid = s.id as string
        const [adsetInsResult, adsResult] = await Promise.allSettled([
          metaGet(`/${sid}/insights`, { fields: INSIGHT_FIELDS, ...tp }).then(r => r.data?.[0]),
          metaGet(`/${sid}/ads`, {
            fields: 'id,name,effective_status,creative{thumbnail_url,name,body,title}',
            filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE'] }]),
            limit: '30',
          }).then(r => r.data || []),
        ])

        const ads: Record<string, unknown>[] =
          adsResult.status === 'fulfilled' ? adsResult.value : []

        // ── 4. Ad insights ──────────────────────────────────────────────────
        const adsWithIns = await Promise.all(ads.map(async (ad) => {
          try {
            const adIns = await metaGet(`/${ad.id}/insights`, { fields: INSIGHT_FIELDS, ...tp })
            const cr = ad.creative as Record<string, unknown> | undefined
            return { id: ad.id, name: ad.name, status: ad.effective_status, thumbnail: cr?.thumbnail_url || null, creative_name: cr?.name || null, insights: processInsights(adIns.data?.[0]) }
          } catch {
            const cr = ad.creative as Record<string, unknown> | undefined
            return { id: ad.id, name: ad.name, status: ad.effective_status, thumbnail: cr?.thumbnail_url || null, creative_name: cr?.name || null, insights: null }
          }
        }))

        adsWithIns.sort((a, b) => (b.insights?.spend || 0) - (a.insights?.spend || 0))

        const targeting = s.targeting as Record<string, unknown> | undefined
        const geoLoc = targeting?.geo_locations as Record<string, unknown> | undefined

        return {
          id: sid,
          name: s.name,
          status: s.effective_status,
          daily_budget: s.daily_budget,
          optimization_goal: s.optimization_goal,
          targeting_summary: targeting ? {
            geo: geoLoc?.cities || geoLoc?.regions || geoLoc?.countries || null,
            age_min: targeting.age_min,
            age_max: targeting.age_max,
            genders: targeting.genders,
            has_custom_audiences: Array.isArray(targeting.custom_audiences) && (targeting.custom_audiences as unknown[]).length > 0,
            has_interests: Array.isArray(targeting.flexible_spec) && (targeting.flexible_spec as unknown[]).length > 0,
          } : null,
          insights: adsetInsResult.status === 'fulfilled' ? processInsights(adsetInsResult.value) : null,
          ads: adsWithIns,
        }
      }))

      adsetsWithData.sort((a, b) => (b.insights?.spend || 0) - (a.insights?.spend || 0))

      return {
        id: cid, name: c.name, objective: c.objective, status: c.effective_status,
        daily_budget: c.daily_budget, lifetime_budget: c.lifetime_budget, bid_strategy: c.bid_strategy,
        insights: campInsResult.status === 'fulfilled' ? processInsights(campInsResult.value) : null,
        adsets: adsetsWithData,
      }
    }))

    enrichedCampaigns.sort((a, b) => (b.insights?.spend || 0) - (a.insights?.spend || 0))

    // ── Process position detail breakdown (no actions — Meta API restriction) ─
    const posData = posBreak.status === 'fulfilled' ? (posBreak.value || []) : []
    const posProcessed = posData.map((r: Record<string, unknown>) => ({
      segment: `${r.publisher_platform}/${r.platform_position}`,
      spend: parseFloat(r.spend as string || '0'),
      impressions: parseInt(r.impressions as string || '0'),
      ctr: parseFloat(r.ctr as string || '0'),
      cpp: parseFloat(r.cpp as string || '0'),
      reach: parseInt(r.reach as string || '0'),
    })).filter((r: { spend: number }) => r.spend > 0).sort((a: { spend: number }, b: { spend: number }) => b.spend - a.spend)

    // ── Process platform breakdown (with conversions) ─────────────────────────
    // If publisher_platform + actions call succeeded, use it.
    // Otherwise aggregate spend/metrics from posProcessed (no conversions in that case).
    let platProcessed = platformBreak.status === 'fulfilled' && (platformBreak.value || []).length > 0
      ? processBreakdown(platformBreak.value, 'publisher_platform')
      : []

    if (platProcessed.length === 0 && posProcessed.length > 0) {
      // Fallback: aggregate position rows into platform rows (no conversion data)
      const byPlatform: Record<string, { spend: number; impressions: number; clicks: number; reach: number; ctr: number; cpp: number }> = {}
      for (const p of posProcessed) {
        const platform = p.segment.split('/')[0]
        if (!byPlatform[platform]) byPlatform[platform] = { spend: 0, impressions: 0, clicks: 0, reach: 0, ctr: 0, cpp: 0 }
        byPlatform[platform].spend += p.spend
        byPlatform[platform].impressions += p.impressions
        byPlatform[platform].reach += p.reach
      }
      platProcessed = Object.entries(byPlatform).map(([seg, b]) => ({
        segment: seg,
        spend: b.spend,
        impressions: b.impressions,
        clicks: 0, ctr: b.impressions > 0 ? 0 : 0, cpp: 0, reach: b.reach,
        results: 0, resultType: '', costPerResult: 0,
        leads: 0, purchases: 0, conversations: 0,
      })).filter(r => r.spend > 0).sort((a, b) => b.spend - a.spend)
    }

    // ── Process daily data → day-of-week + week-of-month ─────────────────────
    const { byDayOfWeek, byWeekOfMonth } = processDailyData(
      dailyData.status === 'fulfilled' ? dailyData.value : undefined
    )

    return NextResponse.json({
      period,
      account: {
        id: accountId,
        name: accountName,
        insights: accountIns.status === 'fulfilled' ? processInsights(accountIns.value) : null,
        breakdowns: {
          gender:            genderBreak.status === 'fulfilled' ? processBreakdown(genderBreak.value, 'gender') : [],
          age:               ageBreak.status === 'fulfilled'    ? processBreakdown(ageBreak.value, 'age')       : [],
          platform:          platProcessed,
          platform_position: posProcessed,
          device:            deviceBreak.status === 'fulfilled' ? processBreakdown(deviceBreak.value, 'impression_device') : [],
          region:            regionBreak.status === 'fulfilled' ? processBreakdown(regionBreak.value, 'region') : [],
          city:              cityBreak.status === 'fulfilled'   ? processBreakdown(cityBreak.value, 'city')     : [],
          hourly:            hourlyBreak.status === 'fulfilled' ? processHourly(hourlyBreak.value)              : [],
          byDayOfWeek,
          byWeekOfMonth,
        },
      },
      campaigns: enrichedCampaigns,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
