import { NextResponse } from 'next/server'

const BASE_URL = 'https://graph.facebook.com/v20.0'
const TOKEN = process.env.META_ACCESS_TOKEN!

// Fields that work with action-based breakdowns (gender, age, region, platform)
const ACTION_FIELDS =
  'spend,impressions,clicks,reach,ctr,cpm,cpp,frequency,actions,cost_per_action_type'

// Fields for position breakdown — Meta API rejects actions + platform_position
const POSITION_FIELDS = 'spend,impressions,clicks,ctr,cpp,cpm'

const VALID_PRESETS = new Set([
  'today', 'yesterday', 'last_7d', 'last_14d', 'last_28d',
  'this_month', 'last_month', 'last_quarter',
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

// Build time params — either date_preset or time_range
function buildTimeParams(preset: string, since: string | null, until: string | null): Record<string, string> {
  if (since && until) {
    return { time_range: JSON.stringify({ since, until }) }
  }
  return { date_preset: preset }
}

async function getInsights(
  accountId: string,
  timeParams: Record<string, string>,
  extra: Record<string, string> = {},
  fields = ACTION_FIELDS
) {
  try {
    const data = await metaFetch(`/${accountId}/insights`, {
      fields,
      level: 'account',
      ...timeParams,
      ...extra,
    })
    return data.data || []
  } catch {
    return []
  }
}

// ─── Action helpers ──────────────────────────────────────────────────────────
type ActionList = { action_type: string; value: string }[]

// Strict priority — link_click excluded (volume, not conversion)
const RESULT_PRIORITY = [
  'purchase',
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.messaging_first_reply',
  'lead',
  'complete_registration',
  'submit_application',
]

function getBestResult(actions?: ActionList): { type: string; value: number } {
  if (!actions) return { type: '', value: 0 }
  for (const t of RESULT_PRIORITY) {
    const found = actions.find((a) => a.action_type === t)
    if (found && parseInt(found.value) > 0)
      return { type: t, value: parseInt(found.value) }
  }
  return { type: '', value: 0 }
}

function getCostPerResult(cpa?: ActionList): number {
  if (!cpa) return 0
  for (const t of RESULT_PRIORITY) {
    const found = cpa.find((a) => a.action_type === t)
    if (found && parseFloat(found.value) > 0) return parseFloat(found.value)
  }
  return 0
}

function detectResultType(actions?: ActionList): string {
  if (!actions) return 'Resultados'
  const { type } = getBestResult(actions)
  if (type === 'purchase') return 'Compras'
  if (type.includes('conversation') || type.includes('messaging')) return 'Conversas iniciadas'
  if (type.includes('first_reply')) return 'Primeiras respostas'
  if (type === 'lead') return 'Leads'
  if (type === 'complete_registration') return 'Cadastros'
  return 'Resultados'
}

// ─── Breakdown helpers ────────────────────────────────────────────────────────
interface DailyRow {
  date_start: string
  spend: string
  impressions: string
  clicks: string
  ctr: string
  cpp: string
  actions?: ActionList
  cost_per_action_type?: ActionList
  [key: string]: unknown
}

interface Agg {
  spend: number; impressions: number; clicks: number
  results: number; costSum: number; costCount: number
}

function newAgg(): Agg {
  return { spend: 0, impressions: 0, clicks: 0, results: 0, costSum: 0, costCount: 0 }
}

function addRow(agg: Agg, row: DailyRow) {
  agg.spend += parseFloat(row.spend || '0')
  agg.impressions += parseInt(row.impressions || '0')
  agg.clicks += parseInt(row.clicks || '0')
  agg.results += getBestResult(row.actions).value
  const cpr = getCostPerResult(row.cost_per_action_type)
  if (cpr > 0) { agg.costSum += cpr; agg.costCount++ }
}

function finalizeAgg(agg: Agg, label: string) {
  return {
    label,
    spend: agg.spend,
    impressions: agg.impressions,
    clicks: agg.clicks,
    ctr: agg.impressions > 0 ? (agg.clicks / agg.impressions) * 100 : 0,
    cpp: agg.results > 0 ? agg.spend / agg.results : 0,
    results: agg.results,
    costPerResult: agg.costCount > 0 ? agg.costSum / agg.costCount : 0,
  }
}

function aggregateByDayOfWeek(rows: DailyRow[]) {
  const PT = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  const map: Record<string, Agg> = {}
  for (const row of rows) {
    const label = PT[new Date(row.date_start + 'T12:00:00').getDay()]
    if (!map[label]) map[label] = newAgg()
    addRow(map[label], row)
  }
  const order = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo']
  return order.filter((k) => map[k]).map((k) => finalizeAgg(map[k], k))
}

function aggregateByWeekOfMonth(rows: DailyRow[]) {
  const map: Record<string, Agg> = {}
  for (const row of rows) {
    const d = new Date(row.date_start + 'T12:00:00')
    const label = `Semana ${Math.ceil(d.getDate() / 7)}`
    if (!map[label]) map[label] = newAgg()
    addRow(map[label], row)
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, agg]) => finalizeAgg(agg, label))
}

function mapBreakdownRows(
  rows: DailyRow[],
  labelKey: string,
  labelMap?: Record<string, string>
) {
  return rows.map((r) => {
    const raw = String(r[labelKey] ?? '—')
    return {
      label: labelMap?.[raw] ?? raw,
      spend: parseFloat(r.spend || '0'),
      impressions: parseInt(r.impressions || '0'),
      clicks: parseInt(r.clicks || '0'),
      ctr: parseFloat(r.ctr || '0'),
      cpp: parseFloat(r.cpp || '0'),
      results: getBestResult(r.actions).value,
      costPerResult: getCostPerResult(r.cost_per_action_type),
    }
  })
}

// Position rows — no actions available at this breakdown level (Meta API restriction)
function mapPositionRows(rows: DailyRow[]) {
  const PLAT: Record<string, string> = {
    facebook: 'Facebook', instagram: 'Instagram',
    messenger: 'Messenger', audience_network: 'Audience Network',
  }
  const POS: Record<string, string> = {
    feed: 'Feed', story: 'Stories', reels: 'Reels',
    facebook_reels: 'Reels', instagram_reels: 'Reels', instagram_stories: 'Stories',
    instagram_explore: 'Explore', instagram_explore_grid_home: 'Explore Grid',
    instagram_profile_feed: 'Perfil', facebook_stories: 'Stories',
    facebook_profile_feed: 'Perfil', right_hand_column: 'Coluna Direita',
    instream_video: 'In-stream', marketplace: 'Marketplace',
    search: 'Busca', video_feeds: 'Feed de Vídeo',
    an_classic: 'Audience Network', rewarded_video: 'Vídeo Recompensado',
    facebook_notification: 'Notificação', facebook_reels_overlay: 'Reels Overlay',
    threads_feed: 'Threads Feed',
  }

  return rows
    .map((r) => {
      const plat = String(r['publisher_platform'] ?? '')
      const pos = String(r['platform_position'] ?? '')
      const platLabel = PLAT[plat] ?? plat
      const posLabel = POS[pos] ?? pos
      return {
        label: `${platLabel} — ${posLabel}`,
        spend: parseFloat(r.spend || '0'),
        impressions: parseInt(r.impressions || '0'),
        clicks: parseInt(r.clicks || '0'),
        ctr: parseFloat(r.ctr || '0'),
        cpp: parseFloat(r.cpp || '0'),
        results: 0,        // Not available at this breakdown level
        costPerResult: 0,
      }
    })
    .filter((r) => r.spend > 0)
    .sort((a, b) => b.spend - a.spend)
}

const PLATFORM_LABELS: Record<string, string> = {
  facebook: 'Facebook', instagram: 'Instagram',
  messenger: 'Messenger', audience_network: 'Audience Network',
}
const GENDER_LABELS: Record<string, string> = {
  male: 'Masculino', female: 'Feminino', unknown: 'Desconhecido',
}

// ─── Campaigns ───────────────────────────────────────────────────────────────
async function getCampaigns(accountId: string, timeParams: Record<string, string>) {
  try {
    const data = await metaFetch(`/${accountId}/campaigns`, {
      fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget',
      limit: '100',
    })
    const campaigns = data.data || []
    const withInsights = await Promise.all(
      campaigns.map(async (c: { id: string; effective_status: string }) => {
        if (c.effective_status !== 'ACTIVE')
          return { ...c, spend: 0, results: 0, costPerResult: 0, impressions: 0, ctr: 0, cpp: 0 }
        try {
          const ins = await metaFetch(`/${c.id}/insights`, {
            fields: 'spend,actions,impressions,ctr,cpp,cost_per_action_type',
            ...timeParams,
          })
          const d = ins.data?.[0]
          return {
            ...c,
            spend: parseFloat(d?.spend || '0'),
            results: getBestResult(d?.actions).value,
            costPerResult: getCostPerResult(d?.cost_per_action_type),
            impressions: parseInt(d?.impressions || '0'),
            ctr: parseFloat(d?.ctr || '0'),
            cpp: parseFloat(d?.cpp || '0'),
          }
        } catch {
          return { ...c, spend: 0, results: 0, costPerResult: 0, impressions: 0, ctr: 0, cpp: 0 }
        }
      })
    )
    return withInsights
  } catch {
    return []
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const accountId = id.startsWith('act_') ? id : `act_${id}`

  const { searchParams } = new URL(req.url)
  const period = VALID_PRESETS.has(searchParams.get('period') || '')
    ? searchParams.get('period')!
    : 'this_month'
  const since = searchParams.get('since')
  const until = searchParams.get('until')

  const timeParams = buildTimeParams(period, since, until)
  const todayParams = buildTimeParams('today', null, null)
  const weekParams = buildTimeParams('last_7d', null, null)

  // For daily aggregations — use same custom range or fall back to last_28d
  const dailyParams: Record<string, string> = since && until
    ? { time_range: JSON.stringify({ since, until }), time_increment: '1' }
    : { date_preset: period === 'today' || period === 'yesterday' ? 'last_7d' : period, time_increment: '1' }

  const [
    todayData, weekData, selectedData,
    genderData, ageData, platformData, positionData,
    regionData, hourlyData, dailyData, campaignsData,
  ] = await Promise.allSettled([
    getInsights(accountId, todayParams),
    getInsights(accountId, weekParams),
    getInsights(accountId, timeParams),
    getInsights(accountId, timeParams, { breakdowns: 'gender' }),
    getInsights(accountId, timeParams, { breakdowns: 'age' }),
    getInsights(accountId, timeParams, { breakdowns: 'publisher_platform' }),
    // Combined breakdown for positions — without action fields (Meta API restriction)
    getInsights(accountId, timeParams, { breakdowns: 'publisher_platform,platform_position', limit: '50' }, POSITION_FIELDS),
    getInsights(accountId, timeParams, { breakdowns: 'region', limit: '20' }),
    getInsights(accountId, (since && until ? { time_range: JSON.stringify({ since, until }) } : { date_preset: period === 'today' ? 'last_7d' : period }) as Record<string, string>, {
      breakdowns: 'hourly_stats_aggregated_by_advertiser_time_zone',
    }),
    getInsights(accountId, dailyParams),
    getCampaigns(accountId, timeParams),
  ])

  const safe = <T>(r: PromiseSettledResult<T>, fallback: T): T =>
    r.status === 'fulfilled' ? r.value : fallback

  const selectedRow: DailyRow | null = safe(selectedData, [])[0] || null
  const resultType = detectResultType(selectedRow?.actions)

  const genderRows = mapBreakdownRows(safe(genderData, []), 'gender', GENDER_LABELS)
  const ageRows = mapBreakdownRows(safe(ageData, []), 'age')
  const platformRows = mapBreakdownRows(safe(platformData, []), 'publisher_platform', PLATFORM_LABELS)
  const positionRows = mapPositionRows(safe(positionData, []))
  const regionRows = mapBreakdownRows(safe(regionData, []), 'region')

  // Group hourly data into 4 meaningful time blocks
  const hourlyRaw = safe(hourlyData, [])
  const hourBlocks: Record<string, Agg & { hours: string[] }> = {
    'Madrugada (00h–05h)': { ...newAgg(), hours: [] },
    'Manhã (06h–11h)':     { ...newAgg(), hours: [] },
    'Tarde (12h–17h)':     { ...newAgg(), hours: [] },
    'Noite (18h–23h)':     { ...newAgg(), hours: [] },
  }
  const blockOrder = ['Madrugada (00h–05h)', 'Manhã (06h–11h)', 'Tarde (12h–17h)', 'Noite (18h–23h)']

  for (const r of hourlyRaw) {
    const h = parseInt(String(r['hourly_stats_aggregated_by_advertiser_time_zone'] ?? '0'))
    const blockKey = h <= 5 ? 'Madrugada (00h–05h)'
      : h <= 11 ? 'Manhã (06h–11h)'
      : h <= 17 ? 'Tarde (12h–17h)'
      : 'Noite (18h–23h)'
    const block = hourBlocks[blockKey]
    addRow(block, r as DailyRow)
    block.hours.push(`${String(h).padStart(2, '0')}h`)
  }

  const hourlyRows = blockOrder
    .filter((k) => hourBlocks[k].spend > 0 || hourBlocks[k].impressions > 0)
    .map((k) => finalizeAgg(hourBlocks[k], k))

  const dailyRows = safe(dailyData, [])

  return NextResponse.json({
    period,
    resultType,
    today: safe(todayData, [])[0] || null,
    week: safe(weekData, [])[0] || null,
    selected: selectedRow,
    byGender: genderRows,
    byAge: ageRows,
    byPlatform: platformRows,
    byPosition: positionRows,
    byRegion: regionRows,
    byHour: hourlyRows,
    byDayOfWeek: aggregateByDayOfWeek(dailyRows),
    byWeekOfMonth: aggregateByWeekOfMonth(dailyRows),
    campaigns: safe(campaignsData, []),
  })
}
