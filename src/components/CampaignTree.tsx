'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import { AdInsightsFull, CampaignItem } from '@/lib/optimizations'
import { ChevronRight, ChevronDown, RefreshCw, Zap, Target, TrendingUp, AlertCircle } from 'lucide-react'

// ─── Metric pill ──────────────────────────────────────────────────────────────
function Pill({
  label, value, color = 'gray',
}: { label: string; value: string; color?: string }) {
  const colors: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-600',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-600',
    yellow: 'bg-yellow-100 text-yellow-700',
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    orange: 'bg-orange-100 text-orange-700',
    teal: 'bg-teal-100 text-teal-700',
  }
  return (
    <span className={cn('inline-flex flex-col items-center px-2.5 py-1 rounded-lg text-[10px] leading-tight min-w-[60px]', colors[color] || colors.gray)}>
      <span className="font-bold text-xs">{value}</span>
      <span className="opacity-70 mt-0.5">{label}</span>
    </span>
  )
}

// ─── Color helpers (corrected thresholds per brief) ───────────────────────────
function hookColor(v: number) { return v >= 30 ? 'green' : v >= 15 ? 'yellow' : v > 0 ? 'red' : 'gray' }
// Brief: ≥1% bom, 0.8-1% atenção, <0.8% crítico
function ctrColor(v: number) { return v >= 1 ? 'green' : v >= 0.8 ? 'yellow' : v > 0 ? 'red' : 'gray' }
function cprColor(v: number) { return v <= 0 ? 'gray' : v < 30 ? 'green' : v < 100 ? 'yellow' : 'red' }
// CPM: ≤R$15 bom, R$15-R$30 atenção, >R$30 crítico
function cpmColor(v: number) { return v <= 0 ? 'gray' : v <= 15 ? 'green' : v <= 30 ? 'yellow' : 'red' }
// Taxa Cliques→Msg: ≥40% bom, 30-40% atenção, <30% crítico
function c2mColor(v: number) { return v >= 40 ? 'green' : v >= 30 ? 'yellow' : v > 0 ? 'red' : 'gray' }
// Taxa Alcance→Msg: ≥0.5% bom, 0.3-0.5% atenção, <0.3% crítico
function r2mColor(v: number) { return v >= 0.5 ? 'green' : v >= 0.3 ? 'yellow' : v > 0 ? 'red' : 'gray' }

// ─── Automatic diagnosis ──────────────────────────────────────────────────────
function getDiagnosis(ins: AdInsightsFull): { dot: string; text: string } | null {
  if (ins.spend < 20 || ins.impressions < 500) return null

  const { ctr, cpm, clickToMessage, reachToMessage, messages, results, linkClicks, reach } = ins

  // CTR baixo + CPM alto → criativo sem atratividade
  if (ctr < 0.8 && cpm > 30) {
    return { dot: '🔴', text: 'CTR baixo + CPM alto: criativo sem atratividade' }
  }
  // CTR bom + cliques→msg baixo → destino não converte
  if (ctr >= 1 && messages > 0 && linkClicks > 10 && clickToMessage < 30) {
    return { dot: '🔴', text: 'Criativo atrai mas WA não converte — revisar saudação/resposta' }
  }
  // CTR bom + alcance→msg baixo → oferta sem intenção
  if (ctr >= 1 && messages > 0 && reach > 3000 && reachToMessage < 0.3) {
    return { dot: '🟡', text: 'Alcance bom mas oferta não gera intenção suficiente' }
  }
  // Tudo positivo → escalar
  if (ctr >= 1 && results > 0 && (messages === 0 || clickToMessage >= 40) && cpm <= 30) {
    return { dot: '🟢', text: 'Campanha saudável — considere escalar gradualmente' }
  }
  // CTR bom, sem resultados ainda
  if (ctr >= 1 && results === 0 && ins.spend < 50) {
    return { dot: '🟡', text: 'CTR saudável — aguardar mais dados antes de decidir' }
  }

  return null
}

// ─── InsightPills ─────────────────────────────────────────────────────────────
interface InsightPillsProps {
  ins: AdInsightsFull
  resultLabel: string
  level: 'campaign' | 'adset' | 'ad'
}

function InsightPills({ ins, resultLabel, level }: InsightPillsProps) {
  const diagnosis = getDiagnosis(ins)

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* Gasto + Impressões */}
        <Pill label="Gasto" value={formatCurrency(ins.spend)} />
        <Pill label="Impressões" value={formatNumber(ins.impressions)} />

        {/* CTR com limiar correto do brief */}
        <Pill label="CTR" value={ins.ctr > 0 ? `${ins.ctr.toFixed(2)}%` : '—'} color={ctrColor(ins.ctr)} />

        {/* CPM — novo */}
        {ins.cpm > 0 && (
          <Pill label="CPM" value={formatCurrency(ins.cpm)} color={cpmColor(ins.cpm)} />
        )}

        {/* Hook Rate (vídeos) */}
        {ins.hookRate > 0 && (
          <Pill label="Hook Rate" value={`${ins.hookRate.toFixed(1)}%`} color={hookColor(ins.hookRate)} />
        )}

        {/* Cliques e link */}
        <Pill label="Cliques" value={ins.clicks > 0 ? formatNumber(ins.clicks) : '—'} color="blue" />
        {ins.linkClicks > 0 && (
          <Pill label="Clique link" value={formatNumber(ins.linkClicks)} color="blue" />
        )}

        {/* Mensagens — novo */}
        {ins.messages > 0 && (
          <Pill label="Mensagens" value={formatNumber(ins.messages)} color="teal" />
        )}

        {/* Cliques → Mensagem — novo */}
        {ins.clickToMessage > 0 && (
          <Pill
            label="Cliq→Msg"
            value={`${ins.clickToMessage.toFixed(1)}%`}
            color={c2mColor(ins.clickToMessage)}
          />
        )}

        {/* Alcance → Mensagem — novo */}
        {ins.reachToMessage > 0 && (
          <Pill
            label="Alc→Msg"
            value={`${ins.reachToMessage.toFixed(2)}%`}
            color={r2mColor(ins.reachToMessage)}
          />
        )}

        {/* E-commerce extras */}
        {ins.addToCart > 0 && (
          <Pill label="Carrinho" value={formatNumber(ins.addToCart)} color="orange" />
        )}
        {ins.profileVisits > 0 && (
          <Pill label="Visita perfil" value={formatNumber(ins.profileVisits)} color="purple" />
        )}

        {/* Resultados */}
        {ins.results > 0 && (
          <Pill label={resultLabel} value={formatNumber(ins.results)} color="green" />
        )}
        {ins.costPerResult > 0 && (
          <Pill label="Custo/result." value={formatCurrency(ins.costPerResult)} color={cprColor(ins.costPerResult)} />
        )}

        {/* Frequência (não em anúncios) */}
        {level !== 'ad' && ins.frequency > 0 && (
          <Pill label="Frequência" value={ins.frequency.toFixed(1)} color={ins.frequency > 3 ? 'red' : 'gray'} />
        )}
      </div>

      {/* Diagnóstico automático */}
      {diagnosis && (
        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 italic">
          <span>{diagnosis.dot}</span>
          <span>{diagnosis.text}</span>
        </div>
      )}
    </div>
  )
}

// ─── Creative score ──────────────────────────────────────────────────────────
function getAdScore(ins: AdInsightsFull | null): number | null {
  if (!ins || ins.spend < 5) return null
  let pts = 0
  // CTR score (0-4 pts) — thresholds per brief
  if (ins.ctr > 3) pts += 4
  else if (ins.ctr > 2) pts += 3
  else if (ins.ctr >= 1) pts += 2
  else if (ins.ctr >= 0.8) pts += 1
  // Hook rate score (0-2 pts)
  if (ins.hookRate > 0) {
    if (ins.hookRate > 30) pts += 2
    else if (ins.hookRate >= 15) pts += 1
  }
  // Results score (0-2 pts)
  if (ins.results > 0) {
    pts += 2
    if (ins.costPerResult > 0 && ins.costPerResult < 50) pts += 1
  }
  // Messages bonus (+1 if good click→msg rate)
  if (ins.clickToMessage >= 40) pts += 1
  // Normalize: max raw = 10, scale to 0-10
  return Math.min(10, Math.round((pts / 10) * 10))
}

function ScoreBadge({ score }: { score: number }) {
  const colorClass = score >= 8 ? 'bg-green-100 text-green-700 border-green-200'
    : score >= 5 ? 'bg-yellow-100 text-yellow-700 border-yellow-200'
    : 'bg-red-100 text-red-700 border-red-200'
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0', colorClass)}>
      Score {score}/10
    </span>
  )
}

// ─── Status label helper ──────────────────────────────────────────────────────
function statusLabel(s: string) {
  if (s === 'ACTIVE') return 'Ativo'
  if (s === 'PAUSED' || s === 'CAMPAIGN_PAUSED' || s === 'ADSET_PAUSED') return 'Pausado'
  if (s === 'ARCHIVED') return 'Arquivado'
  if (s === 'WITH_ISSUES') return 'Com erros'
  return 'Pausado'
}

// ─── Ad row ──────────────────────────────────────────────────────────────────
interface AdRowProps {
  ad: {
    id: string; name: string; effective_status: string
    creative?: { thumbnail_url?: string }
    insights: AdInsightsFull | null
  }
  resultLabel: string
}

function AdRow({ ad, resultLabel }: AdRowProps) {
  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-dashed border-gray-200 last:border-0 bg-white">
      {/* Thumbnail */}
      <div className="w-12 h-12 rounded-lg bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200">
        {ad.creative?.thumbnail_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.creative.thumbnail_url} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Zap className="w-4 h-4 text-gray-300" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0',
            ad.effective_status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-300'
          )} />
          <p className="text-xs font-semibold text-gray-800 truncate" title={ad.name}>{ad.name}</p>
          <span className="text-[10px] text-gray-400 flex-shrink-0">
            {statusLabel(ad.effective_status)}
          </span>
          {(() => { const s = getAdScore(ad.insights); return s !== null ? <ScoreBadge score={s} /> : null })()}
        </div>
        {ad.insights ? (
          <InsightPills ins={ad.insights} resultLabel={resultLabel} level="ad" />
        ) : (
          <span className="text-[10px] text-gray-400">Sem dados no período</span>
        )}
      </div>
    </div>
  )
}

// ─── AdSet row (expandable, lazy-loads ads) ───────────────────────────────────
interface AdSetRowProps {
  adset: { id: string; name: string; effective_status: string; insights: AdInsightsFull | null }
  resultLabel: string
  period: string
  since: string
  until: string
}

function AdSetRow({ adset, resultLabel, period, since, until }: AdSetRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [ads, setAds] = useState<AdRowProps['ad'][] | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const expandedRef = useRef(false)
  expandedRef.current = expanded

  const fetchAds = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      let url = `/api/meta/adset/${adset.id}?period=${period}`
      if (since && until) url += `&since=${since}&until=${until}`
      const r = await fetch(url)
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setAds(d.ads || [])
    } catch {
      setAds([])
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [adset.id, period, since, until])

  useEffect(() => {
    setAds(null)
    setLoadError(false)
    if (expandedRef.current) fetchAds()
  }, [fetchAds])

  const toggle = () => {
    setExpanded(v => {
      if (!v) fetchAds()
      return !v
    })
  }

  return (
    <div className="border-b border-gray-100 last:border-0">
      {/* AdSet header */}
      <button
        onClick={toggle}
        className="w-full flex items-start gap-2 px-4 py-3 hover:bg-indigo-50/40 transition-colors text-left"
      >
        <div className="flex-shrink-0 mt-0.5">
          {expanded
            ? <ChevronDown className="w-4 h-4 text-indigo-400" />
            : <ChevronRight className="w-4 h-4 text-gray-300" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0',
              adset.effective_status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-300'
            )} />
            <p className="text-xs font-semibold text-indigo-700 truncate" title={adset.name}>
              {adset.name}
            </p>
            {adset.effective_status !== 'ACTIVE' && (
              <span className="text-[10px] text-gray-400 flex-shrink-0">
                {statusLabel(adset.effective_status)}
              </span>
            )}
          </div>
          {adset.insights
            ? <InsightPills ins={adset.insights} resultLabel={resultLabel} level="adset" />
            : <span className="text-[10px] text-gray-400">Sem dados no período</span>
          }
        </div>
      </button>

      {/* Ads list */}
      {expanded && (
        <div className="ml-10 border-l-2 border-indigo-100 bg-gray-50/30">
          {loading ? (
            <div className="flex items-center gap-2 px-4 py-3 text-xs text-gray-400">
              <RefreshCw className="w-3 h-3 animate-spin" />Carregando anúncios...
            </div>
          ) : loadError ? (
            <div className="flex items-center gap-2 px-4 py-3 text-xs text-red-500">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              <span>Erro ao carregar anúncios.</span>
              <button onClick={fetchAds} className="underline hover:text-red-700">Tentar novamente</button>
            </div>
          ) : !ads || ads.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-400">Nenhum anúncio ativo</p>
          ) : (
            <div>
              <div className="px-4 py-1.5 flex items-center gap-2 border-b border-gray-100">
                <Zap className="w-3 h-3 text-gray-400" />
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  {ads.length} anúncio{ads.length !== 1 ? 's' : ''}
                </span>
              </div>
              {ads.map(ad => <AdRow key={ad.id} ad={ad} resultLabel={resultLabel} />)}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Campaign card (expandable) ───────────────────────────────────────────────
interface CampaignCardProps {
  campaign: CampaignItem
  resultLabel: string
  period: string
  since: string
  until: string
}

const OBJ_LABELS: Record<string, string> = {
  OUTCOME_LEADS: 'Leads', OUTCOME_SALES: 'Vendas',
  OUTCOME_ENGAGEMENT: 'Engajamento', OUTCOME_TRAFFIC: 'Tráfego',
  OUTCOME_AWARENESS: 'Reconhecimento', LEAD_GENERATION: 'Leads',
  CONVERSIONS: 'Conversões', MESSAGES: 'Mensagens',
}

function CampaignCard({ campaign: c, resultLabel, period, since, until }: CampaignCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [adsets, setAdsets] = useState<CampaignItem['adsets'] | null>(null)
  const [loadingAdsets, setLoadingAdsets] = useState(false)
  const expandedRef = useRef(false)
  expandedRef.current = expanded

  const objective = OBJ_LABELS[c.objective] || c.objective
  const totalSpend = c.insights?.spend || 0
  const totalResults = c.insights?.results || 0

  const fetchAdsets = useCallback(async () => {
    setLoadingAdsets(true)
    try {
      let url = `/api/meta/campaign/${c.id}?period=${period}`
      if (since && until) url += `&since=${since}&until=${until}`
      const r = await fetch(url)
      const d = await r.json()
      const sorted = (d.adsets || []).sort(
        (a: CampaignItem['adsets'][0], b: CampaignItem['adsets'][0]) =>
          (b.insights?.spend || 0) - (a.insights?.spend || 0)
      )
      setAdsets(sorted)
    } catch {
      setAdsets([])
    } finally {
      setLoadingAdsets(false)
    }
  }, [c.id, period, since, until])

  useEffect(() => {
    setAdsets(null)
    if (expandedRef.current) fetchAdsets()
  }, [fetchAdsets])

  const toggle = () => {
    setExpanded(v => {
      if (!v) fetchAdsets()
      return !v
    })
  }

  const displayedAdsets = adsets ?? []

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Campaign header */}
      <button
        onClick={toggle}
        className="w-full flex items-start gap-3 p-4 hover:bg-blue-50/30 transition-colors text-left"
      >
        {/* Expand icon */}
        <div className="flex-shrink-0 mt-1">
          {expanded
            ? <ChevronDown className="w-5 h-5 text-blue-500" />
            : <ChevronRight className="w-5 h-5 text-gray-400" />}
        </div>

        {/* Campaign info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={cn('w-2 h-2 rounded-full flex-shrink-0',
              c.effective_status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'
            )} />
            <h3 className="font-bold text-gray-900 text-sm truncate" title={c.name}>{c.name}</h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
              {objective}
            </span>
            {c.effective_status !== 'ACTIVE' && (
              <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                {statusLabel(c.effective_status)}
              </span>
            )}
            {adsets !== null && (
              <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
                {displayedAdsets.length} conjunto{displayedAdsets.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {c.insights
            ? <InsightPills ins={c.insights} resultLabel={resultLabel} level="campaign" />
            : <span className="text-xs text-gray-400">Sem dados no período selecionado</span>
          }
        </div>

        {/* Quick summary badges */}
        <div className="flex-shrink-0 text-right hidden sm:block">
          <p className="text-lg font-bold text-gray-900">{formatCurrency(totalSpend)}</p>
          {totalResults > 0 && (
            <p className="text-xs text-green-600 font-semibold">{totalResults} {resultLabel.toLowerCase()}</p>
          )}
        </div>
      </button>

      {/* AdSets */}
      {expanded && (
        <div className="border-t border-gray-100">
          <div className="flex items-center gap-2 px-5 py-2 bg-gray-50 border-b border-gray-100">
            <Target className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">
              Conjuntos de anúncio
            </span>
            <span className="text-[10px] text-gray-400 ml-1">— clique para ver anúncios</span>
          </div>

          {loadingAdsets ? (
            <div className="flex items-center gap-2 px-5 py-4 text-xs text-gray-400">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Carregando conjuntos...
            </div>
          ) : displayedAdsets.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">Nenhum conjunto encontrado</p>
          ) : (
            displayedAdsets.map(s => (
              <AdSetRow
                key={s.id}
                adset={s}
                resultLabel={resultLabel}
                period={period}
                since={since}
                until={until}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────
interface CampaignTreeProps {
  campaigns: CampaignItem[]
  resultLabel: string
  period: string
  since: string
  until: string
  loading?: boolean
}

export function CampaignTree({ campaigns, resultLabel, period, since, until, loading }: CampaignTreeProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-5 h-5 bg-gray-200 rounded" />
              <div className="h-4 bg-gray-200 rounded w-48" />
              <div className="h-4 bg-blue-100 rounded w-20" />
            </div>
            <div className="flex gap-2 flex-wrap">
              {[1,2,3,4,5].map(j => <div key={j} className="h-10 bg-gray-100 rounded-lg w-16" />)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (campaigns.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-base font-medium">Nenhuma campanha com gasto no período</p>
        <p className="text-sm mt-1">Nenhuma campanha ativa ou com investimento no período selecionado</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {campaigns.map(c => (
        <CampaignCard
          key={c.id}
          campaign={c}
          resultLabel={resultLabel}
          period={period}
          since={since}
          until={until}
        />
      ))}
    </div>
  )
}
