import { NextResponse } from 'next/server'
import {
  metaGet, withRetry, concurrentMap,
  buildTimeParams, processInsights,
  AD_FIELDS, VALID_PRESETS,
} from '@/lib/meta-shared'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: adsetId } = await params
  const { searchParams } = new URL(req.url)

  const period = VALID_PRESETS.has(searchParams.get('period') || '')
    ? searchParams.get('period')! : 'this_month'
  const since = searchParams.get('since')
  const until = searchParams.get('until')
  const tp = buildTimeParams(period, since, until)

  try {
    const adsData = await metaGet(`/${adsetId}/ads`, {
      fields: 'id,name,status,effective_status,creative{id,name,thumbnail_url,body,title}',
      filtering: JSON.stringify([
        {
          field: 'effective_status', operator: 'IN',
          value: ['ACTIVE', 'PAUSED', 'CAMPAIGN_PAUSED', 'ADSET_PAUSED'],
        },
      ]),
      limit: '200',
    }).catch(() =>
      metaGet(`/${adsetId}/ads`, {
        fields: 'id,name,status,effective_status,creative{id,name,thumbnail_url,body,title}',
        limit: '200',
      }).catch(() => ({ data: [] }))
    )

    const ads = (((adsData as { data?: unknown[] }).data) || []) as {
      id: string; name: string; effective_status: string
    }[]

    const adsWithInsights = await concurrentMap(ads, async (ad) => {
      try {
        const ins = await withRetry(() =>
          metaGet(`/${ad.id}/insights`, { fields: AD_FIELDS, ...tp })
        )
        return { ...ad, insights: processInsights(ins.data?.[0]) }
      } catch {
        return { ...ad, insights: null }
      }
    })

    adsWithInsights.sort((a, b) => (b.insights?.spend || 0) - (a.insights?.spend || 0))

    return NextResponse.json({ ads: adsWithInsights })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
