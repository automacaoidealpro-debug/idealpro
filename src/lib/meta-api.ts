const BASE_URL = 'https://graph.facebook.com/v20.0'
const TOKEN = process.env.META_ACCESS_TOKEN || process.env.NEXT_PUBLIC_META_ACCESS_TOKEN

async function metaFetch(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE_URL}${path}`)
  url.searchParams.set('access_token', TOKEN!)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), { next: { revalidate: 300 } })
  if (!res.ok) throw new Error(`Meta API error: ${res.status}`)
  return res.json()
}

export async function getAllAccounts() {
  const data = await metaFetch('/me/adaccounts', {
    fields: 'id,name,account_status,currency,amount_spent,balance',
    limit: '100',
  })
  return data.data || []
}

export async function getAccountInsights(accountId: string, datePreset = 'today') {
  try {
    const data = await metaFetch(`/${accountId}/insights`, {
      fields: 'spend,impressions,clicks,reach,ctr,cpm,cpp,actions',
      date_preset: datePreset,
      level: 'account',
    })
    return data.data?.[0] || null
  } catch {
    return null
  }
}

export async function getAccountCampaigns(accountId: string) {
  try {
    const data = await metaFetch(`/${accountId}/campaigns`, {
      fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget',
      limit: '50',
    })
    return data.data || []
  } catch {
    return []
  }
}

export async function getAccountPixels(accountId: string) {
  try {
    const data = await metaFetch(`/${accountId}/adspixels`, {
      fields: 'id,name,code,last_fired_time',
    })
    return data.data || []
  } catch {
    return []
  }
}

function calculateHealthScore(params: {
  hasPixel: boolean
  activeCampaigns: number
  cpp: number
  ctr: number
  spend: number
}): number {
  let score = 0
  if (params.hasPixel) score += 30
  if (params.activeCampaigns > 0) score += 20
  if (params.cpp > 0 && params.cpp < 50) score += 25
  if (params.ctr > 1) score += 15
  if (params.spend > 0) score += 10
  return Math.min(score, 100)
}

function detectAlerts(account: {
  name: string
  activeCampaigns: number
  hasPixel: boolean
  cpp: number
  monthlySpend: number
}) {
  const alerts = []

  if (!account.hasPixel) {
    alerts.push({
      type: 'no_pixel' as const,
      message: 'Conta sem pixel instalado',
      severity: 'high' as const,
    })
  }

  if (account.activeCampaigns === 0) {
    alerts.push({
      type: 'campaign_stopped' as const,
      message: 'Nenhuma campanha ativa',
      severity: 'medium' as const,
    })
  }

  if (account.cpp > 100) {
    alerts.push({
      type: 'high_cpp' as const,
      message: `CPP alto: R$${account.cpp.toFixed(2)}`,
      severity: 'medium' as const,
    })
  }

  return alerts
}

export async function buildClientDashboard() {
  const accounts = await getAllAccounts()

  const results = await Promise.allSettled(
    accounts.map(async (acc: { id: string; name: string; account_status: number }) => {
      const [todayInsights, monthInsights, campaigns, pixels] = await Promise.allSettled([
        getAccountInsights(acc.id, 'today'),
        getAccountInsights(acc.id, 'this_month'),
        getAccountCampaigns(acc.id),
        getAccountPixels(acc.id),
      ])

      const today = todayInsights.status === 'fulfilled' ? todayInsights.value : null
      const month = monthInsights.status === 'fulfilled' ? monthInsights.value : null
      const cams = campaigns.status === 'fulfilled' ? campaigns.value : []
      const pxs = pixels.status === 'fulfilled' ? pixels.value : []

      const activeCampaigns = cams.filter(
        (c: { effective_status: string }) => c.effective_status === 'ACTIVE'
      ).length
      const hasPixel = pxs.length > 0
      const dailySpend = parseFloat(today?.spend || '0')
      const monthlySpend = parseFloat(month?.spend || '0')
      const cpp = parseFloat(month?.cpp || '0')
      const ctr = parseFloat(month?.ctr || '0')

      const PURCHASE_TYPES = ['purchase', 'omni_purchase', 'fb_pixel_purchase', 'offsite_conversion.fb_pixel_purchase']
      const LEAD_TYPES = ['lead', 'complete_registration', 'fb_pixel_lead', 'offsite_conversion.fb_pixel_lead', 'onsite_conversion.lead_grouped']
      const CONV_TYPES = ['onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.messaging_first_reply', 'click_to_message_ad_contact_us', 'contact']
      const sumActions = (types: string[]) =>
        (month?.actions || []).filter((a: { action_type: string }) => types.includes(a.action_type))
          .reduce((s: number, a: { value: string }) => s + parseFloat(a.value || '0'), 0)
      const purchases = Math.round(sumActions(PURCHASE_TYPES))
      const leads = Math.round(sumActions(LEAD_TYPES))
      const conversations = Math.round(sumActions(CONV_TYPES))

      const healthScore = calculateHealthScore({
        hasPixel,
        activeCampaigns,
        cpp,
        ctr,
        spend: monthlySpend,
      })

      const status =
        acc.account_status !== 1
          ? 'paused'
          : activeCampaigns === 0
          ? 'no_campaigns'
          : dailySpend === 0
          ? 'error'
          : 'active'

      const alerts = detectAlerts({
        name: acc.name,
        activeCampaigns,
        hasPixel,
        cpp,
        monthlySpend,
      })

      return {
        id: acc.id,
        name: acc.name,
        status,
        healthScore,
        dailySpend,
        weeklySpend: 0,
        monthlySpend,
        activeCampaigns,
        pausedCampaigns: cams.length - activeCampaigns,
        leads,
        purchases,
        conversations,
        cpp,
        ctr,
        pixel: hasPixel,
        alerts,
      }
    })
  )

  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => (r as PromiseFulfilledResult<unknown>).value)
}
