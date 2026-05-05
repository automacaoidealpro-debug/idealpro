import { NextResponse } from 'next/server'
import {
  metaGet, withRetry, concurrentMap,
  buildTimeParams, processInsights,
  AD_FIELDS, VALID_PRESETS,
} from '@/lib/meta-shared'
import { getCached, setCached } from '@/lib/meta-cache'

type Campaign = {
  id: string; name: string; objective: string
  effective_status: string; daily_budget?: string; lifetime_budget?: string
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const accountId = id.startsWith('act_') ? id : `act_${id}`
  const { searchParams } = new URL(req.url)

  const period = VALID_PRESETS.has(searchParams.get('period') || '')
    ? searchParams.get('period')! : 'this_month'
  const since = searchParams.get('since')
  const until = searchParams.get('until')
  const tp = buildTimeParams(period, since, until)

  // Cache check
  const cacheKey = `act:${accountId}:campaigns:${period}:${since ?? ''}:${until ?? ''}`
  const cached = await getCached(cacheKey)
  if (cached) return NextResponse.json(cached)

  try {
    const [nameResult, campResult] = await Promise.allSettled([
      metaGet(`/${accountId}`, { fields: 'name' }),
      metaGet(`/${accountId}/campaigns`, {
        fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget',
        filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] }]),
        limit: '200',
      }),
    ])

    const accountName =
      nameResult.status === 'fulfilled' ? (nameResult.value.name as string || accountId) : accountId

    let campaigns: Campaign[] = []
    if (campResult.status === 'fulfilled') {
      campaigns = (campResult.value.data || []) as Campaign[]
    } else {
      try {
        const fb = await metaGet(`/${accountId}/campaigns`, {
          fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget',
          limit: '200',
        })
        campaigns = ((fb.data || []) as Campaign[]).filter(c =>
          c.effective_status === 'ACTIVE' || c.effective_status === 'PAUSED')
      } catch { campaigns = [] }
    }

    // Fetch insights per campaign — 3 concurrent, retry on failure
    const enriched = await concurrentMap(campaigns, async (c) => {
      try {
        const ins = await withRetry(() => metaGet(`/${c.id}/insights`, { fields: AD_FIELDS, ...tp }))
        return { ...c, insights: processInsights(ins.data?.[0]), adsets: [] }
      } catch {
        return { ...c, insights: null, adsets: [] }
      }
    })

    // ACTIVE always visible; PAUSED only if had spend in period
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
