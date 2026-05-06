import { NextResponse } from 'next/server'
import {
  metaGet, withRetry, concurrentMap,
  buildTimeParams, processInsights,
  AD_FIELDS, VALID_PRESETS,
} from '@/lib/meta-shared'
import { getCached, setCached } from '@/lib/meta-cache'

const CAMPAIGN_FIELDS = 'id,name,status,effective_status,objective,daily_budget,lifetime_budget'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const accountId = id.startsWith('act_') ? id : `act_${id}`
  const { searchParams } = new URL(req.url)

  const period = VALID_PRESETS.has(searchParams.get('period') || '')
    ? searchParams.get('period')! : 'this_month'
  const since = searchParams.get('since')
  const until = searchParams.get('until')
  const tp = buildTimeParams(period, since, until)

  const cacheKey = `act2:${accountId}:campaigns:${period}:${since ?? ''}:${until ?? ''}`
  const cached = await getCached(cacheKey)
  if (cached) return NextResponse.json(cached)

  try {
    // Fetch in parallel:
    // 1. Account name
    // 2. Campaign-level insights for the period (catches ALL campaigns with spend, regardless of status)
    // 3. Currently ACTIVE/PAUSED campaigns (to show zero-spend campaigns for current periods)
    const [nameRes, insightsRes, activeRes] = await Promise.allSettled([
      metaGet(`/${accountId}`, { fields: 'name' }),
      metaGet(`/${accountId}/insights`, {
        fields: `campaign_id,campaign_name,${AD_FIELDS}`,
        level: 'campaign',
        limit: '200',
        ...tp,
      }),
      metaGet(`/${accountId}/campaigns`, {
        fields: CAMPAIGN_FIELDS,
        filtering: JSON.stringify([
          { field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] },
        ]),
        limit: '200',
      }),
    ])

    const accountName =
      nameRes.status === 'fulfilled' ? (nameRes.value.name as string || accountId) : accountId

    // Build insight map from campaign-level insights (spend data per campaign for the period)
    type InsightRow = Record<string, unknown>
    const insightRows: InsightRow[] = insightsRes.status === 'fulfilled'
      ? (insightsRes.value.data || []) : []

    const insightMap = new Map<string, ReturnType<typeof processInsights>>()
    const insightNames = new Map<string, string>()
    for (const row of insightRows) {
      const cid = row.campaign_id as string
      insightMap.set(cid, processInsights(row))
      insightNames.set(cid, row.campaign_name as string || cid)
    }

    // Build campaign metadata map from active campaigns list
    type CampaignMeta = { id: string; name: string; objective: string; effective_status: string; daily_budget?: string; lifetime_budget?: string }
    const activeCamps: CampaignMeta[] = activeRes.status === 'fulfilled'
      ? (activeRes.value.data || []) : []
    const metaMap = new Map<string, CampaignMeta>()
    for (const c of activeCamps) metaMap.set(c.id, c)

    // Collect all campaign IDs: from insights (historical spend) + active list
    const allIds = new Set([...insightMap.keys(), ...metaMap.keys()])

    // For ACTIVE campaigns not in insights, fetch insights individually
    const idsNeedingInsights = [...metaMap.keys()].filter(id => !insightMap.has(id))
    if (idsNeedingInsights.length > 0) {
      await concurrentMap(idsNeedingInsights, async (cid) => {
        try {
          const ins = await withRetry(() => metaGet(`/${cid}/insights`, { fields: AD_FIELDS, ...tp }))
          insightMap.set(cid, processInsights(ins.data?.[0]))
        } catch { /* no insights for this campaign in this period */ }
      })
    }

    // Build enriched campaign list
    const enriched = [...allIds].map(cid => {
      const meta = metaMap.get(cid)
      const name = meta?.name || insightNames.get(cid) || cid
      const effective_status = meta?.effective_status || 'ARCHIVED'
      return {
        id: cid,
        name,
        objective: meta?.objective || '',
        effective_status,
        daily_budget: meta?.daily_budget,
        lifetime_budget: meta?.lifetime_budget,
        insights: insightMap.get(cid) || null,
        adsets: [],
      }
    })

    // Show: ACTIVE campaigns always + any campaign with spend in the period
    const visible = enriched.filter(c =>
      c.effective_status === 'ACTIVE' || (c.insights?.spend || 0) > 0
    )

    visible.sort((a, b) => {
      if (a.effective_status === 'ACTIVE' && b.effective_status !== 'ACTIVE') return -1
      if (b.effective_status === 'ACTIVE' && a.effective_status !== 'ACTIVE') return 1
      return (b.insights?.spend || 0) - (a.insights?.spend || 0)
    })

    const result = { campaigns: visible, period, name: accountName }
    if (visible.length > 0) await setCached(cacheKey, result, period, since, until)
    return NextResponse.json(result)
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
