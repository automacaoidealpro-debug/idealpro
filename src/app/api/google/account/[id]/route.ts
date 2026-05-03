import { NextResponse } from 'next/server'
import { getGoogleAccessToken, gaqlSearch, googleDateRange } from '@/lib/google-ads'

const VALID_PERIODS = new Set([
  'today', 'yesterday', 'last_7d', 'last_14d', 'last_28d', 'this_month', 'last_month',
])

interface CampaignRow {
  campaign: {
    id: string
    name: string
    status: string
    advertisingChannelType: string
    biddingStrategyType: string
  }
  metrics: {
    costMicros: string
    impressions: string
    clicks: string
    ctr: number
    averageCpc: string
    conversions: number
    conversionsValue: number
    costPerConversion: string
    allConversions: number
  }
}

interface AccountRow {
  metrics: {
    costMicros: string
    impressions: string
    clicks: string
    ctr: number
    averageCpc: string
    conversions: number
    conversionsValue: number
    costPerConversion: string
  }
}

function microsToBRL(micros: string | number): number {
  return parseFloat(String(micros)) / 1_000_000
}

function processCampaign(row: CampaignRow) {
  const m = row.metrics
  const spend = microsToBRL(m.costMicros)
  return {
    id: row.campaign.id,
    name: row.campaign.name,
    status: row.campaign.status,
    channelType: row.campaign.advertisingChannelType,
    biddingStrategy: row.campaign.biddingStrategyType,
    spend,
    impressions: parseInt(String(m.impressions) || '0'),
    clicks: parseInt(String(m.clicks) || '0'),
    ctr: m.ctr * 100,
    cpc: microsToBRL(m.averageCpc),
    conversions: m.conversions,
    conversionValue: m.conversionsValue,
    costPerConversion: spend > 0 && m.conversions > 0 ? spend / m.conversions : 0,
    roas: spend > 0 && m.conversionsValue > 0 ? m.conversionsValue / spend : 0,
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const period = VALID_PERIODS.has(searchParams.get('period') || '')
    ? searchParams.get('period')!
    : 'last_7d'
  const since = searchParams.get('since')
  const until = searchParams.get('until')

  const dateRange = since && until
    ? { startDate: since, endDate: until }
    : googleDateRange(period)

  const dateCond = `segments.date BETWEEN '${dateRange.startDate}' AND '${dateRange.endDate}'`
  const mccId = process.env.GOOGLE_ADS_MCC_ID!

  try {
    const accessToken = await getGoogleAccessToken()

    const [campaigns, accountMetrics] = await Promise.allSettled([
      gaqlSearch<CampaignRow>(
        id,
        `SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.advertising_channel_type,
          campaign.bidding_strategy_type,
          metrics.cost_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.average_cpc,
          metrics.conversions,
          metrics.conversions_value,
          metrics.cost_per_conversion,
          metrics.all_conversions
        FROM campaign
        WHERE ${dateCond}
          AND campaign.status != 'REMOVED'
        ORDER BY metrics.cost_micros DESC
        LIMIT 50`,
        accessToken,
        mccId,
      ),
      gaqlSearch<AccountRow>(
        id,
        `SELECT
          metrics.cost_micros,
          metrics.impressions,
          metrics.clicks,
          metrics.ctr,
          metrics.average_cpc,
          metrics.conversions,
          metrics.conversions_value,
          metrics.cost_per_conversion
        FROM customer
        WHERE ${dateCond}`,
        accessToken,
        mccId,
      ),
    ])

    const processedCampaigns = campaigns.status === 'fulfilled'
      ? campaigns.value.map(processCampaign)
      : []

    const totals = accountMetrics.status === 'fulfilled' && accountMetrics.value.length > 0
      ? (() => {
          const m = accountMetrics.value[0].metrics
          const spend = microsToBRL(m.costMicros)
          return {
            spend,
            impressions: parseInt(String(m.impressions) || '0'),
            clicks: parseInt(String(m.clicks) || '0'),
            ctr: m.ctr * 100,
            cpc: microsToBRL(m.averageCpc),
            conversions: m.conversions,
            conversionValue: m.conversionsValue,
            costPerConversion: spend > 0 && m.conversions > 0 ? spend / m.conversions : 0,
            roas: spend > 0 && m.conversionsValue > 0 ? m.conversionsValue / spend : 0,
          }
        })()
      : null

    processedCampaigns.sort((a, b) => b.spend - a.spend)

    return NextResponse.json({
      period,
      dateRange,
      totals,
      campaigns: processedCampaigns,
      activeCampaigns: processedCampaigns.filter(c => c.status === 'ENABLED').length,
    })
  } catch (e) {
    const msg = String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
