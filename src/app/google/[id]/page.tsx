'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, TrendingUp, RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

const CHANNEL_LABELS: Record<string, string> = {
  SEARCH: '🔍 Search',
  DISPLAY: '🖼️ Display',
  SHOPPING: '🛒 Shopping',
  VIDEO: '▶️ Video (YouTube)',
  SMART: '🤖 Smart',
  PERFORMANCE_MAX: '⚡ Performance Max',
  APP: '📱 App',
  DISCOVERY: '💡 Discovery',
}

const DEVICE_LABELS: Record<string, string> = {
  MOBILE: '📱 Mobile',
  DESKTOP: '🖥️ Desktop',
  TABLET: '📲 Tablet',
  CONNECTED_TV: '📺 TV Conectada',
  UNKNOWN: '❓ Desconhecido',
}

const NETWORK_LABELS: Record<string, string> = {
  SEARCH: '🔍 Pesquisa Google',
  SEARCH_PARTNERS: '🤝 Parceiros de Pesquisa',
  CONTENT: '🖼️ Rede de Display',
  YOUTUBE_SEARCH: '▶️ YouTube Busca',
  YOUTUBE_WATCH: '▶️ YouTube Vídeo',
  MIXED: '🔀 Misto',
  UNKNOWN: '❓',
}

const STATUS_CFG: Record<string, { label: string; cls: string }> = {
  ENABLED: { label: 'Ativa', cls: 'bg-green-50 text-green-700 border-green-200' },
  PAUSED: { label: 'Pausada', cls: 'bg-yellow-50 text-yellow-600 border-yellow-200' },
  REMOVED: { label: 'Removida', cls: 'bg-red-50 text-red-500 border-red-200' },
}

interface Campaign {
  id: string; name: string; status: string; channelType: string; biddingStrategy: string
  dailyBudget: number; spend: number; impressions: number; clicks: number
  ctr: number; cpc: number; conversions: number; conversionValue: number
  costPerConversion: number; roas: number
}

interface AdGroup {
  id: string; name: string; status: string; campaignId: string; campaignName: string
  spend: number; impressions: number; clicks: number; ctr: number
  conversions: number; conversionValue: number; costPerConversion: number
}

interface DeviceRow { device: string; spend: number; impressions: number; clicks: number; ctr: number; conversions: number; conversionValue: number; costPerConversion: number }
interface DayRow { day: string; name: string; spend: number; impressions: number; clicks: number; ctr: number; conversions: number; costPerConversion: number }
interface HourRow { hour: number; label: string; spend: number; impressions: number; clicks: number; ctr: number; conversions: number }
interface NetworkRow { network: string; spend: number; impressions: number; clicks: number; ctr: number; conversions: number; costPerConversion: number }

interface Totals {
  spend: number; impressions: number; clicks: number; ctr: number; cpc: number
  conversions: number; conversionValue: number; costPerConversion: number; roas: number
}

interface AccountData {
  period: string; dateRange: { startDate: string; endDate: string }
  totals: Totals
  campaigns: Campaign[]
  adGroups: AdGroup[]
  byDevice: DeviceRow[]
  byDayOfWeek: DayRow[]
  byHour: HourRow[]
  byNetwork: NetworkRow[]
  error?: string
  hint?: string
  token_status?: string
}

export default function GoogleAccountPage() {
  const params = useParams()
  const id = params.id as string
  const [period, setPeriod] = useState('last_7d')
  const [data, setData] = useState<AccountData | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'campanhas'|'grupos'|'dispositivo'|'horario'|'dia'|'rede'>('campanhas')

  const load = useCallback(async () => {
    setLoading(true)
    setData(null)
    const res = await fetch(`/api/google/account/${id}/full?period=${period}`)
    const j = await res.json()
    setData(j)
    setLoading(false)
  }, [id, period])

  useEffect(() => { load() }, [load])

  const isTestMode = data?.token_status === 'TEST_ONLY'
  const t = data?.totals

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <Link href="/google" className="flex items-center gap-2 text-blue-300 hover:text-white text-sm mb-5 w-fit transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar ao Google Ads
          </Link>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
                <TrendingUp className="w-6 h-6 text-blue-300" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Conta {id}</h1>
                <p className="text-blue-300 text-sm mt-0.5">Google Ads</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <select
                value={period}
                onChange={e => setPeriod(e.target.value)}
                disabled={loading}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                <option value="last_7d">Últimos 7 dias</option>
                <option value="last_14d">Últimos 14 dias</option>
                <option value="last_28d">Últimos 28 dias</option>
                <option value="this_month">Este mês</option>
                <option value="last_month">Mês passado</option>
              </select>
              <button onClick={load} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-sm font-medium transition-all disabled:opacity-50">
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} /> Atualizar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
            <RefreshCw className="w-7 h-7 text-blue-400 animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Carregando dados do Google Ads...</p>
          </div>
        )}

        {/* Token error */}
        {data?.error && !loading && (
          <div className={cn('rounded-2xl p-5 border', isTestMode ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200')}>
            <div className="flex items-start gap-3">
              <AlertTriangle className={cn('w-5 h-5 flex-shrink-0 mt-0.5', isTestMode ? 'text-yellow-600' : 'text-red-500')} />
              <div>
                <p className={cn('font-semibold text-sm', isTestMode ? 'text-yellow-800' : 'text-red-800')}>
                  {isTestMode ? 'Developer Token em modo TEST' : 'Erro ao carregar dados'}
                </p>
                {data.hint && <p className={cn('text-sm mt-1', isTestMode ? 'text-yellow-700' : 'text-red-600')}>{data.hint}</p>}
                {!isTestMode && <p className="text-xs text-red-500 font-mono mt-1">{data.error}</p>}
                {isTestMode && (
                  <a href="https://ads.google.com/aw/apicenter" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 mt-2 text-sm text-yellow-700 hover:text-yellow-900 font-medium underline">
                    Solicitar Basic Access <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        {t && !loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            {[
              { label: 'Gasto', value: formatCurrency(t.spend), sub: `${data?.dateRange?.startDate} – ${data?.dateRange?.endDate}`, color: 'text-gray-900' },
              { label: 'Impressões', value: t.impressions.toLocaleString('pt-BR'), sub: `CTR ${t.ctr.toFixed(2)}%`, color: 'text-blue-700' },
              { label: 'Cliques', value: t.clicks.toLocaleString('pt-BR'), sub: `CPC ${formatCurrency(t.cpc)}`, color: 'text-blue-600' },
              { label: 'Conversões', value: t.conversions.toFixed(0), sub: t.conversions > 0 ? `${formatCurrency(t.costPerConversion)}/conv.` : 'sem conversões', color: t.conversions > 0 ? 'text-green-700' : 'text-gray-400' },
              { label: 'ROAS', value: t.roas > 0 ? `${t.roas.toFixed(2)}x` : '—', sub: t.conversionValue > 0 ? formatCurrency(t.conversionValue) + ' retorno' : 'sem valor', color: t.roas >= 2 ? 'text-green-700' : t.roas > 0 ? 'text-yellow-600' : 'text-gray-400' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">{kpi.label}</p>
                <p className={cn('text-xl font-black mt-1', kpi.color)}>{kpi.value}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{kpi.sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs + Tables */}
        {data && !data.error && !loading && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            {/* Tab bar */}
            <div className="flex overflow-x-auto border-b border-gray-100 bg-gray-50">
              {([
                { key: 'campanhas', label: `Campanhas (${data.campaigns.length})` },
                { key: 'grupos', label: `Grupos de Anúncios (${data.adGroups.length})` },
                { key: 'dispositivo', label: 'Por Dispositivo' },
                { key: 'rede', label: 'Por Rede' },
                { key: 'dia', label: 'Por Dia' },
                { key: 'horario', label: 'Por Hora' },
              ] as { key: typeof activeTab; label: string }[]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={cn(
                    'px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors border-b-2',
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-600 bg-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Campaigns */}
            {activeTab === 'campanhas' && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-3 font-semibold text-gray-400 uppercase text-[10px] tracking-wide">Campanha</th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-400 uppercase text-[10px]">Tipo</th>
                      <th className="text-center px-3 py-3 font-semibold text-gray-400 uppercase text-[10px]">Status</th>
                      <th className="text-right px-3 py-3 font-semibold text-gray-400 uppercase text-[10px]">Gasto</th>
                      <th className="text-right px-3 py-3 font-semibold text-gray-400 uppercase text-[10px]">Cliques</th>
                      <th className="text-right px-3 py-3 font-semibold text-gray-400 uppercase text-[10px]">CTR</th>
                      <th className="text-center px-3 py-3 font-semibold text-green-600 uppercase text-[10px]">Conversões</th>
                      <th className="text-right px-3 py-3 font-semibold text-gray-400 uppercase text-[10px]">Custo/Conv.</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-400 uppercase text-[10px]">ROAS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.campaigns.map((c, i) => {
                      const s = STATUS_CFG[c.status] || { label: c.status, cls: 'bg-gray-50 text-gray-400 border-gray-200' }
                      return (
                        <tr key={c.id} className={cn('hover:bg-gray-50/80', i === 0 && 'bg-blue-50/20')}>
                          <td className="px-4 py-3 font-medium text-gray-800 max-w-[220px] truncate">{c.name}</td>
                          <td className="px-3 py-3 text-gray-500">{CHANNEL_LABELS[c.channelType] || c.channelType}</td>
                          <td className="px-3 py-3 text-center">
                            <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-semibold', s.cls)}>{s.label}</span>
                          </td>
                          <td className="px-3 py-3 text-right font-semibold text-gray-800">{formatCurrency(c.spend)}</td>
                          <td className="px-3 py-3 text-right text-gray-600">{c.clicks.toLocaleString('pt-BR')}</td>
                          <td className="px-3 py-3 text-right text-gray-600">{c.ctr.toFixed(2)}%</td>
                          <td className="px-3 py-3 text-center">
                            {c.conversions > 0
                              ? <span className="inline-block bg-green-100 text-green-700 font-black px-2 py-0.5 rounded text-[11px]">{c.conversions.toFixed(0)}</span>
                              : <span className="text-gray-200">—</span>}
                          </td>
                          <td className="px-3 py-3 text-right text-gray-500">
                            {c.costPerConversion > 0 ? formatCurrency(c.costPerConversion) : <span className="text-gray-200">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            {c.roas > 0
                              ? <span className={cn('font-bold', c.roas >= 2 ? 'text-green-600' : 'text-yellow-600')}>{c.roas.toFixed(2)}x</span>
                              : <span className="text-gray-200">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                    {data.campaigns.length === 0 && (
                      <tr><td colSpan={9} className="py-10 text-center text-gray-400 text-sm">Nenhuma campanha encontrada no período</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Ad Groups */}
            {activeTab === 'grupos' && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-4 py-3 font-semibold text-gray-400 uppercase text-[10px] tracking-wide">Grupo de Anúncios</th>
                      <th className="text-left px-3 py-3 font-semibold text-gray-400 uppercase text-[10px]">Campanha</th>
                      <th className="text-center px-3 py-3 font-semibold text-gray-400 uppercase text-[10px]">Status</th>
                      <th className="text-right px-3 py-3 font-semibold text-gray-400 uppercase text-[10px]">Gasto</th>
                      <th className="text-right px-3 py-3 font-semibold text-gray-400 uppercase text-[10px]">Cliques</th>
                      <th className="text-right px-3 py-3 font-semibold text-gray-400 uppercase text-[10px]">CTR</th>
                      <th className="text-center px-3 py-3 font-semibold text-green-600 uppercase text-[10px]">Conversões</th>
                      <th className="text-right px-4 py-3 font-semibold text-gray-400 uppercase text-[10px]">Custo/Conv.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.adGroups.map((g, i) => {
                      const s = STATUS_CFG[g.status] || { label: g.status, cls: 'bg-gray-50 text-gray-400 border-gray-200' }
                      return (
                        <tr key={g.id} className={cn('hover:bg-gray-50/80', i === 0 && 'bg-blue-50/20')}>
                          <td className="px-4 py-3 font-medium text-gray-800 max-w-[200px] truncate">{g.name}</td>
                          <td className="px-3 py-3 text-gray-400 max-w-[160px] truncate">{g.campaignName}</td>
                          <td className="px-3 py-3 text-center">
                            <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-semibold', s.cls)}>{s.label}</span>
                          </td>
                          <td className="px-3 py-3 text-right font-semibold text-gray-800">{formatCurrency(g.spend)}</td>
                          <td className="px-3 py-3 text-right text-gray-600">{g.clicks.toLocaleString('pt-BR')}</td>
                          <td className="px-3 py-3 text-right text-gray-600">{g.ctr.toFixed(2)}%</td>
                          <td className="px-3 py-3 text-center">
                            {g.conversions > 0
                              ? <span className="inline-block bg-green-100 text-green-700 font-black px-2 py-0.5 rounded text-[11px]">{g.conversions.toFixed(0)}</span>
                              : <span className="text-gray-200">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-500">
                            {g.costPerConversion > 0 ? formatCurrency(g.costPerConversion) : <span className="text-gray-200">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                    {data.adGroups.length === 0 && (
                      <tr><td colSpan={8} className="py-10 text-center text-gray-400 text-sm">Nenhum grupo de anúncios encontrado</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Device */}
            {activeTab === 'dispositivo' && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-5 py-3 font-semibold text-gray-400 uppercase text-[10px] tracking-wide">Dispositivo</th>
                      <th className="text-right px-3 py-3 font-semibold text-gray-400 uppercase text-[10px]">Gasto</th>
                      <th className="text-right px-3 py-3 font-semibold text-gray-400 uppercase text-[10px]">Impressões</th>
                      <th className="text-right px-3 py-3 font-semibold text-gray-400 uppercase text-[10px]">Cliques</th>
                      <th className="text-right px-3 py-3 font-semibold text-gray-400 uppercase text-[10px]">CTR</th>
                      <th className="text-center px-3 py-3 font-semibold text-green-600 uppercase text-[10px]">Conversões</th>
                      <th className="text-right px-5 py-3 font-semibold text-gray-400 uppercase text-[10px]">Custo/Conv.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.byDevice.map((d, i) => (
                      <tr key={d.device} className={cn('hover:bg-gray-50/80', i === 0 && d.conversions > 0 && 'bg-green-50/30')}>
                        <td className="px-5 py-3 font-semibold text-gray-800">{DEVICE_LABELS[d.device] || d.device}</td>
                        <td className="px-3 py-3 text-right text-gray-700">{formatCurrency(d.spend)}</td>
                        <td className="px-3 py-3 text-right text-gray-500">{d.impressions.toLocaleString('pt-BR')}</td>
                        <td className="px-3 py-3 text-right text-gray-500">{d.clicks.toLocaleString('pt-BR')}</td>
                        <td className="px-3 py-3 text-right text-gray-500">{d.ctr.toFixed(2)}%</td>
                        <td className="px-3 py-3 text-center">
                          {d.conversions > 0
                            ? <span className="inline-block bg-green-100 text-green-700 font-black px-2 py-0.5 rounded text-[11px]">{d.conversions.toFixed(0)}</span>
                            : <span className="text-gray-200">—</span>}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-500">
                          {d.costPerConversion > 0 ? formatCurrency(d.costPerConversion) : <span className="text-gray-200">—</span>}
                        </td>
                      </tr>
                    ))}
                    {data.byDevice.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-gray-400 text-sm">Sem dados de dispositivo</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {/* Network */}
            {activeTab === 'rede' && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-5 py-3 font-semibold text-gray-400 uppercase text-[10px] tracking-wide">Rede</th>
                      <th className="text-right px-3 py-3 font-semibold text-gray-400 uppercase text-[10px]">Gasto</th>
                      <th className="text-right px-3 py-3 font-semibold text-gray-400 uppercase text-[10px]">Impressões</th>
                      <th className="text-right px-3 py-3 font-semibold text-gray-400 uppercase text-[10px]">Cliques</th>
                      <th className="text-right px-3 py-3 font-semibold text-gray-400 uppercase text-[10px]">CTR</th>
                      <th className="text-center px-3 py-3 font-semibold text-green-600 uppercase text-[10px]">Conversões</th>
                      <th className="text-right px-5 py-3 font-semibold text-gray-400 uppercase text-[10px]">Custo/Conv.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.byNetwork.map((n, i) => (
                      <tr key={n.network} className={cn('hover:bg-gray-50/80', i === 0 && 'bg-blue-50/20')}>
                        <td className="px-5 py-3 font-semibold text-gray-800">{NETWORK_LABELS[n.network] || n.network}</td>
                        <td className="px-3 py-3 text-right text-gray-700">{formatCurrency(n.spend)}</td>
                        <td className="px-3 py-3 text-right text-gray-500">{n.impressions.toLocaleString('pt-BR')}</td>
                        <td className="px-3 py-3 text-right text-gray-500">{n.clicks.toLocaleString('pt-BR')}</td>
                        <td className="px-3 py-3 text-right text-gray-500">{n.ctr.toFixed(2)}%</td>
                        <td className="px-3 py-3 text-center">
                          {n.conversions > 0
                            ? <span className="inline-block bg-green-100 text-green-700 font-black px-2 py-0.5 rounded text-[11px]">{n.conversions.toFixed(0)}</span>
                            : <span className="text-gray-200">—</span>}
                        </td>
                        <td className="px-5 py-3 text-right text-gray-500">
                          {n.costPerConversion > 0 ? formatCurrency(n.costPerConversion) : <span className="text-gray-200">—</span>}
                        </td>
                      </tr>
                    ))}
                    {data.byNetwork.length === 0 && <tr><td colSpan={7} className="py-10 text-center text-gray-400 text-sm">Sem dados de rede</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {/* Day of week */}
            {activeTab === 'dia' && (
              <div className="p-5">
                <div className="space-y-2.5">
                  {data.byDayOfWeek.map((d, i) => {
                    const maxSpend = Math.max(...data.byDayOfWeek.map(x => x.spend), 1)
                    const maxConv = Math.max(...data.byDayOfWeek.map(x => x.conversions), 0)
                    const isTop = maxConv > 0 ? d.conversions === maxConv : d.spend === Math.max(...data.byDayOfWeek.map(x => x.spend))
                    return (
                      <div key={d.day}>
                        <div className="flex items-center gap-3 mb-1">
                          <span className={cn('text-xs font-bold w-16 flex-shrink-0', isTop ? 'text-green-700' : 'text-gray-600')}>{d.name}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                            <div className={cn('h-full rounded-full', isTop ? 'bg-green-400' : 'bg-blue-200')}
                              style={{ width: `${(d.spend / maxSpend) * 100}%` }} />
                          </div>
                          <span className="text-xs text-gray-600 w-24 text-right flex-shrink-0">{formatCurrency(d.spend)}</span>
                          <span className="text-xs w-20 text-right flex-shrink-0">
                            {d.conversions > 0
                              ? <span className="font-bold text-green-600">{d.conversions.toFixed(0)} conv.</span>
                              : <span className="text-gray-300">0 conv.</span>}
                          </span>
                          <span className="text-[10px] text-gray-400 w-16 text-right flex-shrink-0">{d.ctr.toFixed(2)}% CTR</span>
                        </div>
                      </div>
                    )
                  })}
                  {data.byDayOfWeek.length === 0 && <p className="text-center text-gray-400 text-sm py-8">Sem dados de dia da semana</p>}
                </div>
              </div>
            )}

            {/* Hourly */}
            {activeTab === 'horario' && (
              <div className="p-5">
                {data.byHour.length > 0 ? (
                  <>
                    <div className="flex items-end gap-0.5 h-24 mb-2">
                      {Array.from({ length: 24 }, (_, h) => {
                        const row = data.byHour.find(r => r.hour === h)
                        const maxCtr = Math.max(...data.byHour.map(r => r.ctr), 0.01)
                        const height = row ? Math.max((row.ctr / maxCtr) * 100, 4) : 0
                        const isPeak = row && row.ctr === maxCtr
                        return (
                          <div key={h} className="flex-1 flex flex-col items-center" title={row ? `${h}h — CTR ${row.ctr.toFixed(2)}% — ${row.conversions} conv.` : `${h}h — sem dados`}>
                            <div className={cn('w-full rounded-sm', isPeak ? 'bg-blue-500' : row ? 'bg-blue-200' : 'bg-gray-100')}
                              style={{ height: `${height}%` }} />
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex justify-between text-[9px] text-gray-400">
                      <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
                    </div>
                    <div className="mt-4 space-y-1.5">
                      {[...data.byHour].sort((a, b) => b.conversions - a.conversions || b.ctr - a.ctr).slice(0, 5).map(h => (
                        <div key={h.hour} className="flex items-center gap-3 text-xs">
                          <span className="font-bold text-blue-600 w-8">{h.label}</span>
                          <span className="text-gray-500">{formatCurrency(h.spend)} gasto</span>
                          <span className="text-gray-500">{h.ctr.toFixed(2)}% CTR</span>
                          {h.conversions > 0 && <span className="font-bold text-green-600">{h.conversions.toFixed(0)} conversões</span>}
                        </div>
                      ))}
                    </div>
                  </>
                ) : <p className="text-center text-gray-400 text-sm py-8">Sem dados de horário</p>}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
