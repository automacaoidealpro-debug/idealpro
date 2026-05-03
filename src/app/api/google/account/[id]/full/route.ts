import { NextResponse } from 'next/server'
import { getGoogleAccessToken, gaqlSearch, googleDateRange } from '@/lib/google-ads'

const VALID_PERIODS = new Set(['today','yesterday','last_7d','last_14d','last_28d','this_month','last_month'])
const MCC = () => process.env.GOOGLE_ADS_MCC_ID!

function micros(v: string | number | undefined): number {
  return parseFloat(String(v ?? 0)) / 1_000_000
}

// ── Row types ──────────────────────────────────────────────────────────────────
interface CampaignRow {
  campaign: { id: string; name: string; status: string; advertisingChannelType: string; biddingStrategyType: string }
  campaignBudget: { amountMicros: string }
  metrics: { costMicros: string; impressions: string; clicks: string; ctr: number; averageCpc: string; conversions: number; conversionsValue: number; allConversions: number }
}

interface AdGroupRow {
  adGroup: { id: string; name: string; status: string }
  campaign: { id: string; name: string }
  metrics: { costMicros: string; impressions: string; clicks: string; ctr: number; conversions: number; conversionsValue: number }
}

interface DeviceRow {
  segments: { device: string }
  metrics: { costMicros: string; impressions: string; clicks: string; ctr: number; conversions: number; conversionsValue: number }
}

interface DayRow {
  segments: { dayOfWeek: string }
  metrics: { costMicros: string; impressions: string; clicks: string; conversions: number }
}

interface HourRow {
  segments: { hour: number }
  metrics: { costMicros: string; impressions: string; clicks: string; ctr: number; conversions: number }
}

interface NetworkRow {
  segments: { adNetworkType: string }
  metrics: { costMicros: string; impressions: string; clicks: string; ctr: number; conversions: number }
}

interface GeoRow {
  customerUserAccess?: unknown
  segments: { geoTargetCity?: string; geoTargetRegion?: string }
  metrics: { costMicros: string; impressions: string; clicks: string; conversions: number }
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = new URL(req.url)
  const period = VALID_PERIODS.has(searchParams.get('period') || '') ? searchParams.get('period')! : 'last_7d'
  const since = searchParams.get('since')
  const until = searchParams.get('until')
  const dateRange = since && until ? { startDate: since, endDate: until } : googleDateRange(period)
  const dateCond = `segments.date BETWEEN '${dateRange.startDate}' AND '${dateRange.endDate}'`
  const mcc = MCC()

  try {
    const token = await getGoogleAccessToken()

    const [campaigns, adGroups, devices, days, hours, networks] = await Promise.allSettled([
      // 1. Campaigns
      gaqlSearch<CampaignRow>(id, `
        SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
          campaign.bidding_strategy_type, campaign_budget.amount_micros,
          metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr,
          metrics.average_cpc, metrics.conversions, metrics.conversions_value, metrics.all_conversions
        FROM campaign
        WHERE ${dateCond} AND campaign.status != 'REMOVED'
        ORDER BY metrics.cost_micros DESC LIMIT 50`, token, mcc),

      // 2. Ad groups
      gaqlSearch<AdGroupRow>(id, `
        SELECT ad_group.id, ad_group.name, ad_group.status,
          campaign.id, campaign.name,
          metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr,
          metrics.conversions, metrics.conversions_value
        FROM ad_group
        WHERE ${dateCond} AND ad_group.status != 'REMOVED'
        ORDER BY metrics.cost_micros DESC LIMIT 100`, token, mcc),

      // 3. By device
      gaqlSearch<DeviceRow>(id, `
        SELECT segments.device,
          metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr,
          metrics.conversions, metrics.conversions_value
        FROM campaign
        WHERE ${dateCond} AND campaign.status != 'REMOVED'`, token, mcc),

      // 4. By day of week
      gaqlSearch<DayRow>(id, `
        SELECT segments.day_of_week,
          metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.conversions
        FROM campaign
        WHERE ${dateCond} AND campaign.status != 'REMOVED'`, token, mcc),

      // 5. By hour of day
      gaqlSearch<HourRow>(id, `
        SELECT segments.hour,
          metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr, metrics.conversions
        FROM campaign
        WHERE ${dateCond} AND campaign.status != 'REMOVED'`, token, mcc),

      // 6. By network type (Search, Display, Shopping, Video)
      gaqlSearch<NetworkRow>(id, `
        SELECT segments.ad_network_type,
          metrics.cost_micros, metrics.impressions, metrics.clicks, metrics.ctr, metrics.conversions
        FROM campaign
        WHERE ${dateCond} AND campaign.status != 'REMOVED'`, token, mcc),
    ])

    // ── Process campaigns ──────────────────────────────────────────────────────
    const processedCampaigns = campaigns.status === 'fulfilled'
      ? campaigns.value.map(r => {
          const spend = micros(r.metrics.costMicros)
          return {
            id: r.campaign.id,
            name: r.campaign.name,
            status: r.campaign.status,
            channelType: r.campaign.advertisingChannelType,
            biddingStrategy: r.campaign.biddingStrategyType,
            dailyBudget: micros(r.campaignBudget?.amountMicros),
            spend,
            impressions: parseInt(String(r.metrics.impressions || 0)),
            clicks: parseInt(String(r.metrics.clicks || 0)),
            ctr: r.metrics.ctr * 100,
            cpc: micros(r.metrics.averageCpc),
            conversions: r.metrics.conversions || 0,
            conversionValue: r.metrics.conversionsValue || 0,
            costPerConversion: spend > 0 && (r.metrics.conversions || 0) > 0 ? spend / r.metrics.conversions : 0,
            roas: spend > 0 && (r.metrics.conversionsValue || 0) > 0 ? r.metrics.conversionsValue / spend : 0,
          }
        }).sort((a, b) => b.spend - a.spend)
      : []

    // ── Totals from campaigns ──────────────────────────────────────────────────
    const totals = processedCampaigns.reduce((acc, c) => ({
      spend: acc.spend + c.spend,
      impressions: acc.impressions + c.impressions,
      clicks: acc.clicks + c.clicks,
      conversions: acc.conversions + c.conversions,
      conversionValue: acc.conversionValue + c.conversionValue,
    }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0 })
    const totalSummary = {
      ...totals,
      ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
      cpc: totals.clicks > 0 ? totals.spend / totals.clicks : 0,
      costPerConversion: totals.conversions > 0 ? totals.spend / totals.conversions : 0,
      roas: totals.spend > 0 && totals.conversionValue > 0 ? totals.conversionValue / totals.spend : 0,
    }

    // ── Process ad groups ──────────────────────────────────────────────────────
    const processedAdGroups = adGroups.status === 'fulfilled'
      ? adGroups.value.map(r => {
          const spend = micros(r.metrics.costMicros)
          return {
            id: r.adGroup.id,
            name: r.adGroup.name,
            status: r.adGroup.status,
            campaignId: r.campaign.id,
            campaignName: r.campaign.name,
            spend,
            impressions: parseInt(String(r.metrics.impressions || 0)),
            clicks: parseInt(String(r.metrics.clicks || 0)),
            ctr: r.metrics.ctr * 100,
            conversions: r.metrics.conversions || 0,
            conversionValue: r.metrics.conversionsValue || 0,
            costPerConversion: spend > 0 && (r.metrics.conversions || 0) > 0 ? spend / r.metrics.conversions : 0,
          }
        }).filter(g => g.spend > 0).sort((a, b) => b.spend - a.spend)
      : []

    // ── Process device breakdown ───────────────────────────────────────────────
    const deviceMap: Record<string, { spend: number; impressions: number; clicks: number; conversions: number; conversionValue: number; ctr: number }> = {}
    if (devices.status === 'fulfilled') {
      for (const r of devices.value) {
        const dev = r.segments.device || 'UNKNOWN'
        if (!deviceMap[dev]) deviceMap[dev] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, conversionValue: 0, ctr: 0 }
        deviceMap[dev].spend += micros(r.metrics.costMicros)
        deviceMap[dev].impressions += parseInt(String(r.metrics.impressions || 0))
        deviceMap[dev].clicks += parseInt(String(r.metrics.clicks || 0))
        deviceMap[dev].conversions += r.metrics.conversions || 0
        deviceMap[dev].conversionValue += r.metrics.conversionsValue || 0
      }
    }
    const byDevice = Object.entries(deviceMap).map(([device, m]) => ({
      device,
      spend: m.spend,
      impressions: m.impressions,
      clicks: m.clicks,
      ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
      conversions: m.conversions,
      conversionValue: m.conversionValue,
      costPerConversion: m.conversions > 0 ? m.spend / m.conversions : 0,
    })).filter(d => d.spend > 0).sort((a, b) => b.conversions - a.conversions || b.spend - a.spend)

    // ── Process day-of-week breakdown ──────────────────────────────────────────
    const DAY_ORDER = ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY']
    const dayMap: Record<string, { spend: number; impressions: number; clicks: number; conversions: number; days: number }> = {}
    if (days.status === 'fulfilled') {
      for (const r of days.value) {
        const day = r.segments.dayOfWeek || 'UNKNOWN'
        if (!dayMap[day]) dayMap[day] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, days: 0 }
        dayMap[day].spend += micros(r.metrics.costMicros)
        dayMap[day].impressions += parseInt(String(r.metrics.impressions || 0))
        dayMap[day].clicks += parseInt(String(r.metrics.clicks || 0))
        dayMap[day].conversions += r.metrics.conversions || 0
        dayMap[day].days += 1
      }
    }
    const PT_DAY: Record<string, string> = {
      MONDAY: 'Segunda', TUESDAY: 'Terça', WEDNESDAY: 'Quarta',
      THURSDAY: 'Quinta', FRIDAY: 'Sexta', SATURDAY: 'Sábado', SUNDAY: 'Domingo',
    }
    const byDayOfWeek = DAY_ORDER
      .filter(d => dayMap[d])
      .map(d => ({
        day: d,
        name: PT_DAY[d] || d,
        spend: dayMap[d].spend,
        impressions: dayMap[d].impressions,
        clicks: dayMap[d].clicks,
        ctr: dayMap[d].impressions > 0 ? (dayMap[d].clicks / dayMap[d].impressions) * 100 : 0,
        conversions: dayMap[d].conversions,
        costPerConversion: dayMap[d].conversions > 0 ? dayMap[d].spend / dayMap[d].conversions : 0,
      })).filter(d => d.spend > 0)

    // ── Process hourly breakdown ───────────────────────────────────────────────
    const hourMap: Record<number, { spend: number; impressions: number; clicks: number; ctr: number; conversions: number }> = {}
    if (hours.status === 'fulfilled') {
      for (const r of hours.value) {
        const h = r.segments.hour
        if (!hourMap[h]) hourMap[h] = { spend: 0, impressions: 0, clicks: 0, ctr: 0, conversions: 0 }
        hourMap[h].spend += micros(r.metrics.costMicros)
        hourMap[h].impressions += parseInt(String(r.metrics.impressions || 0))
        hourMap[h].clicks += parseInt(String(r.metrics.clicks || 0))
        hourMap[h].conversions += r.metrics.conversions || 0
      }
    }
    const byHour = Object.entries(hourMap).map(([h, m]) => ({
      hour: parseInt(h),
      label: `${String(h).padStart(2, '0')}h`,
      spend: m.spend,
      impressions: m.impressions,
      clicks: m.clicks,
      ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
      conversions: m.conversions,
    })).filter(h => h.spend > 0).sort((a, b) => a.hour - b.hour)

    // ── Process network breakdown ──────────────────────────────────────────────
    const netMap: Record<string, { spend: number; impressions: number; clicks: number; conversions: number }> = {}
    if (networks.status === 'fulfilled') {
      for (const r of networks.value) {
        const net = r.segments.adNetworkType || 'UNKNOWN'
        if (!netMap[net]) netMap[net] = { spend: 0, impressions: 0, clicks: 0, conversions: 0 }
        netMap[net].spend += micros(r.metrics.costMicros)
        netMap[net].impressions += parseInt(String(r.metrics.impressions || 0))
        netMap[net].clicks += parseInt(String(r.metrics.clicks || 0))
        netMap[net].conversions += r.metrics.conversions || 0
      }
    }
    const byNetwork = Object.entries(netMap).map(([network, m]) => ({
      network,
      spend: m.spend,
      impressions: m.impressions,
      clicks: m.clicks,
      ctr: m.impressions > 0 ? (m.clicks / m.impressions) * 100 : 0,
      conversions: m.conversions,
      costPerConversion: m.conversions > 0 ? m.spend / m.conversions : 0,
    })).filter(n => n.spend > 0).sort((a, b) => b.spend - a.spend)

    return NextResponse.json({
      period, dateRange,
      totals: totalSummary,
      campaigns: processedCampaigns,
      adGroups: processedAdGroups,
      byDevice,
      byDayOfWeek,
      byHour,
      byNetwork,
    })
  } catch (e) {
    const msg = String(e)
    const notApproved = msg.includes('DEVELOPER_TOKEN_NOT_APPROVED') || msg.includes('not approved') || msg.includes('test accounts') || msg.includes('only approved')
    return NextResponse.json({
      error: msg,
      hint: notApproved
        ? 'Token em modo TEST. Acesse ads.google.com/aw/apicenter → solicitar Basic Access.'
        : undefined,
      token_status: notApproved ? 'TEST_ONLY' : 'ERROR',
    }, { status: 403 })
  }
}
