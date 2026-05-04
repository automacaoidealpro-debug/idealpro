'use client'

import { use, useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import {
  ArrowLeft, RefreshCw, Calendar, ChevronDown, ChevronRight, Printer,
  TrendingUp, DollarSign, BarChart2, Target, Loader2,
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

const OBJ_LABELS: Record<string, string> = {
  OUTCOME_LEADS: 'Leads', OUTCOME_SALES: 'Vendas',
  OUTCOME_ENGAGEMENT: 'Engajamento', OUTCOME_TRAFFIC: 'Tráfego',
  OUTCOME_AWARENESS: 'Reconhecimento', LEAD_GENERATION: 'Leads',
  CONVERSIONS: 'Conversões', MESSAGES: 'Mensagens',
}

function today() { return new Date().toISOString().split('T')[0] }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

function fmtC(n: number) {
  if (!n) return '—'
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function ctrColor(v: number) { return v >= 2 ? 'text-green-600' : v >= 1 ? 'text-yellow-600' : v > 0 ? 'text-red-500' : 'text-gray-300' }
function cprColor(v: number) { return v <= 0 ? 'text-gray-300' : v < 30 ? 'text-green-600' : v < 100 ? 'text-yellow-600' : 'text-red-500' }

interface Insights {
  spend: number; impressions: number; clicks: number; reach: number
  ctr: number; cpp: number; linkClicks: number; results: number; costPerResult: number
}

interface Adset {
  id: string; name: string; effective_status: string
  insights: Insights | null
}

interface Campaign {
  id: string; name: string; objective: string; effective_status: string
  insights: Insights | null
}

interface CampaignRowProps {
  campaign: Campaign
  index: number
  period: string
  since: string
  until: string
}

function CampaignRow({ campaign: c, index, period, since, until }: CampaignRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [adsets, setAdsets] = useState<Adset[] | null>(null)
  const [loadingAdsets, setLoadingAdsets] = useState(false)
  const expandedRef = useRef(false)
  expandedRef.current = expanded

  const fetchAdsets = useCallback(async () => {
    setLoadingAdsets(true)
    try {
      let url = `/api/meta/campaign/${c.id}?period=${period}`
      if (since && until) url += `&since=${since}&until=${until}`
      const r = await fetch(url)
      const d = await r.json()
      setAdsets((d.adsets || []).sort((a: Adset, b: Adset) => (b.insights?.spend || 0) - (a.insights?.spend || 0)))
    } catch { setAdsets([]) }
    finally { setLoadingAdsets(false) }
  }, [c.id, period, since, until])

  useEffect(() => {
    setAdsets(null)
    if (expandedRef.current) fetchAdsets()
  }, [fetchAdsets])

  const handleExpand = () => {
    const next = !expanded
    setExpanded(next)
    if (next && adsets === null) fetchAdsets()
  }

  const ins = c.insights
  const spend = ins?.spend || 0
  const results = ins?.results || 0
  const cpr = ins?.costPerResult || (results > 0 && spend > 0 ? spend / results : 0)

  return (
    <>
      <tr
        className={cn('border-b border-gray-100 hover:bg-blue-50/30 cursor-pointer transition-colors', index % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')}
        onClick={handleExpand}
      >
        <td className="px-4 py-3 text-xs text-gray-400 print:hidden w-8">
          {expanded
            ? <ChevronDown className="w-3.5 h-3.5 text-blue-400" />
            : <ChevronRight className="w-3.5 h-3.5 text-gray-300" />}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', c.effective_status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-300')} />
            <span className="font-semibold text-gray-900 text-sm">{c.name}</span>
          </div>
          <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded ml-3">
            {OBJ_LABELS[c.objective] || c.objective}
          </span>
        </td>
        <td className="px-4 py-3 text-right font-semibold text-gray-900 text-sm">{fmtC(spend)}</td>
        <td className="px-4 py-3 text-right text-xs text-gray-500">{ins?.impressions ? formatNumber(ins.impressions) : '—'}</td>
        <td className="px-4 py-3 text-right text-xs">
          <span className={ins?.ctr && ins.ctr > 0 ? ctrColor(ins.ctr) : 'text-gray-300'}>
            {ins?.ctr && ins.ctr > 0 ? `${ins.ctr.toFixed(2)}%` : '—'}
          </span>
        </td>
        <td className="px-4 py-3 text-right text-xs text-gray-500">{ins?.linkClicks ? formatNumber(ins.linkClicks) : '—'}</td>
        <td className="px-4 py-3 text-right text-xs">
          {results > 0
            ? <span className="font-bold text-green-700">{formatNumber(results)}</span>
            : <span className="text-gray-300">—</span>}
        </td>
        <td className="px-4 py-3 text-right text-xs">
          <span className={cpr > 0 ? cprColor(cpr) : 'text-gray-300'}>{cpr > 0 ? fmtC(cpr) : '—'}</span>
        </td>
        <td className="px-4 py-3 text-right text-xs text-gray-400 print:hidden">
          {loadingAdsets ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : (adsets?.length ?? '—')}
        </td>
      </tr>

      {/* Adset rows */}
      {expanded && (
        loadingAdsets ? (
          <tr className="border-b border-dashed border-gray-100 bg-indigo-50/20">
            <td colSpan={9} className="px-8 py-3 text-xs text-gray-400 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando conjuntos...
            </td>
          </tr>
        ) : (adsets || []).map(s => {
          const si = s.insights
          const sSpend = si?.spend || 0
          const sResults = si?.results || 0
          const sCpr = si?.costPerResult || (sResults > 0 && sSpend > 0 ? sSpend / sResults : 0)
          return (
            <tr key={s.id} className="border-b border-dashed border-gray-100 bg-indigo-50/30 print:hidden">
              <td className="px-4 py-2" />
              <td className="px-4 py-2 pl-8">
                <div className="flex items-center gap-2">
                  <Target className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                  <span className="text-xs text-indigo-700 font-medium">{s.name}</span>
                  <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0',
                    s.effective_status === 'ACTIVE' ? 'bg-green-400' : 'bg-gray-300')} />
                </div>
              </td>
              <td className="px-4 py-2 text-right text-xs text-gray-600">{fmtC(sSpend)}</td>
              <td className="px-4 py-2 text-right text-xs text-gray-400">{si?.impressions ? formatNumber(si.impressions) : '—'}</td>
              <td className="px-4 py-2 text-right text-xs">
                <span className={si?.ctr && si.ctr > 0 ? ctrColor(si.ctr) : 'text-gray-300'}>
                  {si?.ctr && si.ctr > 0 ? `${si.ctr.toFixed(2)}%` : '—'}
                </span>
              </td>
              <td className="px-4 py-2 text-right text-xs text-gray-400">{si?.linkClicks ? formatNumber(si.linkClicks) : '—'}</td>
              <td className="px-4 py-2 text-right text-xs">
                {sResults > 0 ? <span className="text-green-600 font-semibold">{formatNumber(sResults)}</span> : <span className="text-gray-300">—</span>}
              </td>
              <td className="px-4 py-2 text-right text-xs">
                <span className={sCpr > 0 ? cprColor(sCpr) : 'text-gray-300'}>{sCpr > 0 ? fmtC(sCpr) : '—'}</span>
              </td>
              <td className="px-4 py-2" />
            </tr>
          )
        })
      )}
    </>
  )
}

export default function CampaignReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [accountName, setAccountName] = useState('')
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null)

  const [period, setPeriod] = useState('this_month')
  const [activeLabel, setActiveLabel] = useState('Este mês')
  const [showCustom, setShowCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState(daysAgo(30))
  const [customTo, setCustomTo] = useState(today())
  const [activeSince, setActiveSince] = useState('')
  const [activeUntil, setActiveUntil] = useState('')

  const fetchCampaigns = useCallback(async (p: string, s?: string, u?: string) => {
    setLoading(true)
    setError(null)
    try {
      let url = `/api/meta/account/${id}/active-campaigns?period=${p}`
      if (s && u) url += `&since=${s}&until=${u}`
      const r = await fetch(url)
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setCampaigns(d.campaigns || [])
      if (d.name) setAccountName(d.name)
      setGeneratedAt(new Date())
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchCampaigns('this_month') }, [fetchCampaigns])

  const changePeriod = (p: string, label: string) => {
    setPeriod(p); setActiveLabel(label)
    setActiveSince(''); setActiveUntil(''); setShowCustom(false)
    fetchCampaigns(p)
  }

  const applyCustom = () => {
    if (!customFrom || !customTo) return
    setActiveSince(customFrom); setActiveUntil(customTo)
    setActiveLabel(`${customFrom} → ${customTo}`)
    setShowCustom(false)
    fetchCampaigns(period, customFrom, customTo)
  }

  const totSpend = campaigns.reduce((s, c) => s + (c.insights?.spend || 0), 0)
  const totImpressions = campaigns.reduce((s, c) => s + (c.insights?.impressions || 0), 0)
  const totResults = campaigns.reduce((s, c) => s + (c.insights?.results || 0), 0)
  const totClicks = campaigns.reduce((s, c) => s + (c.insights?.linkClicks || 0), 0)
  const avgCtr = totImpressions > 0 ? (totClicks / totImpressions) * 100 : 0
  const avgCpr = totResults > 0 ? totSpend / totResults : 0

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-gray-900 to-blue-900 text-white px-6 py-5 print:hidden">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <p className="text-xs text-white/50 uppercase tracking-wider">Relatório por campanha</p>
              <h1 className="text-lg font-bold">{accountName || id}</h1>
              {generatedAt && (
                <p className="text-xs text-white/40">
                  Gerado às {generatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-xs font-medium transition-colors">
              <Printer className="w-3.5 h-3.5" /> Imprimir
            </button>
            <button
              onClick={() => fetchCampaigns(period, activeSince || undefined, activeUntil || undefined)}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
              Atualizar
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-5 space-y-4">

        {/* Period selector */}
        <div className="bg-white border border-gray-200 rounded-xl p-3 print:hidden">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            {PERIODS.map(p => (
              <button key={p.value}
                onClick={() => changePeriod(p.value, p.label)}
                disabled={loading}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  activeLabel === p.label && !showCustom
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40'
                )}
              >{p.label}</button>
            ))}
            <button onClick={() => setShowCustom(!showCustom)}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                showCustom || activeLabel.includes('→')
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              )}>
              <Calendar className="w-3 h-3" />
              {activeLabel.includes('→') ? activeLabel : 'Personalizado'}
              <ChevronDown className={cn('w-3 h-3 transition-transform', showCustom && 'rotate-180')} />
            </button>
            {loading && <span className="text-xs text-gray-400 animate-pulse ml-1">carregando...</span>}
          </div>
          {showCustom && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-end gap-3 flex-wrap">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Data inicial</label>
                <input type="date" value={customFrom} max={customTo}
                  onChange={e => setCustomFrom(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Data final</label>
                <input type="date" value={customTo} min={customFrom} max={today()}
                  onChange={e => setCustomTo(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button onClick={applyCustom} disabled={!customFrom || !customTo}
                className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40">
                Aplicar
              </button>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">{error}</div>
        )}

        {/* Summary cards */}
        {!loading && campaigns.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { icon: DollarSign, label: 'Investido',     value: fmtC(totSpend),                                   color: 'text-gray-900' },
              { icon: BarChart2,  label: 'Impressões',    value: formatNumber(totImpressions),                      color: 'text-blue-700' },
              { icon: BarChart2,  label: 'CTR médio',     value: avgCtr > 0 ? `${avgCtr.toFixed(2)}%` : '—',       color: avgCtr >= 2 ? 'text-green-600' : avgCtr >= 1 ? 'text-yellow-600' : 'text-red-500' },
              { icon: TrendingUp, label: 'Resultados',    value: totResults > 0 ? formatNumber(totResults) : '—',  color: 'text-green-700' },
              { icon: Target,     label: 'Custo/result.', value: avgCpr > 0 ? fmtC(avgCpr) : '—',                  color: avgCpr > 0 ? cprColor(avgCpr) : 'text-gray-400' },
            ].map(({ icon: Icon, label, value, color }) => (
              <div key={label} className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
                <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div>
                  <p className="text-[10px] text-gray-400">{label}</p>
                  <p className={cn('text-sm font-bold', color)}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Print header */}
        <div className="hidden print:block mb-4">
          <h1 className="text-2xl font-bold">Relatório por Campanha — {accountName}</h1>
          <p className="text-gray-500 text-sm">Período: {activeLabel} · Gerado em {generatedAt?.toLocaleString('pt-BR')}</p>
          <div className="mt-2 flex gap-6 text-sm">
            <span>Investido: <strong>{fmtC(totSpend)}</strong></span>
            <span>Impressões: <strong>{formatNumber(totImpressions)}</strong></span>
            <span>Resultados: <strong>{totResults}</strong></span>
            <span>Custo/result.: <strong>{avgCpr > 0 ? fmtC(avgCpr) : '—'}</strong></span>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <RefreshCw className="w-6 h-6 text-gray-400 animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Carregando campanhas...</p>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center text-gray-400">
            <TrendingUp className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Nenhuma campanha ativa no período</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <h2 className="font-bold text-gray-900">Campanhas — {activeLabel}</h2>
              </div>
              <span className="text-xs text-gray-400">
                {campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''} · clique para ver conjuntos
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-500">
                    <th className="px-4 py-3 w-8 print:hidden" />
                    <th className="px-4 py-3 text-left">Campanha</th>
                    <th className="px-4 py-3 text-right">Gasto</th>
                    <th className="px-4 py-3 text-right">Impressões</th>
                    <th className="px-4 py-3 text-right">CTR</th>
                    <th className="px-4 py-3 text-right">Cliques link</th>
                    <th className="px-4 py-3 text-right">Resultados</th>
                    <th className="px-4 py-3 text-right">Custo/result.</th>
                    <th className="px-4 py-3 text-right print:hidden">Conj.</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c, i) => (
                    <CampaignRow
                      key={c.id}
                      campaign={c}
                      index={i}
                      period={period}
                      since={activeSince}
                      until={activeUntil}
                    />
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold text-xs">
                    <td className="px-4 py-3 print:hidden" />
                    <td className="px-4 py-3 text-gray-700">TOTAL ({campaigns.length} campanhas)</td>
                    <td className="px-4 py-3 text-right text-gray-900">{fmtC(totSpend)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{formatNumber(totImpressions)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={avgCtr > 0 ? ctrColor(avgCtr) : 'text-gray-300'}>
                        {avgCtr > 0 ? `${avgCtr.toFixed(2)}%` : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">{totClicks > 0 ? formatNumber(totClicks) : '—'}</td>
                    <td className="px-4 py-3 text-right text-green-700">{totResults > 0 ? formatNumber(totResults) : '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={avgCpr > 0 ? cprColor(avgCpr) : 'text-gray-300'}>{avgCpr > 0 ? fmtC(avgCpr) : '—'}</span>
                    </td>
                    <td className="px-4 py-3 print:hidden" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
