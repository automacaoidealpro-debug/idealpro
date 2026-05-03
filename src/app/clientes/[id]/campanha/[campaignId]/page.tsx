'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { MetricCard } from '@/components/MetricCard'
import { AdMetricsRow, AdInsights } from '@/components/AdMetricsRow'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import {
  ArrowLeft, RefreshCw, Calendar, ChevronDown, ChevronRight,
  Layers, Zap,
} from 'lucide-react'

const PERIODS = [
  { value: 'today',      label: 'Hoje' },
  { value: 'yesterday',  label: 'Ontem' },
  { value: 'last_7d',    label: '7 dias' },
  { value: 'last_14d',   label: '14 dias' },
  { value: 'last_28d',   label: '28 dias' },
  { value: 'this_month', label: 'Este mês' },
  { value: 'last_month', label: 'Mês passado' },
]

interface AdSet {
  id: string
  name: string
  status: string
  effective_status: string
  insights: AdInsights | null
}

interface Ad {
  id: string
  name: string
  status: string
  effective_status: string
  creative?: { name?: string; thumbnail_url?: string }
  insights: AdInsights | null
}

interface CampaignDetail {
  campaign: {
    id: string; name: string; status: string; effective_status: string
    objective: string; daily_budget?: string; lifetime_budget?: string
  }
  insights: AdInsights | null
  adsets: AdSet[]
  period: string
}

function today() { return new Date().toISOString().split('T')[0] }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function detectResultLabel(adsets: AdSet[]) {
  for (const s of adsets) {
    const ins = s.insights
    if (!ins) continue
    if (ins.results > 0) {
      // Heuristic: if has add_to_cart it's ecommerce → purchases
      return ins.addToCart > 0 ? 'Compras' : 'Leads / Conversas'
    }
  }
  return 'Resultados'
}

// Expandable adset row with lazy-loaded ads
function AdSetRow({
  adset,
  period,
  since,
  until,
  resultLabel,
}: {
  adset: AdSet
  period: string
  since: string
  until: string
  resultLabel: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [ads, setAds] = useState<Ad[] | null>(null)
  const [loadingAds, setLoadingAds] = useState(false)

  const loadAds = useCallback(async () => {
    if (ads) return // already loaded
    setLoadingAds(true)
    try {
      let url = `/api/meta/adset/${adset.id}?period=${period}`
      if (since && until) url += `&since=${since}&until=${until}`
      const res = await fetch(url)
      const data = await res.json()
      setAds(data.ads || [])
    } catch {
      setAds([])
    } finally {
      setLoadingAds(false)
    }
  }, [adset.id, period, since, until, ads])

  const toggle = () => {
    setExpanded((v) => {
      if (!v) loadAds()
      return !v
    })
  }

  return (
    <div className="border-b border-gray-100 last:border-0">
      {/* Adset header row */}
      <div className="flex items-start">
        <button
          onClick={toggle}
          className="flex-shrink-0 p-3 text-gray-400 hover:text-blue-600"
        >
          {expanded
            ? <ChevronDown className="w-4 h-4" />
            : <ChevronRight className="w-4 h-4" />}
        </button>
        <div className="flex-1">
          <AdMetricsRow
            name={adset.name}
            status={adset.effective_status}
            insights={adset.insights}
            resultLabel={resultLabel}
          />
        </div>
      </div>

      {/* Ads expanded */}
      {expanded && (
        <div className="border-t border-blue-100 bg-blue-50/20 ml-10">
          {loadingAds ? (
            <div className="flex items-center gap-2 px-4 py-3 text-xs text-gray-400">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Carregando anúncios...
            </div>
          ) : ads && ads.length === 0 ? (
            <p className="px-4 py-3 text-xs text-gray-400">Nenhum anúncio encontrado</p>
          ) : (
            <div>
              {/* Ads header */}
              <div className="px-4 py-1.5 border-b border-blue-100 flex items-center gap-2">
                <Zap className="w-3 h-3 text-blue-400" />
                <span className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide">
                  Anúncios ({ads?.length})
                </span>
              </div>
              {ads?.map((ad) => (
                <AdMetricsRow
                  key={ad.id}
                  name={ad.name}
                  status={ad.effective_status}
                  insights={ad.insights}
                  resultLabel={resultLabel}
                  isAd
                  thumbnailUrl={ad.creative?.thumbnail_url}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string; campaignId: string }>
}) {
  const { id: accountId, campaignId } = use(params)
  const router = useRouter()
  const [data, setData] = useState<CampaignDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState('this_month')
  const [since, setSince] = useState(daysAgo(30))
  const [until, setUntil] = useState(today())
  const [showCustom, setShowCustom] = useState(false)
  const [activeLabel, setActiveLabel] = useState('Este mês')
  const [customSince, setCustomSince] = useState(daysAgo(30))
  const [customUntil, setCustomUntil] = useState(today())
  const [activeSince, setActiveSince] = useState('')
  const [activeUntil, setActiveUntil] = useState('')

  const fetchData = useCallback(async (p: string, s?: string, u?: string) => {
    setLoading(true)
    setError(null)
    try {
      let url = `/api/meta/campaign/${campaignId}?period=${p}`
      if (s && u) url += `&since=${s}&until=${u}`
      const res = await fetch(url)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [campaignId])

  useEffect(() => { fetchData(period) }, [fetchData, period])

  const changePeriod = (p: string, label: string) => {
    setPeriod(p)
    setActiveLabel(label)
    setActiveSince('')
    setActiveUntil('')
    setShowCustom(false)
    fetchData(p)
  }

  const applyCustom = () => {
    if (!customSince || !customUntil) return
    setSince(customSince)
    setUntil(customUntil)
    setActiveSince(customSince)
    setActiveUntil(customUntil)
    setActiveLabel(`${customSince} → ${customUntil}`)
    setShowCustom(false)
    fetchData(period, customSince, customUntil)
  }

  const ins = data?.insights
  const resultLabel = data ? detectResultLabel(data.adsets) : 'Resultados'

  return (
    <div className="max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/clientes/${accountId}`)}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <p className="text-xs text-gray-400">Campanha</p>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">
              {data?.campaign.name || 'Carregando...'}
            </h1>
            {data?.campaign.objective && (
              <p className="text-xs text-gray-400 mt-0.5">{data.campaign.objective}</p>
            )}
          </div>
        </div>
        <button
          onClick={() => fetchData(period, activeSince || undefined, activeUntil || undefined)}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Atualizar
        </button>
      </div>

      {/* Period selector */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => changePeriod(p.value, p.label)}
              disabled={loading}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                activeLabel === p.label && !showCustom
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40'
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => setShowCustom(!showCustom)}
            disabled={loading}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              showCustom || activeLabel.includes('→')
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
            )}
          >
            <Calendar className="w-3 h-3" />
            {activeLabel.includes('→') ? activeLabel : 'Personalizado'}
            <ChevronDown className={cn('w-3 h-3 transition-transform', showCustom && 'rotate-180')} />
          </button>
          {loading && <span className="text-xs text-gray-400 animate-pulse">carregando...</span>}
        </div>
        {showCustom && (
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-end gap-3 flex-wrap">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Data inicial</label>
              <input type="date" value={customSince} max={customUntil}
                onChange={(e) => setCustomSince(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Data final</label>
              <input type="date" value={customUntil} min={customSince} max={today()}
                onChange={(e) => setCustomUntil(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button onClick={applyCustom} disabled={!customSince || !customUntil}
              className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40"
            >
              Aplicar
            </button>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-5">{error}</div>
      )}

      {/* Campaign-level summary */}
      {ins && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
          <MetricCard label="Gasto" value={formatCurrency(ins.spend)} color="indigo" />
          <MetricCard label="Impressões" value={formatNumber(ins.impressions)} color="gray" />
          <MetricCard label="CTR" value={ins.ctr > 0 ? `${ins.ctr.toFixed(2)}%` : '—'}
            color={ins.ctr >= 2 ? 'green' : ins.ctr >= 1 ? 'orange' : 'red'} />
          <MetricCard
            label="Hook Rate"
            value={ins.hookRate > 0 ? `${ins.hookRate.toFixed(1)}%` : '—'}
            color={ins.hookRate >= 30 ? 'green' : ins.hookRate >= 15 ? 'orange' : ins.hookRate > 0 ? 'red' : 'gray'}
          />
          <MetricCard label="Clique link" value={ins.linkClicks > 0 ? formatNumber(ins.linkClicks) : '—'} color="gray" />
          <MetricCard label="Saída site" value={ins.outboundClicks > 0 ? formatNumber(ins.outboundClicks) : '—'} color="gray" />
          <MetricCard label={resultLabel} value={ins.results > 0 ? formatNumber(ins.results) : '—'} color="green" />
          <MetricCard
            label="Custo/result."
            value={ins.costPerResult > 0 ? formatCurrency(ins.costPerResult) : '—'}
            color={ins.costPerResult > 0 ? (ins.costPerResult < 30 ? 'green' : ins.costPerResult < 100 ? 'orange' : 'red') : 'gray'}
          />
        </div>
      )}

      {/* Hook rate legend */}
      <div className="flex items-center gap-4 mb-4 text-xs text-gray-400">
        <span className="text-green-600 font-medium">● Hook ≥30% excelente</span>
        <span className="text-yellow-600 font-medium">● 15–30% bom</span>
        <span className="text-red-500 font-medium">● &lt;15% criativo fraco</span>
        <span className="ml-auto text-gray-300">Hook Rate = play 3s ÷ impressões</span>
      </div>

      {/* Ad Sets */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-4 h-4 text-gray-400" />
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Conjuntos de anúncio ({data?.adsets.length ?? '—'})
          </h2>
          <span className="text-xs text-gray-400">— clique para ver os anúncios</span>
        </div>

        {/* Metrics header legend */}
        <div className="hidden lg:flex items-center gap-1 px-4 py-2 mb-1 text-[10px] text-gray-400 font-medium">
          <div className="flex-1">Conjunto</div>
          <div className="flex items-center gap-1 flex-wrap justify-end mr-2">
            <span className="min-w-[70px] text-center">Gasto</span>
            <span className="w-px" />
            <span className="min-w-[70px] text-center">Impressões</span>
            <span className="min-w-[70px] text-center">CTR</span>
            <span className="min-w-[70px] text-center">Hook Rate</span>
            <span className="w-px" />
            <span className="min-w-[70px] text-center">Clique link</span>
            <span className="min-w-[70px] text-center">Saída site</span>
            <span className="w-px" />
            <span className="min-w-[70px] text-center">{resultLabel}</span>
            <span className="min-w-[70px] text-center">Custo/result.</span>
            <span className="min-w-[70px] text-center">CPP</span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {!data ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              {loading ? 'Carregando...' : 'Sem dados'}
            </div>
          ) : data.adsets.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">Nenhum conjunto encontrado</div>
          ) : (
            data.adsets.map((adset) => (
              <AdSetRow
                key={adset.id}
                adset={adset}
                period={period}
                since={activeSince}
                until={activeUntil}
                resultLabel={resultLabel}
              />
            ))
          )}
        </div>
      </div>

      <p className="text-xs text-gray-400 mt-4">
        * Visita ao perfil do Instagram pode estar indisponível dependendo das permissões da conta.
        Hook Rate acima de 30% indica criativo com boa retenção inicial.
      </p>
    </div>
  )
}
