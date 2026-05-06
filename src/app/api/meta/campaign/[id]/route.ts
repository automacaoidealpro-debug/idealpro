import { NextResponse } from 'next/server'
import {
  metaGet, withRetry, concurrentMap,
  buildTimeParams, processInsights,
  AD_FIELDS, VALID_PRESETS,
} from '@/lib/meta-shared'

const ADSET_FIELDS = 'id,name,status,effective_status,daily_budget,lifetime_budget'
const ADSET_INSIGHT_FIELDS = `adset_id,adset_name,${AD_FIELDS}`

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params
  const { searchParams } = new URL(req.url)

  const period = VALID_PRESETS.has(searchParams.get('period') || '')
    ? searchParams.get('period')! : 'this_month'
  const since = searchParams.get('since')
  const until = searchParams.get('until')
  const tp = buildTimeParams(period, since, until)

  try {
    const [campaignInfo, adsetInsightsRes, adsetListRes, ciData] = await Promise.all([
      metaGet(`/${campaignId}`, {
        fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget',
      }).catch(() => ({})),

      // Adset-level insights for the period — catches ARCHIVED adsets regardless of status
      metaGet(`/${campaignId}/insights`, {
        fields: ADSET_INSIGHT_FIELDS,
        level: 'adset',
        limit: '100',
        ...tp,
      }).catch(() => ({ data: [] })),

      // Adsets list with all statuses for metadata
      metaGet(`/${campaignId}/adsets`, {
        fields: ADSET_FIELDS,
        filtering: JSON.stringify([{
          field: 'effective_status',
          operator: 'IN',
          value: ['ACTIVE', 'PAUSED', 'CAMPAIGN_PAUSED', 'ARCHIVED', 'WITH_ISSUES', 'IN_PROCESS'],
        }]),
        limit: '100',
      }).catch(() => ({ data: [] })),

      metaGet(`/${campaignId}/insights`, { fields: AD_FIELDS, ...tp })
        .catch(() => ({ data: [] })),
    ])

    // Build insight map from adset-level insights
    type AdsetMeta = { id: string; name: string; status: string; effective_status: string; daily_budget?: string; lifetime_budget?: string }
    type InsightRow = Record<string, unknown>

    const insightRows: InsightRow[] = (adsetInsightsRes as { data?: InsightRow[] }).data || []
    const insightMap = new Map<string, ReturnType<typeof processInsights>>()
    const insightNames = new Map<string, string>()
    for (const row of insightRows) {
      const aid = row.adset_id as string
      if (!aid) continue
      insightMap.set(aid, processInsights(row))
      insightNames.set(aid, row.adset_name as string || aid)
    }

    // Build metadata map from adsets list
    const adsetList: AdsetMeta[] = (adsetListRes as { data?: AdsetMeta[] }).data || []
    const metaMap = new Map<string, AdsetMeta>()
    for (const a of adsetList) metaMap.set(a.id, a)

    // All adset IDs: from list + from insights (catches any missed by list)
    const allIds = new Set([...metaMap.keys(), ...insightMap.keys()])

    // For adsets in list but not in insights, fetch per-adset insights
    const idsNeedingInsights = [...metaMap.keys()].filter(aid => !insightMap.has(aid))
    if (idsNeedingInsights.length > 0) {
      await concurrentMap(idsNeedingInsights, async (aid) => {
        try {
          const ins = await withRetry(() => metaGet(`/${aid}/insights`, { fields: AD_FIELDS, ...tp }))
          insightMap.set(aid, processInsights(ins.data?.[0]))
        } catch { /* no insights for this adset in period */ }
      })
    }

    // Build enriched adset list
    const adsetResults = [...allIds].map(aid => {
      const meta = metaMap.get(aid)
      return {
        id: aid,
        name: meta?.name || insightNames.get(aid) || aid,
        status: meta?.status || 'ARCHIVED',
        effective_status: meta?.effective_status || 'ARCHIVED',
        daily_budget: meta?.daily_budget,
        lifetime_budget: meta?.lifetime_budget,
        insights: insightMap.get(aid) || null,
      }
    })

    // Show: ACTIVE always + others with spend in period
    const visible = adsetResults.filter(a =>
      a.effective_status === 'ACTIVE' || (a.insights?.spend || 0) > 0
    )

    visible.sort((a, b) => {
      if (a.effective_status === 'ACTIVE' && b.effective_status !== 'ACTIVE') return -1
      if (b.effective_status === 'ACTIVE' && a.effective_status !== 'ACTIVE') return 1
      return (b.insights?.spend || 0) - (a.insights?.spend || 0)
    })

    const campaignInsights = processInsights(
      ((ciData as { data?: Record<string, unknown>[] }).data)?.[0]
    )

    return NextResponse.json({
      campaign: campaignInfo,
      insights: campaignInsights,
      adsets: visible,
      period,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
