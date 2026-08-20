export interface AdInsightsFull {
  spend: number
  impressions: number
  clicks: number
  ctr: number
  cpm: number
  cpp: number
  reach: number
  frequency: number
  linkClicks: number
  outboundClicks: number
  hookRate: number
  videoView3s: number
  thruplayCount: number
  addToCart: number
  profileVisits: number
  postEngagement: number
  initiateCheckout: number
  messages: number
  clickToMessage: number
  reachToMessage: number
  results: number
  resultType: string
  costPerResult: number
}

export interface AdItem {
  id: string
  name: string
  effective_status: string
  creative?: { thumbnail_url?: string; name?: string }
  insights: AdInsightsFull | null
}

export interface AdSetItem {
  id: string
  name: string
  effective_status: string
  insights: AdInsightsFull | null
  ads?: AdItem[]
}

export interface CampaignItem {
  id: string
  name: string
  objective: string
  effective_status: string
  daily_budget?: string
  lifetime_budget?: string
  insights: AdInsightsFull | null
  adsets: AdSetItem[]
}

export interface Optimization {
  priority: 'high' | 'medium' | 'low'
  type: 'pause' | 'scale' | 'creative' | 'audience' | 'budget' | 'pixel' | 'remarketing'
  icon: string
  title: string
  detail: string
  metrics: string
  entityId?: string
}

const OBJECTIVE_MAP: Record<string, string> = {
  OUTCOME_LEADS: 'Leads',
  OUTCOME_SALES: 'Vendas',
  OUTCOME_ENGAGEMENT: 'Engajamento / Mensagens',
  OUTCOME_TRAFFIC: 'Tráfego',
  OUTCOME_AWARENESS: 'Reconhecimento',
  LEAD_GENERATION: 'Leads',
  CONVERSIONS: 'Conversões',
  MESSAGES: 'Mensagens',
  LINK_CLICKS: 'Cliques',
  BRAND_AWARENESS: 'Reconhecimento',
  REACH: 'Alcance',
}

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function obj(raw: string) {
  return OBJECTIVE_MAP[raw] || raw
}

export function generateOptimizations(campaigns: CampaignItem[]): Optimization[] {
  const opts: Optimization[] = []

  // Aggregate account-level CPR for reference
  let totalSpend = 0, totalResults = 0, totalCpr = 0, cprCount = 0
  for (const c of campaigns) {
    if (!c.insights) continue
    totalSpend += c.insights.spend
    totalResults += c.insights.results
    if (c.insights.costPerResult > 0) { totalCpr += c.insights.costPerResult; cprCount++ }
  }
  const avgCpr = cprCount > 0 ? totalCpr / cprCount : 0

  for (const c of campaigns) {
    const ci = c.insights
    const objective = obj(c.objective)
    const MIN_SPEND = 50 // R$50 minimum before drawing conclusions

    // ── Campaign-level checks ──────────────────────────────────────────────

    if (ci && ci.spend > MIN_SPEND) {
      // No results with significant spend
      if (ci.results === 0 && ci.spend > 100) {
        opts.push({
          priority: 'high',
          type: 'pause',
          icon: '🛑',
          title: `Campanha sem resultados`,
          detail: `"${c.name}" gastou ${fmt(ci.spend)} sem nenhum resultado. Possível problema de público, pixel ou criativo.`,
          metrics: `Gasto: ${fmt(ci.spend)} | Objetivo: ${objective} | CTR: ${ci.ctr.toFixed(2)}%`,
          entityId: c.id,
        })
      }

      // CPR 2x above average
      if (avgCpr > 0 && ci.costPerResult > avgCpr * 2 && ci.results > 0) {
        opts.push({
          priority: 'high',
          type: 'pause',
          icon: '💸',
          title: `Custo por resultado alto`,
          detail: `"${c.name}" com custo por resultado 2x acima da média da conta. Pausar e revisar segmentação e criativos.`,
          metrics: `Custo/result.: ${fmt(ci.costPerResult)} | Média conta: ${fmt(avgCpr)} | Objetivo: ${objective}`,
          entityId: c.id,
        })
      }

      // High frequency — creative fatigue
      if (ci.frequency > 3.5) {
        opts.push({
          priority: 'medium',
          type: 'creative',
          icon: '🔄',
          title: `Frequência alta — criativo cansando`,
          detail: `"${c.name}" com frequência ${ci.frequency.toFixed(1)}. Público já viu o anúncio muitas vezes. Criar novos criativos ou expandir público.`,
          metrics: `Frequência: ${ci.frequency.toFixed(1)} | Alcance: ${ci.reach.toLocaleString('pt-BR')}`,
          entityId: c.id,
        })
      }

      // Diagnóstico: CTR baixo + CPM alto → criativo sem atratividade
      if (ci.ctr < 0.8 && ci.cpm > 30 && ci.impressions > 1000) {
        opts.push({
          priority: 'high',
          type: 'creative',
          icon: '🎯',
          title: `Criativo sem atratividade`,
          detail: `"${c.name}": CTR baixo (${ci.ctr.toFixed(2)}%) + CPM alto (${fmt(ci.cpm)}). O público não está reagindo ao anúncio. Reformular criativo, copy e oferta.`,
          metrics: `CTR: ${ci.ctr.toFixed(2)}% | CPM: ${fmt(ci.cpm)} | Impressões: ${ci.impressions.toLocaleString('pt-BR')}`,
          entityId: c.id,
        })
      }

      // Diagnóstico: CTR bom + taxa cliques→msg baixa → WA/destino convertendo mal
      if (ci.ctr >= 1 && ci.messages > 0 && ci.clickToMessage < 30 && ci.linkClicks > 20) {
        opts.push({
          priority: 'high',
          type: 'audience',
          icon: '📱',
          title: `Criativo atrai, mas WA não converte`,
          detail: `"${c.name}": CTR bom (${ci.ctr.toFixed(2)}%) mas apenas ${ci.clickToMessage.toFixed(1)}% dos cliques viram mensagens. Revisar abordagem do WhatsApp, saudação automática e velocidade de resposta.`,
          metrics: `CTR: ${ci.ctr.toFixed(2)}% | Cliques→Msg: ${ci.clickToMessage.toFixed(1)}% | Mensagens: ${ci.messages}`,
          entityId: c.id,
        })
      }

      // Diagnóstico: CTR bom + alcance→msg baixo → oferta sem intenção
      if (ci.ctr >= 1 && ci.messages > 0 && ci.reachToMessage < 0.3 && ci.reach > 5000) {
        opts.push({
          priority: 'medium',
          type: 'creative',
          icon: '💡',
          title: `Alcance alto, oferta sem intenção`,
          detail: `"${c.name}": Bom alcance mas apenas ${ci.reachToMessage.toFixed(2)}% do público converteu. A oferta não está gerando intenção suficiente. Revisar proposta de valor e urgência.`,
          metrics: `Alcance→Msg: ${ci.reachToMessage.toFixed(2)}% | Alcance: ${ci.reach.toLocaleString('pt-BR')} | Mensagens: ${ci.messages}`,
          entityId: c.id,
        })
      }

      // Diagnóstico: tudo bom → escalar
      if (ci.ctr >= 1 && ci.messages > 0 && ci.clickToMessage >= 40 && ci.cpm <= 30 && ci.results > 0) {
        opts.push({
          priority: 'low',
          type: 'scale',
          icon: '🚀',
          title: `Campanha saudável — escalar`,
          detail: `"${c.name}" com todos os indicadores positivos: CTR ${ci.ctr.toFixed(2)}%, Cliques→Msg ${ci.clickToMessage.toFixed(1)}%, CPM ${fmt(ci.cpm)}. Considere aumentar orçamento gradualmente (máx 20%/dia).`,
          metrics: `CTR: ${ci.ctr.toFixed(2)}% | Cliques→Msg: ${ci.clickToMessage.toFixed(1)}% | CPM: ${fmt(ci.cpm)}`,
          entityId: c.id,
        })
      }
    }

    // ── Ad set level checks ────────────────────────────────────────────────

    for (const s of c.adsets) {
      const si = s.insights
      if (!si || si.spend < 30) continue

      // Bad hook rate with enough data
      if (si.hookRate > 0 && si.hookRate < 15 && si.spend > MIN_SPEND) {
        opts.push({
          priority: 'high',
          type: 'creative',
          icon: '🎬',
          title: `Hook Rate fraco — criativo sem gancho`,
          detail: `Conjunto "${s.name}" da campanha "${c.name}". Apenas ${si.hookRate.toFixed(1)}% das pessoas assistiram 3s. Reformular abertura do vídeo — primeiros 3 segundos precisam parar o scroll.`,
          metrics: `Hook: ${si.hookRate.toFixed(1)}% | Impressões: ${si.impressions.toLocaleString('pt-BR')} | Gasto: ${fmt(si.spend)}`,
          entityId: s.id,
        })
      }

      // Excellent hook rate — scale signal
      if (si.hookRate >= 30 && si.results > 0 && si.spend > MIN_SPEND) {
        opts.push({
          priority: 'low',
          type: 'scale',
          icon: '🚀',
          title: `Conjunto vencedor — escalar`,
          detail: `Conjunto "${s.name}" com Hook Rate ${si.hookRate.toFixed(1)}% e ${si.results} resultados. Criativo funcionando. Aumentar orçamento gradualmente (máx 20%/dia).`,
          metrics: `Hook: ${si.hookRate.toFixed(1)}% | ${si.results} resultados | Custo: ${fmt(si.costPerResult)} | CTR: ${si.ctr.toFixed(2)}%`,
          entityId: s.id,
        })
      }

      // Low CTR (updated thresholds: <0.8% critical, <1% attention)
      if (si.ctr < 1 && si.spend > MIN_SPEND) {
        opts.push({
          priority: si.ctr < 0.8 ? 'high' : 'medium',
          type: si.hookRate > 15 ? 'audience' : 'creative',
          icon: '📉',
          title: `CTR baixo${si.hookRate > 15 ? ' — possível problema de público' : ' — criativo não engaja'}`,
          detail: `Conjunto "${s.name}": CTR ${si.ctr.toFixed(2)}%${si.ctr < 0.8 ? ' (crítico)' : ' (atenção)'}. ${si.hookRate > 15 ? 'Hook bom mas sem cliques — revisar copy, CTA e oferta.' : 'Reformular criativo completo.'}`,
          metrics: `CTR: ${si.ctr.toFixed(2)}% | Hook: ${si.hookRate.toFixed(1)}% | Gasto: ${fmt(si.spend)}`,
          entityId: s.id,
        })
      }

      // CPM muito alto no conjunto
      if (si.cpm > 50 && si.spend > MIN_SPEND) {
        opts.push({
          priority: 'medium',
          type: 'audience',
          icon: '💰',
          title: `CPM alto — público saturado ou muito restrito`,
          detail: `Conjunto "${s.name}" com CPM ${fmt(si.cpm)}. Público pode estar saturado ou muito pequeno. Ampliar segmentação ou testar novo público.`,
          metrics: `CPM: ${fmt(si.cpm)} | Alcance: ${si.reach.toLocaleString('pt-BR')} | Frequência: ${si.frequency.toFixed(1)}`,
          entityId: s.id,
        })
      }

      // Cliques→Mensagem baixo no conjunto
      if (si.messages > 0 && si.clickToMessage < 30 && si.linkClicks > 10) {
        opts.push({
          priority: 'medium',
          type: 'creative',
          icon: '📱',
          title: `Taxa Cliques→Mensagem baixa no conjunto`,
          detail: `Conjunto "${s.name}": apenas ${si.clickToMessage.toFixed(1)}% dos cliques resultam em mensagem. Revisar saudação automática e tempo de resposta no WhatsApp.`,
          metrics: `Cliques: ${si.linkClicks} | Mensagens: ${si.messages} | Taxa: ${si.clickToMessage.toFixed(1)}%`,
          entityId: s.id,
        })
      }

      // No results with significant spend
      if (si.results === 0 && si.spend > 80) {
        opts.push({
          priority: 'high',
          type: 'pause',
          icon: '⏸️',
          title: `Conjunto sem conversão — pausar`,
          detail: `Conjunto "${s.name}" gastou ${fmt(si.spend)} sem nenhuma conversão. Pausar imediatamente para concentrar verba nos conjuntos que convertem.`,
          metrics: `Gasto: ${fmt(si.spend)} | Impressões: ${si.impressions.toLocaleString('pt-BR')} | CTR: ${si.ctr.toFixed(2)}%`,
          entityId: s.id,
        })
      }

      // Add to cart but no purchase — remarketing opportunity
      if (si.addToCart > 0 && si.results === 0 && c.objective.includes('SALE')) {
        opts.push({
          priority: 'medium',
          type: 'remarketing',
          icon: '🛒',
          title: `Abandono de carrinho — criar remarketing`,
          detail: `${si.addToCart} pessoas adicionaram ao carrinho mas não compraram no conjunto "${s.name}". Criar campanha de fundo de funil para este público.`,
          metrics: `Add to cart: ${si.addToCart} | Compras: ${si.results} | Gasto: ${fmt(si.spend)}`,
          entityId: s.id,
        })
      }

      // High CPR in adset
      if (avgCpr > 0 && si.costPerResult > avgCpr * 2.5 && si.results > 0) {
        opts.push({
          priority: 'medium',
          type: 'pause',
          icon: '⚠️',
          title: `Conjunto caro — pausar`,
          detail: `Conjunto "${s.name}" com custo por resultado 2.5x acima da média. Pausar e direcionar verba para conjuntos mais eficientes.`,
          metrics: `Custo/result.: ${fmt(si.costPerResult)} | Média: ${fmt(avgCpr)} | Resultados: ${si.results}`,
          entityId: s.id,
        })
      }
    }

    // ── Winner/loser across adsets ─────────────────────────────────────────
    const withResults = c.adsets.filter(s => (s.insights?.results || 0) > 0)
    if (withResults.length >= 2) {
      const best = withResults.reduce((a, b) =>
        (a.insights!.costPerResult || 999) < (b.insights!.costPerResult || 999) ? a : b)
      const worst = withResults.reduce((a, b) =>
        (a.insights!.costPerResult || 0) > (b.insights!.costPerResult || 0) ? a : b)

      if (best.id !== worst.id && worst.insights!.costPerResult > best.insights!.costPerResult * 2) {
        opts.push({
          priority: 'medium',
          type: 'budget',
          icon: '⚖️',
          title: `Concentrar verba no conjunto vencedor`,
          detail: `Em "${c.name}": "${best.name}" tem custo ${fmt(best.insights!.costPerResult)}/resultado vs "${worst.name}" com ${fmt(worst.insights!.costPerResult)}. Migrar verba para o melhor.`,
          metrics: `Melhor: ${fmt(best.insights!.costPerResult)} | Pior: ${fmt(worst.insights!.costPerResult)}`,
        })
      }
    }
  }

  // Sort: high → medium → low
  const order = { high: 0, medium: 1, low: 2 }
  opts.sort((a, b) => order[a.priority] - order[b.priority])

  // Deduplicate similar suggestions (same entity + same type)
  const seen = new Set<string>()
  return opts.filter(o => {
    const key = `${o.type}-${o.entityId || o.title}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
