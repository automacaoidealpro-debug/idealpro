import { NextResponse } from 'next/server'
import {
  metaGet, withRetry, concurrentMap,
  buildTimeParams, processInsights,
  AD_FIELDS, VALID_PRESETS,
} from '@/lib/meta-shared'
import { getCached, setCached } from '@/lib/meta-cache'

const CAMPAIGN_FIELDS = 'id,name,status,effective_status,objective,daily_budget,lifetime_budget'

// Simpler fields for campaign-level discovery (no video fields that may be unsupported at campaign level)
const CAMPAIGN_LEVEL_FIELDS = 'campaign_id,campaign_name,spend,impressions,clicks,ctr,cpp,reach,frequency,inline_link_clicks,actions,cost_per_action_type'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const accountId = id.startsWith('act_') ? id : `act_${id}`
  const { searchParams } = new URL(req.url)

  const period = VALID_PRESETS.has(searchParams.get('period') || '')
    ? searchParams.get('period')! : 'this_month'
  const since = searchParams.get('since')
  const until = searchParams.get('until')
  const tp = buildTimeParams(period, since, until)

  const cacheKey = `act3:${accountId}:campaigns:${period}:${since ?? ''}:${until ?? ''}`
  const cached = await getCached(cacheKey)
  if (cached) return NextResponse.json(cached)

  try {
    // 1. Account name + campaign list (with ALL statuses) in parallel
    const [nameRes, campListRes, insightsRes] = await Promise.allSettled([
      metaGet(`/${accountId}`, { fields: 'name' }),
      // Fetch ALL campaign statuses so historical/archived campaigns are included
      metaGet(`/${accountId}/campaigns`, {
        fields: CAMPAIGN_FIELDS,
        filtering: JSON.stringify([{
          field: 'effective_status',
          operator: 'IN',
          value: ['ACTIVE', 'PAUSED', 'ARCHIVED', 'CAMPAIGN_PAUSED', 'WITH_ISSUES', 'IN_PROCESS'],
        }]),
        limit: '200',
      }),
      // Campaign-level insights for the period — catches campaigns regardless of current status
      metaGet(`/${accountId}/insights`, {
        fields: CAMPAIGN_LEVEL_FIELDS,
        level: 'campaign',
        limit: '200',
        ...tp,
      }),
    ])

    const accountName =
      nameRes.status === 'fulfilled' ? (nameRes.value.name as string || accountId) : accountId

    type CampaignMeta = { id: string; name: string; objective: string; effective_status: string; daily_budget?: string; lifetime_budget?: string }

    // Build metadata map from campaigns list
    let campList: CampaignMeta[] = campListRes.status === 'fulfilled'
      ? (campListRes.value.data || []) : []

    // Fallback: if filtered list is empty, fetch without filter
    if (campList.length === 0) {
      try {
        const fb = await metaGet(`/${accountId}/campaigns`, { fields: CAMPAIGN_FIELDS, limit: '200' })
        campList = fb.data || []
      } catch { campList = [] }
    }

    const metaMap = new Map<string, CampaignMeta>()
    for (const c of campList) metaMap.set(c.id, c)

    // Build insight map from campaign-level insights
    type InsightRow = Record<string, unknown>
    const insightRows: InsightRow[] = insightsRes.status === 'fulfilled'
      ? (insightsRes.value.data || []) : []

    const insightMap = new Map<string, ReturnType<typeof processInsights>>()
    const insightNames = new Map<string, string>()
    for (const row of insightRows) {
      const cid = row.campaign_id as string
      if (!cid) continue
      insightMap.set(cid, processInsights(row))
      insightNames.set(cid, row.campaign_name as string || cid)
    }

    // All campaign IDs: from list + from insights (in case list missed some)
    const allIds = new Set([...metaMap.keys(), ...insightMap.keys()])

    // For campaigns not yet in insightMap, fetch insights per-campaign
    const idsNeedingInsights = [...allIds].filter(cid => !insightMap.has(cid))
    if (idsNeedingInsights.length > 0) {
      await concurrentMap(idsNeedingInsights, async (cid) => {
        try {
          const ins = await withRetry(() =>
            metaGet(`/${cid}/insights`, { fields: AD_FIELDS, ...tp })
          )
          insightMap.set(cid, processInsights(ins.data?.[0]))
        } catch { /* no insights for this campaign in period */ }
      })
    }

    // Build enriched campaign list
    const enriched = [...allIds].map(cid => {
      const meta = metaMap.get(cid)
      return {
        id: cid,
        name: meta?.name || insightNames.get(cid) || cid,
        objective: meta?.objective || '',
        effective_status: meta?.effective_status || 'ARCHIVED',
        daily_budget: meta?.daily_budget,
        lifetime_budget: meta?.lifetime_budget,
        insights: insightMap.get(cid) || null,
        adsets: [],
      }
    })

    // ACTIVE always shown; others only if had spend in the period
    const visible = enriched.filter(c =>
      c.effective_status === 'ACTIVE' || (c.insights?.spend || 0) > 0
    )

    visible.sort((a, b) => {
      if (a.effective_status === 'ACTIVE' && b.effective_status !== 'ACTIVE') return -1
      if (b.effective_status === 'ACTIVE' && a.effective_status !== 'ACTIVE') return 1
      return (b.insights?.spend || 0) - (a.insights?.spend || 0)
    })

    const result = {
      campaigns: visible,
      period,
      name: accountName,
      _debug: {
        campListCount: campList.length,
        insightRowsCount: insightRows.length,
        insightsStatus: insightsRes.status,
        campListStatus: campListRes.status,
        insightsError: insightsRes.status === 'rejected' ? String((insightsRes as PromiseRejectedResult).reason) : null,
        campListError: campListRes.status === 'rejected' ? String((campListRes as PromiseRejectedResult).reason) : null,
      },
    }

    if (visible.length > 0) await setCached(cacheKey, result, period, since, until)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
