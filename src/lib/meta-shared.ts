// Shared Meta Graph API helpers — import from here, never redefine per-route

const BASE = 'https://graph.facebook.com/v20.0'

export const AD_FIELDS = [
  'spend', 'impressions', 'clicks', 'ctr', 'cpp', 'reach', 'frequency',
  'inline_link_clicks', 'outbound_clicks',
  'actions', 'cost_per_action_type',
  'video_30_sec_watched_actions',
  'video_thruplay_watched_actions',
].join(',')

export const VALID_PRESETS = new Set([
  'today', 'yesterday', 'last_7d', 'last_14d', 'last_28d', 'this_month', 'last_month',
])

// Known result action types — order doesn't matter, highest volume wins
const RESULT_TYPES = new Set([
  'purchase', 'omni_purchase',
  'lead', 'complete_registration', 'submit_application',
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.messaging_first_reply',
  'contact',
])

export type ActionList = { action_type: string; value: string }[]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function metaGet(path: string, params: Record<string, string> = {}): Promise<any> {
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('access_token', process.env.META_ACCESS_TOKEN!)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const r = await fetch(url.toString(), { cache: 'no-store' })
  const text = await r.text()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let j: any
  try { j = JSON.parse(text) } catch {
    throw new Error(`Meta API HTTP ${r.status}: ${text.slice(0, 120)}`)
  }
  if (j?.error) throw new Error(j.error?.message || String(j.error))
  return j
}

export async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i <= retries; i++) {
    try { return await fn() } catch (e) {
      lastErr = e
      if (i < retries) await new Promise(r => setTimeout(r, 700 * (i + 1)))
    }
  }
  throw lastErr
}

export async function concurrentMap<T, R>(items: T[], fn: (item: T) => Promise<R>, limit = 3): Promise<R[]> {
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

export function buildTimeParams(
  preset: string,
  since: string | null,
  until: string | null
): Record<string, string> {
  if (since && until) return { time_range: JSON.stringify({ since, until }) }
  return { date_preset: preset }
}

function getAction(actions: ActionList | undefined, type: string): number {
  return parseFloat(actions?.find(a => a.action_type === type)?.value || '0')
}

// Pick the result type with the highest volume — works correctly for both
// lead gen campaigns (78 leads > 1 conversation) and messaging campaigns (55 conversations > 1 lead)
export function getBestResult(actions?: ActionList): { type: string; value: number } {
  if (!actions) return { type: '', value: 0 }
  let best = { type: '', value: 0 }
  for (const a of actions) {
    if (!RESULT_TYPES.has(a.action_type)) continue
    const val = parseInt(a.value)
    if (val > best.value) best = { type: a.action_type, value: val }
  }
  return best
}

export function getCpr(cpa?: ActionList, resultType?: string): number {
  if (!cpa) return 0
  const type = resultType || ''
  if (type) {
    const v = parseFloat(cpa.find(a => a.action_type === type)?.value || '0')
    if (v > 0) return v
  }
  // fallback: highest CPA among known result types
  let best = 0
  for (const a of cpa) {
    if (!RESULT_TYPES.has(a.action_type)) continue
    const v = parseFloat(a.value)
    if (v > best) best = v
  }
  return best
}

export function processInsights(d: Record<string, unknown> | undefined) {
  if (!d) return null
  const actions = d.actions as ActionList | undefined
  const cpa = d.cost_per_action_type as ActionList | undefined
  const thruplay = d.video_thruplay_watched_actions as ActionList | undefined
  const imp = parseInt(d.impressions as string || '0')
  const videoView3s = getAction(actions, 'video_view')
  const { type: resultType, value: results } = getBestResult(actions)

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
    hookRate: imp > 0 && videoView3s > 0 ? (videoView3s / imp) * 100 : 0,
    videoView3s,
    thruplayCount: getAction(thruplay, 'video_view'),
    addToCart: getAction(actions, 'add_to_cart') || getAction(actions, 'onsite_web_add_to_cart'),
    profileVisits:
      getAction(actions, 'onsite_conversion.profile_visit') ||
      getAction(actions, 'instagram_profile_visit'),
    postEngagement: getAction(actions, 'post_engagement'),
    initiateCheckout: getAction(actions, 'initiate_checkout'),
    results,
    resultType,
    costPerResult: getCpr(cpa, resultType),
  }
}
