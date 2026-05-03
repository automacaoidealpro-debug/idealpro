import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { generateOptimizations, CampaignItem, AdInsightsFull } from '@/lib/optimizations'

// ── Interfaces ────────────────────────────────────────────────────────────────
interface FullInsights {
  spend: number; impressions: number; clicks: number; ctr: number; cpp: number
  cpm: number; reach: number; frequency: number; linkClicks: number
  hookRate: number; videoView3s: number; thruplayCount: number
  addToCart: number; profileVisits: number; postEngagement: number
  initiateCheckout: number; results: number; resultType: string
  costPerResult: number; purchaseValue: number; roas: number
}

interface BreakdownRow {
  segment: string; spend: number; impressions: number; clicks: number
  ctr: number; cpp: number; reach: number; results: number
  resultType?: string; costPerResult?: number
  leads?: number; purchases?: number; conversations?: number
}

interface HourlyRow {
  hour: number; label: string; spend: number; impressions: number; clicks: number; ctr: number; cpp: number
}

interface DayRow {
  day: number; name: string; spend: number; results: number; clicks: number; impressions: number
  avgSpend: number; ctr: number; costPerResult: number
}

interface WeekRow {
  week: number; name: string; spend: number; results: number; clicks: number; impressions: number
  ctr: number; costPerResult: number
}

interface FullAdset {
  id: string; name: string; status: string; daily_budget?: string
  insights: FullInsights | null; ads: unknown[]
}

interface FullCampaign {
  id: string; name: string; objective: string; status: string
  daily_budget?: string; lifetime_budget?: string
  insights: FullInsights | null; adsets: FullAdset[]
}

interface AccountBreakdowns {
  gender: BreakdownRow[]; age: BreakdownRow[]
  platform: BreakdownRow[]
  platform_position: { segment: string; spend: number; ctr: number; cpp: number }[]
  device: BreakdownRow[]
  region: BreakdownRow[]; city: BreakdownRow[]
  hourly: HourlyRow[]; byDayOfWeek: DayRow[]; byWeekOfMonth: WeekRow[]
}

interface FullData {
  period: string
  account: { id: string; insights: FullInsights | null; breakdowns: AccountBreakdowns }
  campaigns: FullCampaign[]
}

// ── Map to CampaignItem for rule engine ───────────────────────────────────────
function toAdInsightsFull(ins: FullInsights): AdInsightsFull {
  return {
    spend: ins.spend, impressions: ins.impressions, clicks: ins.clicks,
    ctr: ins.ctr, cpp: ins.cpp, reach: ins.reach, frequency: ins.frequency,
    linkClicks: ins.linkClicks, hookRate: ins.hookRate, videoView3s: ins.videoView3s,
    thruplayCount: ins.thruplayCount, addToCart: ins.addToCart,
    profileVisits: ins.profileVisits, postEngagement: ins.postEngagement,
    initiateCheckout: ins.initiateCheckout, results: ins.results,
    resultType: ins.resultType, costPerResult: ins.costPerResult,
  }
}

function toCampaignItems(campaigns: FullCampaign[]): CampaignItem[] {
  return campaigns.map(c => ({
    id: c.id, name: c.name, objective: c.objective, effective_status: c.status,
    daily_budget: c.daily_budget, lifetime_budget: c.lifetime_budget,
    insights: c.insights ? toAdInsightsFull(c.insights) : null,
    adsets: c.adsets.map(s => ({
      id: s.id, name: s.name, effective_status: s.status,
      insights: s.insights ? toAdInsightsFull(s.insights) : null,
    })),
  }))
}

// ── Temporal + geographic insights for rule engine ────────────────────────────
function buildPerformanceMaps(breakdowns: AccountBreakdowns) {
  const bd = breakdowns

  // Best hours (by CTR)
  const sortedHours = [...bd.hourly].sort((a, b) => b.ctr - a.ctr)
  const bestHours = sortedHours.slice(0, 5)
  const worstHours = sortedHours.slice(-3)

  // Consecutive best-hour block
  let peakBlock = ''
  if (bestHours.length >= 2) {
    const hours = sortedHours.slice(0, 3).map(h => h.hour).sort((a, b) => a - b)
    peakBlock = `${String(hours[0]).padStart(2,'0')}h–${String(hours[hours.length-1]+1).padStart(2,'0')}h`
  }

  // Best day of week (by results, then by ctr)
  const daysWithResults = bd.byDayOfWeek.filter(d => d.results > 0)
  const bestDay = daysWithResults.length > 0
    ? daysWithResults.reduce((a, b) => {
        if (a.costPerResult > 0 && b.costPerResult > 0) return a.costPerResult < b.costPerResult ? a : b
        return a.results > b.results ? a : b
      })
    : bd.byDayOfWeek.sort((a, b) => b.ctr - a.ctr)[0]

  const worstDay = daysWithResults.length > 0
    ? daysWithResults.reduce((a, b) => a.costPerResult > b.costPerResult ? a : b)
    : null

  // Best week of month
  const weeksWithResults = bd.byWeekOfMonth.filter(w => w.results > 0)
  const bestWeek = weeksWithResults.length > 0
    ? weeksWithResults.reduce((a, b) => a.results > b.results ? a : b)
    : bd.byWeekOfMonth.sort((a, b) => b.ctr - a.ctr)[0]

  // Top cities + regions — sorted by results first, then spend
  const topCities = [...bd.city.filter(c => c.spend > 0)]
    .sort((a, b) => b.results !== a.results ? b.results - a.results : b.spend - a.spend)
    .slice(0, 10)
  const topRegions = [...bd.region.filter(r => r.spend > 0)]
    .sort((a, b) => b.results !== a.results ? b.results - a.results : b.spend - a.spend)
    .slice(0, 8)

  // Best demographic
  const topGender = bd.gender.sort((a, b) => {
    if (a.results > 0 && b.results > 0) return (a.costPerResult || 999) - (b.costPerResult || 999)
    return b.spend - a.spend
  })[0]
  const topAge = bd.age.sort((a, b) => {
    if (a.results > 0 && b.results > 0) return (a.costPerResult || 999) - (b.costPerResult || 999)
    return b.spend - a.spend
  })[0]

  return {
    bestHours, worstHours, peakBlock, bestDay, worstDay, bestWeek,
    topCities, topRegions, topGender, topAge,
  }
}

// ── Rule-based full analysis ──────────────────────────────────────────────────
function ruleBasedAnalysis(data: FullData) {
  const campaigns = toCampaignItems(data.campaigns)
  const optimizations = generateOptimizations(campaigns)
  const campaignIds = new Set(campaigns.map(c => c.id))
  const pm = buildPerformanceMaps(data.account.breakdowns)

  // Score
  const acc = data.account.insights
  let score = 40
  if (acc) {
    if (acc.spend > 0)          score += 10
    if (acc.ctr >= 1)           score += 15
    if (acc.results > 0)        score += 15
    if (acc.frequency < 3.5)    score += 10
    if (acc.hookRate >= 20)     score += 5
    if (acc.roas >= 2)          score += 5
  }
  if (campaigns.length > 0) score += 10
  score = Math.min(score, 100)

  const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  const totalSpend = campaigns.reduce((s, c) => s + (c.insights?.spend || 0), 0)
  const totalResults = campaigns.reduce((s, c) => s + (c.insights?.results || 0), 0)

  // Summary
  let summary = `Conta com ${campaigns.length} campanha${campaigns.length !== 1 ? 's' : ''} ativa${campaigns.length !== 1 ? 's' : ''}, `
  summary += totalSpend > 0 ? `${fmt(totalSpend)} investidos no período. ` : 'sem gasto no período. '
  summary += totalResults > 0 ? `${totalResults} resultado${totalResults !== 1 ? 's' : ''} obtidos. ` : 'Sem resultados registrados. '
  const highCount = optimizations.filter(o => o.priority === 'high').length
  if (highCount > 0) summary += `${highCount} ponto${highCount !== 1 ? 's' : ''} urgente${highCount !== 1 ? 's' : ''} identificado${highCount !== 1 ? 's' : ''}.`
  else summary += 'Sem pontos críticos identificados.'

  // Critical findings
  const findings: string[] = []
  if (highCount > 0) findings.push(`${highCount} ação urgente${highCount !== 1 ? 's' : ''} identificada${highCount !== 1 ? 's' : ''}`)
  if (acc && acc.frequency > 3.5) findings.push(`Frequência ${acc.frequency.toFixed(1)} — criativos precisam ser renovados`)
  if (acc && acc.ctr < 1 && acc.spend > 50) findings.push(`CTR ${acc.ctr.toFixed(2)}% abaixo do mínimo`)
  const noResultCamps = campaigns.filter(c => c.insights && c.insights.spend > 100 && c.insights.results === 0)
  if (noResultCamps.length > 0) findings.push(`${noResultCamps.length} campanha${noResultCamps.length !== 1 ? 's' : ''} com > R$100 gastos sem resultado`)

  // Temporal findings
  if (pm.peakBlock) findings.push(`Melhor horário: ${pm.peakBlock} — aumentar verba neste período`)
  if (pm.bestDay) findings.push(`Melhor dia: ${pm.bestDay.name} (${pm.bestDay.results > 0 ? `${pm.bestDay.results} resultados` : `CTR ${pm.bestDay.ctr.toFixed(2)}%`}) — focar atendimento`)
  if (pm.bestWeek) findings.push(`Melhor semana do mês: ${pm.bestWeek.name} (${pm.bestWeek.results > 0 ? `${pm.bestWeek.results} resultados` : `maior engajamento`}) — ideal para promoções`)
  if (pm.topCities.length > 0) {
    const withResults = pm.topCities.filter(c => c.results > 0)
    if (withResults.length > 0) {
      const top3 = withResults.slice(0, 3).map(c => `${c.segment.split(',')[0]} (${c.results} resultados)`).join(', ')
      findings.push(`Regiões com mais conversões: ${top3}`)
    } else {
      const top3 = pm.topCities.slice(0, 3).map(c => c.segment.split(',')[0]).join(', ')
      findings.push(`Cidades com mais investimento: ${top3}`)
    }
  }
  if (pm.topRegions.length > 0) {
    const withResults = pm.topRegions.filter(r => r.results > 0)
    if (withResults.length > 0) {
      const top = withResults[0]
      findings.push(`Estado/região com maior conversão: ${top.segment} — ${top.results} resultado${top.results !== 1 ? 's' : ''}`)
    }
  }

  // Temporal + geographic actions
  const temporalActions = []

  if (pm.bestHours.length > 0) {
    const topHoursCtr = pm.bestHours.map(h => h.label).join(', ')
    temporalActions.push({
      id: `rule_temporal_1`,
      priority: 'low' as const,
      type: 'budget_reallocation',
      title: `Aumentar verba nos horários de pico`,
      reason: `Horários com melhor CTR: ${topHoursCtr}. Concentrar verba neste bloco pode reduzir CPL.`,
      expected_impact: `Potencial de -15% no custo por resultado`,
      entity_type: 'account',
      entity_id: data.account.id,
      entity_name: 'Conta',
      execution_params: null,
    })
  }

  if (pm.bestDay && pm.worstDay && pm.worstDay.costPerResult > pm.bestDay.costPerResult * 1.5) {
    temporalActions.push({
      id: `rule_temporal_2`,
      priority: 'medium' as const,
      type: 'budget_reallocation',
      title: `Redistribuir verba entre dias da semana`,
      reason: `${pm.bestDay.name}: custo/resultado ${fmt(pm.bestDay.costPerResult)}. ${pm.worstDay.name}: ${fmt(pm.worstDay.costPerResult)}. Aumentar budget no melhor dia, reduzir no pior.`,
      expected_impact: `Redução de até 20% no custo médio por resultado`,
      entity_type: 'account',
      entity_id: data.account.id,
      entity_name: 'Conta',
      execution_params: null,
    })
  }

  if (pm.topCities.length >= 2) {
    const topCity = pm.topCities[0]
    const hasResults = pm.topCities.filter(c => c.results > 0)
    if (hasResults.length > 0) {
      const bestCity = hasResults.reduce((a, b) => (a.costPerResult || 999) < (b.costPerResult || 999) ? a : b)
      temporalActions.push({
        id: `rule_geo_1`,
        priority: 'low' as const,
        type: 'audience_fix',
        title: `Criar campanha geo-segmentada para ${bestCity.segment.split(',')[0]}`,
        reason: `${bestCity.segment.split(',')[0]} gera ${bestCity.results} resultado${bestCity.results !== 1 ? 's' : ''} com ${fmt(bestCity.spend)} investidos${bestCity.costPerResult ? ` (${fmt(bestCity.costPerResult)}/resultado)` : ''}. Criar conjunto exclusivo para este local.`,
        expected_impact: `Segmentação geográfica reduz desperdício e concentra verba onde converte`,
        entity_type: 'account',
        entity_id: data.account.id,
        entity_name: `Campanha — ${bestCity.segment.split(',')[0]}`,
        execution_params: null,
      })
    } else {
      temporalActions.push({
        id: `rule_geo_1`,
        priority: 'low' as const,
        type: 'audience_fix',
        title: `Criar adset geo-segmentado para ${topCity.segment.split(',')[0]}`,
        reason: `${topCity.segment.split(',')[0]} concentra ${((topCity.spend / totalSpend) * 100).toFixed(0)}% do investimento. Testar conjunto exclusivo nesta localidade.`,
        expected_impact: `Mais controle sobre budget por região`,
        entity_type: 'account',
        entity_id: data.account.id,
        entity_name: 'Conta',
        execution_params: null,
      })
    }
  }

  // Combine: campaign actions + temporal/geo actions
  const typeMap: Record<string, string> = {
    pause: 'pause_adset', scale: 'scale_adset',
    creative: 'creative_change', audience: 'audience_fix',
    budget: 'budget_reallocation', remarketing: 'audience_fix',
    pixel: 'fix_tracking',
  }

  const campaignActions = optimizations.slice(0, 12).map((o, i) => {
    const isCampaign = o.entityId ? campaignIds.has(o.entityId) : false
    let actionType = typeMap[o.type] || o.type
    if (o.type === 'pause' && isCampaign) actionType = 'pause_campaign'
    if (o.type === 'scale' && isCampaign) actionType = 'scale_campaign'

    let executionParams: Record<string, string> | null = null
    if (o.type === 'pause' && o.entityId) {
      executionParams = { status: 'PAUSED' }
    } else if (o.type === 'scale' && o.entityId) {
      const rawAdset = data.campaigns.flatMap(c => c.adsets).find(s => s.id === o.entityId)
      const camp = data.campaigns.find(c => c.id === o.entityId)
      const budgetStr = camp?.daily_budget || rawAdset?.daily_budget
      if (budgetStr) executionParams = { daily_budget: String(Math.round(parseInt(budgetStr) * 1.2)) }
    }

    const entityName = o.entityId
      ? (campaigns.find(c => c.id === o.entityId)?.name ||
         campaigns.flatMap(c => c.adsets).find(s => s.id === o.entityId)?.name || o.entityId)
      : 'Conta'

    return {
      id: `rule_${i + 1}`,
      priority: o.priority,
      type: actionType,
      title: o.title,
      reason: o.detail,
      expected_impact: o.metrics,
      entity_type: isCampaign ? 'campaign' : 'adset',
      entity_id: o.entityId || '',
      entity_name: entityName,
      execution_params: executionParams,
    }
  })

  const actions = [...campaignActions, ...temporalActions].slice(0, 15)

  // Audience suggestions
  const audienceSuggestions = []

  if (pm.topCities.length > 0) {
    const topCity = pm.topCities[0]
    audienceSuggestions.push({
      name: `Público geo — ${topCity.segment.split(',')[0]}`,
      type: 'website_visitors' as const,
      retention_days: 30,
      description: `Visitantes do site nos últimos 30 dias localizados em ${topCity.segment.split(',')[0]}. ${topCity.results > 0 ? `Esta cidade gerou ${topCity.results} resultados.` : ''}`,
      base_audience: null,
    })
  }

  if (pm.topGender) {
    audienceSuggestions.push({
      name: `Lookalike — ${pm.topGender.segment === 'male' ? 'Homens' : 'Mulheres'} que converteram`,
      type: 'lookalike' as const,
      retention_days: null,
      description: `Gênero ${pm.topGender.segment === 'male' ? 'masculino' : 'feminino'} representa ${((pm.topGender.spend / totalSpend) * 100).toFixed(0)}% do investimento${pm.topGender.results > 0 ? ` e ${pm.topGender.results} resultados` : ''}. Lookalike 1% deste público.`,
      base_audience: `Convertidos — ${pm.topGender.segment === 'male' ? 'Homens' : 'Mulheres'}`,
    })
  }

  if (campaigns.some(c => c.insights?.results && c.insights.results > 0)) {
    audienceSuggestions.push({
      name: 'Lookalike de Convertidos 1%',
      type: 'lookalike' as const,
      retention_days: null,
      description: 'Lookalike dos clientes que já converteram. Público de maior qualidade para escalar.',
      base_audience: 'Lista de compradores/leads',
    })
  }

  audienceSuggestions.push({
    name: 'Engajamento Instagram — 60 dias',
    type: 'engagement' as const,
    retention_days: 60,
    description: 'Pessoas que interagiram com o perfil ou posts. Ótimo para remarketing de meio de funil.',
    base_audience: null,
  })

  // Campaign structure notes
  const structureNotes = [
    `Bairros específicos (Tatuapé, Itaim Paulista etc.) não aparecem no breakdown da Meta API — crie conjuntos separados com geo-targeting por raio (ex: 2km ao redor do bairro) para comparar performance entre regiões.`,
  ]

  if (pm.bestDay) structureNotes.push(`Focar atendimento humano nas ${pm.bestDay.name}s — maior volume de resultados neste dia.`)
  if (pm.bestWeek) structureNotes.push(`Investir mais na ${pm.bestWeek.name} do mês — melhor performance histórica para promoções e campanhas de oferta.`)
  if (pm.peakBlock) structureNotes.push(`Usar regra de orçamento automático para aumentar verba ${pm.peakBlock} — janela de maior engajamento.`)

  // Performance maps for UI
  const performanceMaps = {
    hourly: data.account.breakdowns.hourly,
    byDayOfWeek: data.account.breakdowns.byDayOfWeek,
    byWeekOfMonth: data.account.breakdowns.byWeekOfMonth,
    topPlatforms: data.account.breakdowns.platform || [],
    topDevices: data.account.breakdowns.device || [],
    topCities: [...data.account.breakdowns.city]
      .sort((a, b) => b.results !== a.results ? b.results - a.results : b.spend - a.spend)
      .slice(0, 15),
    topRegions: [...data.account.breakdowns.region]
      .sort((a, b) => b.results !== a.results ? b.results - a.results : b.spend - a.spend)
      .slice(0, 10),
    topGender: data.account.breakdowns.gender,
    topAge: data.account.breakdowns.age,
    bestHour: pm.bestHours[0] || null,
    bestDay: pm.bestDay || null,
    bestWeek: pm.bestWeek || null,
  }

  return {
    score,
    summary,
    critical_findings: findings,
    actions,
    audience_suggestions: audienceSuggestions,
    campaign_structure_notes: structureNotes,
    performance_maps: performanceMaps,
    _source: 'rule_engine',
  }
}

// ── Claude system prompt ──────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Você é o melhor especialista em Meta Ads do Brasil, com 10+ anos otimizando contas. Analise TODOS os dados incluindo breakdowns temporais e geográficos.

ANÁLISE OBRIGATÓRIA:
1. Campanhas/conjuntos/anúncios — problemas e oportunidades
2. Horários — qual hora tem melhor CTR/conversão, sugerir regra de budget automático
3. Dias da semana — qual dia tem mais resultados, quando focar atendimento
4. Semanas do mês — qual semana é ideal para promoções
5. Cidades/regiões — quais localidades convertem mais, sugerir campanhas geo-segmentadas
6. Demografico — gênero e faixa etária que melhor converte

IMPORTANTE SOBRE BAIRROS: A Meta API não retorna breakdowns por bairro (Tatuapé, Itaim Paulista etc.) — apenas por cidade. Para análise por bairro, recomende criar conjuntos separados com geo-targeting por raio (2km).

Retorne APENAS JSON válido sem markdown:

{
  "score": number,
  "summary": "2-3 frases",
  "critical_findings": ["finding1", "finding2"],
  "actions": [{
    "id": "act_1",
    "priority": "high|medium|low",
    "type": "pause_campaign|pause_adset|scale_adset|scale_campaign|creative_change|budget_reallocation|audience_fix|fix_tracking",
    "title": "string",
    "reason": "string com dados específicos",
    "expected_impact": "string",
    "entity_type": "campaign|adset|ad|account",
    "entity_id": "id real",
    "entity_name": "nome real",
    "execution_params": {"status":"PAUSED"} | {"daily_budget":"centavos"} | null
  }],
  "audience_suggestions": [{
    "name": "string",
    "type": "website_visitors|engagement|lookalike|custom_list",
    "retention_days": number | null,
    "description": "string",
    "base_audience": "string | null"
  }],
  "campaign_structure_notes": ["note1"],
  "performance_maps": {
    "hourly": [],
    "byDayOfWeek": [],
    "byWeekOfMonth": [],
    "topCities": [],
    "topRegions": [],
    "topGender": [],
    "topAge": [],
    "bestHour": null,
    "bestDay": null,
    "bestWeek": null
  }
}`

export async function POST(req: Request) {
  try {
    const { data } = await req.json() as { data: FullData }

    if (process.env.ANTHROPIC_API_KEY) {
      try {
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 6000,
          system: SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: `Analise esta conta Meta Ads (período: ${data.period}):\n\n${JSON.stringify(data, null, 2)}`,
          }],
        })
        const text = message.content[0].type === 'text' ? message.content[0].text : ''
        const cleaned = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
        const analysis = JSON.parse(cleaned)
        // Backfill fields Claude might omit from performance_maps
        if (analysis.performance_maps) {
          if (!analysis.performance_maps.topPlatforms) analysis.performance_maps.topPlatforms = data.account.breakdowns.platform || []
          if (!analysis.performance_maps.topDevices) analysis.performance_maps.topDevices = data.account.breakdowns.device || []
          if (!analysis.performance_maps.topCities?.length) {
            analysis.performance_maps.topCities = [...(data.account.breakdowns.city || [])]
              .sort((a, b) => b.results !== a.results ? b.results - a.results : b.spend - a.spend).slice(0, 15)
          }
          if (!analysis.performance_maps.topRegions?.length) {
            analysis.performance_maps.topRegions = [...(data.account.breakdowns.region || [])]
              .sort((a, b) => b.results !== a.results ? b.results - a.results : b.spend - a.spend).slice(0, 10)
          }
        }
        // Ensure performance_maps is populated even when Claude doesn't return it
        if (!analysis.performance_maps) {
          analysis.performance_maps = {
            hourly: data.account.breakdowns.hourly,
            byDayOfWeek: data.account.breakdowns.byDayOfWeek,
            byWeekOfMonth: data.account.breakdowns.byWeekOfMonth,
            topPlatforms: data.account.breakdowns.platform || [],
            topDevices: data.account.breakdowns.device || [],
            topCities: [...(data.account.breakdowns.city || [])]
              .sort((a, b) => b.results !== a.results ? b.results - a.results : b.spend - a.spend)
              .slice(0, 15),
            topRegions: [...(data.account.breakdowns.region || [])]
              .sort((a, b) => b.results !== a.results ? b.results - a.results : b.spend - a.spend)
              .slice(0, 10),
            topGender: data.account.breakdowns.gender || [],
            topAge: data.account.breakdowns.age || [],
            bestHour: null, bestDay: null, bestWeek: null,
          }
        }
        return NextResponse.json({ analysis, _source: 'claude' })
      } catch (claudeError) {
        const msg = String(claudeError)
        const isBilling = msg.includes('credit balance') || msg.includes('billing') || msg.includes('quota') || msg.includes('529')
        if (!isBilling) console.error('Claude error:', msg)
      }
    }

    // Fallback: rule-based
    const analysis = ruleBasedAnalysis(data)
    return NextResponse.json({ analysis })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
