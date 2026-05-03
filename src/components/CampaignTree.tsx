'use client'

import { useState, useCallback } from 'react'
import { cn, formatCurrency, formatNumber } from '@/lib/utils'
import { AdInsightsFull, CampaignItem } from '@/lib/optimizations'
import { ChevronRight, ChevronDown, RefreshCw, Zap, Target, TrendingUp } from 'lucide-react'

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
  }
  return (
    <span className={cn('inline-flex flex-col items-center px-2.5 py-1 rounded-lg text-[10px] leading-tight min-w-[60px]', colors[color] || colors.gray)}>
      <span className="font-bold text-xs">{value}</span>
      <span className="opacity-70 mt-0.5">{label}</span>
    </span>
  )
}

function hookColor(v: number) { return v >= 30 ? 'green' : v >= 15 ? 'yellow' : v > 0 ? 'red' : 'gray' }
function ctrColor(v: number) { return v >= 2 ? 'green' : v >= 1 ? 'yellow' : v > 0 ? 'red' : 'gray' }
function cppColor(v: number) { return v <= 0 ? 'gray' : v < 30 ? 'green' : v < 80 ? 'yellow' : 'red' }
function cprColor(v: number) { return v <= 0 ? 'gray' : v < 30 ? 'green' : v < 100 ? 'yellow' : 'red' }

interface InsightPillsProps {
  ins: AdInsightsFull
  resultLabel: string
  level: 'campaign' | 'adset' | 'ad'
}

function InsightPills({ ins, resultLabel, level }: InsightPillsProps) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <Pill label="Gasto" value={formatCurrency(ins.spend)} />
      <Pill label="Impressões" value={formatNumber(ins.impressions)} />
      <Pill label="CTR" value={ins.ctr > 0 ? `${ins.ctr.toFixed(2)}%` : '—'} color={ctrColor(ins.ctr)} />
      {ins.hookRate > 0 && (
        <Pill label="Hook Rate" value={`${ins.hookRate.toFixed(1)}%`} color={hookColor(ins.hookRate)} />
      )}
      <Pill label="Clique link" value={ins.linkClicks > 0 ? formatNumber(ins.linkClicks) : '—'} color="blue" />
      {ins.addToCart > 0 && (
        <Pill label="Carrinho" value={formatNumber(ins.addToCart)} color="orange" />
      )}
      {ins.profileVisits > 0 && (
        <Pill label="Visita perfil" value={formatNumber(ins.profileVisits)} color="purple" />
      )}
      {ins.results > 0 && (
        <Pill label={resultLabel} value={formatNumber(ins.results)} color="green" />
      )}
      {ins.costPerResult > 0 && (
        <Pill label="Custo/result." value={formatCurrency(ins.costPerResult)} color={cprColor(ins.costPerResult)} />
      )}
      <Pill label="CPP" value={ins.cpp > 0 ? formatCurrency(ins.cpp) : '—'} color={cppColor(ins.cpp)} />
      {level !== 'ad' && ins.frequency > 0 && (
        <Pill label="Frequência" value={ins.frequency.toFixed(1)} color={ins.frequency > 3 ? 'red' : 'gray'} />
      )}
    </div>
  )
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
        <div className="flex items-center gap-2 mb-1.5">
          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0',
            ad.effective_status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-300'
          )} />
          <p className="text-xs font-semibold text-gray-800 truncate" title={ad.name}>{ad.name}</p>
          <span className="text-[10px] text-gray-400 flex-shrink-0">
            {ad.effective_status === 'ACTIVE' ? 'Ativo' : 'Pausado'}
          </span>
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

  const loadAds = useCallback(async () => {
    if (ads !== null) return
    setLoading(true)
    try {
      let url = `/api/meta/adset/${adset.id}?period=${period}`
      if (since && until) url += `&since=${since}&until=${until}`
      const r = await fetch(url)
      const d = await r.json()
      setAds(d.ads || [])
    } catch { setAds([]) }
    finally { setLoading(false) }
  }, [adset.id, period, since, until, ads])

  const toggle = () => {
    setExpanded(v => {
      if (!v) loadAds()
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
          ) : !ads || ads.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-400">Nenhum anúncio</p>
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
  const [expanded, setExpanded] = useState(true)
  const objective = OBJ_LABELS[c.objective] || c.objective

  const totalResults = c.adsets.reduce((s, a) => s + (a.insights?.results || 0), 0)
  const totalSpend = c.insights?.spend || 0

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
      {/* Campaign header */}
      <button
        onClick={() => setExpanded(v => !v)}
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
            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
            <h3 className="font-bold text-gray-900 text-sm truncate" title={c.name}>{c.name}</h3>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
              {objective}
            </span>
            <span className="text-xs text-gray-400 ml-auto flex-shrink-0">
              {c.adsets.length} conjunto{c.adsets.length !== 1 ? 's' : ''} ativos
            </span>
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
          {/* AdSets header */}
          <div className="flex items-center gap-2 px-5 py-2 bg-gray-50 border-b border-gray-100">
            <Target className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">
              Conjuntos de anúncio
            </span>
            <span className="text-[10px] text-gray-400 ml-1">— clique para ver anúncios</span>
          </div>

          {c.adsets.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-400">Nenhum conjunto ativo</p>
          ) : (
            c.adsets.map(s => (
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
        <p className="text-base font-medium">Nenhuma campanha ativa</p>
        <p className="text-sm mt-1">Esta conta não tem campanhas rodando no momento</p>
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
