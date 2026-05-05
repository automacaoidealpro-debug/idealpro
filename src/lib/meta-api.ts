const BASE_URL = 'https://graph.facebook.com/v20.0'
const TOKEN = process.env.META_ACCESS_TOKEN || process.env.NEXT_PUBLIC_META_ACCESS_TOKEN

async function metaFetch(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE_URL}${path}`)
  url.searchParams.set('access_token', TOKEN!)
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v)
  }
  const res = await fetch(url.toString(), { cache: 'no-store' })
  if (!res.ok) throw new Error(`Meta API error: ${res.status}`)
  return res.json()
}

type MetaAccount = { id: string; name: string; account_status: number; currency?: string; amount_spent?: string; balance?: string }

export async function getAllAccounts(): Promise<MetaAccount[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const all: any[] = []
  let nextUrl: string | null = null

  // First page
  const first = await metaFetch('/me/adaccounts', {
    fields: 'id,name,account_status,currency,amount_spent,balance',
    limit: '200',
  })
  all.push(...(first.data || []))
  nextUrl = first.paging?.next || null

  // Follow cursor pagination until exhausted
  while (nextUrl) {
    const res = await fetch(nextUrl, { cache: 'no-store' })
    if (!res.ok) break
    const page = await res.json()
    if (!page.data?.length) break
    all.push(...page.data)
    nextUrl = page.paging?.next || null
  }

  return all
}

export async function getAccountInsights(accountId: string, datePreset = 'today') {
  try {
    const data = await metaFetch(`/${accountId}/insights`, {
      fields: 'spend,impressions,clicks,reach,ctr,cpm,cpp,frequency,actions',
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
      filtering: JSON.stringify([
        { field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] },
      ]),
      limit: '200',
    })
    return data.data || []
  } catch {
    // fallback sem filtering se a API rejeitar
    try {
      const data = await metaFetch(`/${accountId}/campaigns`, {
        fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget',
        limit: '200',
      })
      return data.data || []
    } catch { return [] }
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
  frequency?: number
  impressions?: number
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

  if (account.frequency && account.impressions && account.impressions > 5000) {
    if (account.frequency > 6) {
      alerts.push({
        type: 'high_cpp' as const,
        message: `Frequência crítica: ${account.frequency.toFixed(1)} — trocar criativo`,
        severity: 'high' as const,
      })
    } else if (account.frequency > 3.5) {
      alerts.push({
        type: 'low_ctr' as const,
        message: `Frequência alta: ${account.frequency.toFixed(1)} — considerar novo criativo`,
        severity: 'medium' as const,
      })
    }
  }

  return alerts
}

// Priority-ordered — first non-zero wins, avoids CAPI double-counting
const PURCHASE_PRIORITY = ['omni_purchase', 'purchase', 'fb_pixel_purchase']
const LEAD_PRIORITY = ['onsite_conversion.lead_grouped', 'lead', 'complete_registration', 'fb_pixel_lead']
const CONV_PRIORITY = ['onsite_conversion.messaging_conversation_started_7d', 'onsite_conversion.messaging_first_reply', 'messaging_conversation_started_7d']
const RESULT_PRIORITY = [...PURCHASE_PRIORITY, ...CONV_PRIORITY, ...LEAD_PRIORITY]

type Action = { action_type: string; value: string }

function getBest(actions: Action[], types: string[]): number {
  for (const t of types) {
    const a = actions.find(x => x.action_type === t)
    if (a) {
      const v = Math.round(parseFloat(a.value || '0'))
      if (v > 0) return v
    }
  }
  return 0
}

async function concurrentMap<T, R>(items: T[], fn: (item: T) => Promise<R>, limit = 5): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let idx = 0
  async function worker() {
    while (idx < items.length) {
      const i = idx++
      try {
        results[i] = { status: 'fulfilled', value: await fn(items[i]) }
      } catch (e) {
        results[i] = { status: 'rejected', reason: e }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

export async function buildClientDashboard() {
  const accounts = await getAllAccounts()

  const results = await concurrentMap(
    accounts as { id: string; name: string; account_status: number }[],
    async (acc) => {
      const [todayInsights, monthInsights, lastMonthInsights, campaigns, pixels] = await Promise.allSettled([
        getAccountInsights(acc.id, 'today'),
        getAccountInsights(acc.id, 'this_month'),
        getAccountInsights(acc.id, 'last_month'),
        getAccountCampaigns(acc.id),
        getAccountPixels(acc.id),
      ])

      const today = todayInsights.status === 'fulfilled' ? todayInsights.value : null
      const month = monthInsights.status === 'fulfilled' ? monthInsights.value : null
      const lastMonth = lastMonthInsights.status === 'fulfilled' ? lastMonthInsights.value : null
      const cams = campaigns.status === 'fulfilled' ? campaigns.value : []
      const pxs = pixels.status === 'fulfilled' ? pixels.value : []

      const activeCampaigns = cams.filter(
        (c: { effective_status: string }) => c.effective_status === 'ACTIVE'
      ).length
      const hasPixel = pxs.length > 0
      const dailySpend = parseFloat(today?.spend || '0')
      const monthlySpend = parseFloat(month?.spend || '0')
      const lastMonthSpend = parseFloat(lastMonth?.spend || '0')
      const ctr = parseFloat(month?.ctr || '0')

      const actions: Action[] = month?.actions || []
      const purchases = getBest(actions, PURCHASE_PRIORITY)
      const leads = getBest(actions, LEAD_PRIORITY)
      const conversations = getBest(actions, CONV_PRIORITY)
      const monthResults = getBest(actions, RESULT_PRIORITY)
      const lastMonthActions: Action[] = lastMonth?.actions || []
      const lastMonthResults = getBest(lastMonthActions, RESULT_PRIORITY)

      const cpp = monthResults > 0 ? monthlySpend / monthResults : 0
      const frequency = parseFloat(month?.frequency || '0')

      const healthScore = calculateHealthScore({
        hasPixel,
        activeCampaigns,
        cpp,
        ctr,
        spend: monthlySpend,
      })

      // account_status: 1 = ACTIVE, outros = desativado/suspenso/etc.
      // Trata null/undefined como desconhecido (não marca como pausado).
      const metaAccountInactive =
        acc.account_status != null && acc.account_status !== 1

      const status =
        metaAccountInactive
          ? 'paused'
          : activeCampaigns === 0
          ? 'no_campaigns'
          : monthlySpend === 0
          ? 'error'   // zero de gasto no mês inteiro → realmente sem gasto
          : 'active'

      const alerts = detectAlerts({
        name: acc.name,
        activeCampaigns,
        hasPixel,
        cpp,
        monthlySpend,
        frequency,
        impressions: parseInt(month?.impressions || '0'),
      })

      return {
        id: acc.id,
        name: acc.name,
        status,
        healthScore,
        dailySpend,
        weeklySpend: 0,
        monthlySpend,
        lastMonthSpend,
        lastMonthResults,
        monthResults,
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
    }
  )

  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    // Account failed to load — include it with error state so it shows in the dashboard
    const acc = (accounts as { id: string; name: string }[])[i]
    return {
      id: acc?.id || String(i),
      name: acc?.name || `Conta ${i + 1}`,
      status: 'error',
      healthScore: 0,
      dailySpend: 0,
      weeklySpend: 0,
      monthlySpend: 0,
      lastMonthSpend: 0,
      lastMonthResults: 0,
      monthResults: 0,
      activeCampaigns: 0,
      pausedCampaigns: 0,
      leads: 0,
      purchases: 0,
      conversations: 0,
      cpp: 0,
      ctr: 0,
      pixel: false,
      alerts: [{ type: 'campaign_stopped' as const, message: 'Erro ao carregar dados da conta', severity: 'high' as const }],
    }
  })
}
