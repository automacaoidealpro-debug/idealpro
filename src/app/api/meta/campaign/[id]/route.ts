import { NextResponse } from 'next/server'
import {
  metaGet, withRetry, concurrentMap,
  buildTimeParams, processInsights,
  AD_FIELDS, VALID_PRESETS,
} from '@/lib/meta-shared'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: campaignId } = await params
  const { searchParams } = new URL(req.url)

  const period = VALID_PRESETS.has(searchParams.get('period') || '')
    ? searchParams.get('period')! : 'this_month'
  const since = searchParams.get('since')
  const until = searchParams.get('until')
  const tp = buildTimeParams(period, since, until)

  try {
    const [campaignInfo, adsetsData, ciData] = await Promise.all([
      metaGet(`/${campaignId}`, {
        fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget',
      }).catch(() => ({})),
      (async () => {
        const filtered = await metaGet(`/${campaignId}/adsets`, {
          fields: 'id,name,status,effective_status,daily_budget,lifetime_budget',
          filtering: JSON.stringify([
            { field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED', 'CAMPAIGN_PAUSED'] },
          ]),
          limit: '100',
        }).catch(() => null)
        if ((filtered?.data || []).length > 0) return filtered
        return metaGet(`/${campaignId}/adsets`, {
          fields: 'id,name,status,effective_status,daily_budget,lifetime_budget',
          limit: '100',
        }).catch(() => ({ data: [] }))
      })(),
      metaGet(`/${campaignId}/insights`, { fields: AD_FIELDS, ...tp })
        .catch(() => ({ data: [] })),
    ])

    const adsets = ((adsetsData as { data?: unknown[] }).data || []) as {
      id: string; name: string; status: string; effective_status: string
    }[]
    const campaignInsights = processInsights(
      ((ciData as { data?: Record<string, unknown>[] }).data)?.[0]
    )

    const adsetResults = await concurrentMap(adsets, async (adset) => {
      try {
        const ins = await withRetry(() =>
          metaGet(`/${adset.id}/insights`, { fields: AD_FIELDS, ...tp })
        )
        return { ...adset, insights: processInsights(ins.data?.[0]) }
      } catch {
        return { ...adset, insights: null }
      }
    })

    adsetResults.sort((a, b) => {
      if (a.effective_status === 'ACTIVE' && b.effective_status !== 'ACTIVE') return -1
      if (b.effective_status === 'ACTIVE' && a.effective_status !== 'ACTIVE') return 1
      return (b.insights?.spend || 0) - (a.insights?.spend || 0)
    })

    return NextResponse.json({
      campaign: campaignInfo,
      insights: campaignInsights,
      adsets: adsetResults,
      period,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
