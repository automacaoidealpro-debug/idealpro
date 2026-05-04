'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatCurrency } from '@/lib/utils'
import {
  RefreshCw, Users, ShoppingCart, MessageCircle, TrendingUp,
  FileText, Printer, Calendar, Copy, Check, ChevronDown, ChevronUp,
  MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { getTargets, AccountTarget } from '@/lib/account-targets'

interface ReportRow {
  id: string
  name: string
  type: 'lead' | 'ecommerce' | 'conversa'
  spend: number
  leads: number
  purchases: number
  conversations: number
  addToCart: number
  initiateCheckout: number
  revenue: number
  results: number
  cpp: number
  impressions: number
  clicks: number
  ctr: number
  reach: number
}

interface Totals {
  spend: number
  leads: number
  purchases: number
  conversations: number
  addToCart: number
  revenue: number
  results: number
  impressions: number
  clicks: number
}

interface ReportData {
  rows: ReportRow[]
  totals: Totals
  period: string
  total_accounts: number
  prev_totals?: Totals | null
}

const PERIODS = [
  { key: 'today', label: 'Hoje' },
  { key: 'yesterday', label: 'Ontem' },
  { key: 'last_7d', label: 'Últimos 7 dias' },
  { key: 'this_week_sun_today', label: 'Esta semana' },
  { key: 'last_week_sun_sat', label: 'Semana passada' },
  { key: 'this_month', label: 'Este mês' },
  { key: 'last_month', label: 'Mês passado' },
]

const PERIOD_LABELS: Record<string, string> = {
  today: 'hoje',
  yesterday: 'ontem',
  last_7d: 'nos últimos 7 dias',
  this_week_sun_today: 'nesta semana',
  last_week_sun_sat: 'na semana passada',
  this_month: 'neste mês',
  last_month: 'no mês passado',
}

function fmt(n: number) { return n.toLocaleString('pt-BR') }
function fmtC(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function generateNarrative(row: ReportRow, periodLabel: string): string {
  const period = periodLabel || 'no período'

  if (row.spend === 0 && row.results === 0) {
    return `${row.name}: sem dados ${period}.`
  }

  if (row.type === 'ecommerce') {
    const parts: string[] = []
    if (row.purchases > 0) parts.push(`${fmt(row.purchases)} venda${row.purchases !== 1 ? 's' : ''} realizad${row.purchases !== 1 ? 'as' : 'a'}`)
    if (row.addToCart > 0) parts.push(`${fmt(row.addToCart)} adicionaram ao carrinho`)
    if (row.initiateCheckout > 0) parts.push(`${fmt(row.initiateCheckout)} iniciaram checkout`)
    const revenue = row.revenue > 0 ? ` · Faturamento: ${fmtC(row.revenue)}` : ''
    const cpp = row.purchases > 0 ? ` · Custo por compra: ${fmtC(row.spend / row.purchases)}` : ''
    return `${row.name} (${period}): ${parts.join(', ')}${revenue}${cpp} · Gasto total: ${fmtC(row.spend)}`
  }

  if (row.type === 'conversa') {
    const cpp = row.conversations > 0 ? ` · Custo por conversa: ${fmtC(row.spend / row.conversations)}` : ''
    return `${row.name} (${period}): ${fmt(row.conversations)} conversa${row.conversations !== 1 ? 's' : ''} iniciada${row.conversations !== 1 ? 's' : ''}${cpp} · Gasto total: ${fmtC(row.spend)}`
  }

  // lead (default)
  const cpl = row.leads > 0 ? ` · Custo por lead: ${fmtC(row.spend / row.leads)}` : ''
  const extra = row.conversations > 0 ? ` · ${fmt(row.conversations)} conversa${row.conversations !== 1 ? 's' : ''} também` : ''
  return `${row.name} (${period}): ${fmt(row.leads)} lead${row.leads !== 1 ? 's' : ''}${cpl}${extra} · Gasto total: ${fmtC(row.spend)}`
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-gray-500" />}
      {copied ? 'Copiado!' : 'Copiar'}
    </button>
  )
}

function WhatsAppButton({ narrative, whatsapp }: { narrative: string; whatsapp?: string }) {
  const [toasted, setToasted] = useState(false)
  const send = () => {
    if (whatsapp) {
      window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(narrative)}`, '_blank')
    } else {
      navigator.clipboard.writeText(narrative)
      setToasted(true)
      setTimeout(() => setToasted(false), 2500)
    }
  }
  return (
    <button
      onClick={send}
      title={whatsapp ? 'Enviar no WhatsApp' : 'Copiar para colar no WhatsApp'}
      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-50 hover:bg-green-100 text-green-700 rounded-lg transition-colors border border-green-200"
    >
      <MessageSquare className="w-3.5 h-3.5" />
      {toasted ? 'Copiado!' : whatsapp ? 'WhatsApp' : 'Copiar p/ WA'}
    </button>
  )
}

// Period comparison arrow
function ChangeArrow({ current, prev, lowerIsBetter }: { current: number; prev: number; lowerIsBetter?: boolean }) {
  if (!prev || prev === 0) return null
  const pct = ((current - prev) / prev) * 100
  const improved = lowerIsBetter ? pct < 0 : pct > 0
  const symbol = pct > 0 ? '▲' : '▼'
  const absPct = Math.abs(pct).toFixed(1)
  return (
    <span className={cn('text-[10px] font-bold ml-1', improved ? 'text-green-600' : 'text-red-500')}>
      {symbol} {absPct}%
    </span>
  )
}

const TYPE_CFG = {
  lead: { label: 'Lead', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Users },
  ecommerce: { label: 'E-commerce', color: 'bg-green-50 text-green-700 border-green-200', icon: ShoppingCart },
  conversa: { label: 'Mensagem', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: MessageCircle },
}

function today() { return new Date().toISOString().split('T')[0] }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

export default function RelatoriosPage() {
  const [period, setPeriod] = useState('this_month')
  const [since, setSince] = useState(daysAgo(30))
  const [until, setUntil] = useState(today())
  const [useCustom, setUseCustom] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(false)
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null)
  const [view, setView] = useState<'narrative' | 'table' | 'whatsapp'>('narrative')
  const [sentSet, setSentSet] = useState<Set<string>>(new Set())
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [targets, setTargets] = useState<Record<string, AccountTarget>>({})

  useEffect(() => {
    setTargets(getTargets())
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      let url = `/api/meta/report?period=${period}`
      if (useCustom && since && until) url = `/api/meta/report?period=custom&since=${since}&until=${until}`
      const res = await fetch(url)
      const json = await res.json()
      setData(json)
      setGeneratedAt(new Date())
    } finally {
      setLoading(false)
    }
  }, [period, since, until, useCustom])

  useEffect(() => { load() }, [load])

  const applyCustom = () => {
    setUseCustom(true)
    setShowCustom(false)
    load()
  }

  const selectPeriod = (p: string) => {
    setPeriod(p)
    setUseCustom(false)
  }

  const activePeriodLabel = useCustom
    ? `${since} → ${until}`
    : (PERIOD_LABELS[period] || period)

  const allNarrative = data?.rows.map(r => generateNarrative(r, activePeriodLabel)).join('\n') || ''

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const prevTotals = data?.prev_totals

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white px-6 py-6 print:hidden">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
              <FileText className="w-5 h-5 text-gray-300" />
            </div>
            <div>
              <h1 className="text-lg font-bold">Relatórios</h1>
              <p className="text-gray-400 text-xs mt-0.5">
                {generatedAt ? `Gerado às ${generatedAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Carregando...'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-xs font-medium transition-all">
              <Printer className="w-3.5 h-3.5" /> Imprimir
            </button>
            <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-xs font-medium transition-all disabled:opacity-50">
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} /> Atualizar
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-5 space-y-4">

        {/* Period selector */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 print:hidden">
          <div className="flex items-center gap-2 flex-wrap">
            <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
            {PERIODS.map(p => (
              <button
                key={p.key}
                onClick={() => selectPeriod(p.key)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                  period === p.key && !useCustom
                    ? 'bg-gray-900 text-white'
                    : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'
                )}
              >{p.label}</button>
            ))}
            <button
              onClick={() => setShowCustom(v => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                useCustom || showCustom ? 'bg-gray-900 text-white border-gray-900' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              )}
            >
              <Calendar className="w-3 h-3" />
              {useCustom ? `${since} → ${until}` : 'Personalizado'}
              {showCustom ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {loading && <RefreshCw className="w-3.5 h-3.5 text-gray-400 animate-spin ml-1" />}
          </div>

          {showCustom && (
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-end gap-3 flex-wrap">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Data inicial</label>
                <input type="date" value={since} max={until}
                  onChange={e => setSince(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Data final</label>
                <input type="date" value={until} min={since} max={today()}
                  onChange={e => setUntil(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <button onClick={applyCustom} disabled={!since || !until}
                className="px-4 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-medium hover:bg-gray-700 disabled:opacity-40">
                Aplicar período
              </button>
            </div>
          )}
        </div>

        {/* Send all via WhatsApp */}
        {data && data.rows.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-green-800">Enviar todos os relatórios</p>
              <p className="text-xs text-green-600 mt-0.5">Relatório completo de todas as {data.rows.length} contas concatenado</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <CopyButton text={allNarrative} />
              <button
                onClick={() => {
                  window.open(`https://wa.me/?text=${encodeURIComponent(allNarrative)}`, '_blank')
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                WhatsApp
              </button>
            </div>
          </div>
        )}

        {/* View toggle */}
        <div className="flex items-center gap-2 print:hidden flex-wrap">
          <button onClick={() => setView('narrative')}
            className={cn('px-4 py-2 rounded-xl text-sm font-medium border transition-all',
              view === 'narrative' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}>
            Relatório em texto
          </button>
          <button onClick={() => setView('table')}
            className={cn('px-4 py-2 rounded-xl text-sm font-medium border transition-all',
              view === 'table' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400')}>
            Tabela de dados
          </button>
          <button onClick={() => { setView('whatsapp'); setSentSet(new Set()) }}
            className={cn('flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition-all',
              view === 'whatsapp' ? 'bg-green-700 text-white border-green-700' : 'bg-white text-green-700 border-green-300 hover:bg-green-50')}>
            <MessageSquare className="w-3.5 h-3.5" />
            Envio WhatsApp
          </button>
        </div>

        {/* Print header */}
        <div className="hidden print:block mb-4">
          <h1 className="text-2xl font-bold">Ideal Pro — Relatório Meta Ads</h1>
          <p className="text-gray-500">Período: {activePeriodLabel} · Gerado em {generatedAt?.toLocaleString('pt-BR')}</p>
        </div>

        {/* Summary cards */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <span className="text-xs text-gray-500">Investido</span>
              </div>
              <p className="text-xl font-bold text-gray-900">
                {fmtC(data.totals.spend)}
                {prevTotals && <ChangeArrow current={data.totals.spend} prev={prevTotals.spend} lowerIsBetter />}
              </p>
              <p className="text-xs text-gray-400 mt-1">{data.rows.length} contas com dados</p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-blue-50 rounded-lg flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <span className="text-xs text-gray-500">Leads</span>
              </div>
              <p className="text-xl font-bold text-blue-700">
                {fmt(data.totals.leads)}
                {prevTotals && <ChangeArrow current={data.totals.leads} prev={prevTotals.leads} />}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {data.totals.leads > 0 ? `CPL médio: ${fmtC(data.totals.spend / data.totals.leads)}` : '—'}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-green-50 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-3.5 h-3.5 text-green-600" />
                </div>
                <span className="text-xs text-gray-500">Vendas</span>
              </div>
              <p className="text-xl font-bold text-green-700">
                {fmt(data.totals.purchases)}
                {prevTotals && <ChangeArrow current={data.totals.purchases} prev={prevTotals.purchases} />}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {data.totals.revenue > 0 ? `Receita: ${fmtC(data.totals.revenue)}` : data.totals.purchases > 0 ? `CPA: ${fmtC(data.totals.spend / data.totals.purchases)}` : '—'}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center">
                  <MessageCircle className="w-3.5 h-3.5 text-purple-600" />
                </div>
                <span className="text-xs text-gray-500">Conversas</span>
              </div>
              <p className="text-xl font-bold text-purple-700">
                {fmt(data.totals.conversations)}
                {prevTotals && <ChangeArrow current={data.totals.conversations} prev={prevTotals.conversations} />}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {data.totals.conversations > 0 ? `Custo/conv: ${fmtC(data.totals.spend / data.totals.conversations)}` : '—'}
              </p>
            </div>
          </div>
        )}

        {/* CPP comparison if prev available */}
        {data && prevTotals && data.totals.results > 0 && prevTotals.results > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-3 flex items-center gap-3 text-sm">
            <span className="text-gray-500">CPP médio:</span>
            <span className="font-bold text-gray-900">{fmtC(data.totals.spend / data.totals.results)}</span>
            <ChangeArrow
              current={data.totals.spend / data.totals.results}
              prev={prevTotals.spend / prevTotals.results}
              lowerIsBetter
            />
            <span className="text-xs text-gray-400">vs período anterior ({fmtC(prevTotals.spend / prevTotals.results)})</span>
          </div>
        )}

        {/* Loading */}
        {loading && !data && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <RefreshCw className="w-6 h-6 text-gray-400 animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Carregando dados de todas as contas...</p>
          </div>
        )}

        {/* ── NARRATIVE VIEW ─────────────────────────────────── */}
        {data && view === 'narrative' && (
          <div className="space-y-3">
            {/* All narrative copy block */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-900">Relatório completo — texto para copiar</p>
                <CopyButton text={allNarrative} />
              </div>
              <div className="px-5 py-4">
                <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">{allNarrative}</pre>
              </div>
            </div>

            {/* Per account cards */}
            {data.rows.map(row => {
              const cfg = TYPE_CFG[row.type]
              const TypeIcon = cfg.icon
              const narrative = generateNarrative(row, activePeriodLabel)
              const expanded = expandedRows.has(row.id)
              const whatsapp = targets[row.id]?.whatsapp

              return (
                <div key={row.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                  <button
                    onClick={() => toggleRow(row.id)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">{row.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="font-semibold text-gray-900 text-sm truncate">{row.name}</p>
                        <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 flex-shrink-0', cfg.color)}>
                          <TypeIcon className="w-2.5 h-2.5" /> {cfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate">{narrative}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
                      <WhatsAppButton narrative={narrative} whatsapp={whatsapp} />
                      <CopyButton text={narrative} />
                      {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-gray-100 px-5 py-4">
                      {/* Narrative text */}
                      <div className="bg-gray-50 rounded-xl p-4 mb-4">
                        <p className="text-sm text-gray-800 leading-relaxed">{narrative}</p>
                      </div>

                      {/* Metrics grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="text-center p-3 rounded-xl bg-indigo-50">
                          <p className="text-xs text-indigo-400 mb-1">Investido</p>
                          <p className="font-bold text-indigo-800">{fmtC(row.spend)}</p>
                        </div>
                        {row.type === 'ecommerce' && (
                          <>
                            <div className="text-center p-3 rounded-xl bg-green-50">
                              <p className="text-xs text-green-400 mb-1">Vendas</p>
                              <p className="font-bold text-green-800">{fmt(row.purchases)}</p>
                            </div>
                            <div className="text-center p-3 rounded-xl bg-green-50">
                              <p className="text-xs text-green-400 mb-1">Add ao carrinho</p>
                              <p className="font-bold text-green-800">{fmt(row.addToCart)}</p>
                            </div>
                            <div className="text-center p-3 rounded-xl bg-green-50">
                              <p className="text-xs text-green-400 mb-1">Faturamento</p>
                              <p className="font-bold text-green-800">{row.revenue > 0 ? fmtC(row.revenue) : '—'}</p>
                            </div>
                            <div className="text-center p-3 rounded-xl bg-gray-50">
                              <p className="text-xs text-gray-400 mb-1">Custo/compra</p>
                              <p className="font-bold text-gray-800">{row.purchases > 0 ? fmtC(row.spend / row.purchases) : '—'}</p>
                            </div>
                            {row.revenue > 0 && (
                              <div className="text-center p-3 rounded-xl bg-gray-50">
                                <p className="text-xs text-gray-400 mb-1">ROAS</p>
                                <p className="font-bold text-gray-800">{(row.revenue / row.spend).toFixed(2)}x</p>
                              </div>
                            )}
                          </>
                        )}
                        {row.type === 'lead' && (
                          <>
                            <div className="text-center p-3 rounded-xl bg-blue-50">
                              <p className="text-xs text-blue-400 mb-1">Leads</p>
                              <p className="font-bold text-blue-800">{fmt(row.leads)}</p>
                            </div>
                            <div className="text-center p-3 rounded-xl bg-blue-50">
                              <p className="text-xs text-blue-400 mb-1">Custo/lead</p>
                              <p className="font-bold text-blue-800">{row.leads > 0 ? fmtC(row.spend / row.leads) : '—'}</p>
                            </div>
                            {row.conversations > 0 && (
                              <div className="text-center p-3 rounded-xl bg-purple-50">
                                <p className="text-xs text-purple-400 mb-1">Conversas</p>
                                <p className="font-bold text-purple-800">{fmt(row.conversations)}</p>
                              </div>
                            )}
                          </>
                        )}
                        {row.type === 'conversa' && (
                          <>
                            <div className="text-center p-3 rounded-xl bg-purple-50">
                              <p className="text-xs text-purple-400 mb-1">Conversas</p>
                              <p className="font-bold text-purple-800">{fmt(row.conversations)}</p>
                            </div>
                            <div className="text-center p-3 rounded-xl bg-purple-50">
                              <p className="text-xs text-purple-400 mb-1">Custo/conversa</p>
                              <p className="font-bold text-purple-800">{row.conversations > 0 ? fmtC(row.spend / row.conversations) : '—'}</p>
                            </div>
                          </>
                        )}
                        <div className="text-center p-3 rounded-xl bg-gray-50">
                          <p className="text-xs text-gray-400 mb-1">Alcance</p>
                          <p className="font-bold text-gray-800">{fmt(row.reach)}</p>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-gray-50">
                          <p className="text-xs text-gray-400 mb-1">CTR</p>
                          <p className="font-bold text-gray-800">{row.ctr > 0 ? `${row.ctr.toFixed(2)}%` : '—'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* ── TABLE VIEW ─────────────────────────────────────── */}
        {data && view === 'table' && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Tabela de dados — {activePeriodLabel}</h2>
              {loading && <RefreshCw className="w-4 h-4 text-gray-400 animate-spin" />}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">#</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500">Cliente</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500">Tipo</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Investido</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-blue-500">Leads</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-green-500">Compras</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-green-400">Carrinho</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-purple-500">Conversas</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500">Custo/res.</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 hidden sm:table-cell">CTR</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {data.rows.map((row, i) => {
                    const cfg = TYPE_CFG[row.type]
                    const TypeIcon = cfg.icon
                    return (
                      <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-5 py-3 text-xs text-gray-400">{i + 1}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center flex-shrink-0">
                              <span className="text-white text-[8px] font-bold">{row.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <span className="font-medium text-gray-900 truncate max-w-[180px]">{row.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 w-fit', cfg.color)}>
                            <TypeIcon className="w-2.5 h-2.5" /> {cfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmtC(row.spend)}</td>
                        <td className="px-4 py-3 text-right">{row.leads > 0 ? <span className="font-semibold text-blue-700">{row.leads}</span> : <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-right">{row.purchases > 0 ? <span className="font-semibold text-green-700">{row.purchases}</span> : <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-right">{row.addToCart > 0 ? <span className="font-semibold text-green-600">{row.addToCart}</span> : <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-right">{row.conversations > 0 ? <span className="font-semibold text-purple-700">{row.conversations}</span> : <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{row.cpp > 0 ? fmtC(row.cpp) : <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">{row.ctr > 0 ? `${row.ctr.toFixed(2)}%` : <span className="text-gray-300">—</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50 font-bold">
                    <td className="px-5 py-3 text-xs text-gray-400" colSpan={3}>TOTAL ({data.rows.length} contas)</td>
                    <td className="px-4 py-3 text-right text-gray-900">{fmtC(data.totals.spend)}</td>
                    <td className="px-4 py-3 text-right text-blue-700">{data.totals.leads || '—'}</td>
                    <td className="px-4 py-3 text-right text-green-700">{data.totals.purchases || '—'}</td>
                    <td className="px-4 py-3 text-right text-green-600">{data.totals.addToCart || '—'}</td>
                    <td className="px-4 py-3 text-right text-purple-700">{data.totals.conversations || '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {data.totals.results > 0 ? fmtC(data.totals.spend / data.totals.results) : '—'}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell" />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {/* ── WHATSAPP BATCH VIEW ─────────────────────────────── */}
        {data && view === 'whatsapp' && (() => {
          const withWa = data.rows.filter(r => targets[r.id]?.whatsapp)
          const withoutWa = data.rows.filter(r => !targets[r.id]?.whatsapp)
          return (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-2xl p-4">
                <p className="text-sm font-bold text-green-800 mb-1">
                  {sentSet.size} de {withWa.length} clientes notificados
                </p>
                <div className="w-full bg-green-200 rounded-full h-1.5">
                  <div className="bg-green-600 h-1.5 rounded-full transition-all" style={{ width: withWa.length > 0 ? `${(sentSet.size / withWa.length) * 100}%` : '0%' }} />
                </div>
                {withoutWa.length > 0 && (
                  <p className="text-xs text-green-600 mt-2">
                    {withoutWa.length} conta{withoutWa.length !== 1 ? 's' : ''} sem WhatsApp configurado — defina em Painel → engrenagem da conta
                  </p>
                )}
              </div>

              {withWa.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center text-gray-500 text-sm">
                  Nenhuma conta tem WhatsApp configurado. Configure em Painel → ícone de engrenagem em cada conta.
                </div>
              ) : (
                <div className="space-y-2">
                  {withWa.map(row => {
                    const narrative = generateNarrative(row, activePeriodLabel)
                    const whatsapp = targets[row.id]!.whatsapp!
                    const sent = sentSet.has(row.id)
                    return (
                      <div key={row.id} className={cn(
                        'flex items-center gap-4 p-4 rounded-2xl border transition-all',
                        sent ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                      )}>
                        <div className={cn(
                          'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold',
                          sent ? 'bg-green-500 text-white' : 'bg-gradient-to-br from-blue-400 to-indigo-600 text-white'
                        )}>
                          {sent ? '✓' : row.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{row.name}</p>
                          <p className="text-xs text-gray-500 truncate mt-0.5">{narrative}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <CopyButton text={narrative} />
                          <button
                            onClick={() => {
                              window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(narrative)}`, '_blank')
                              setSentSet(prev => new Set([...prev, row.id]))
                            }}
                            className={cn(
                              'flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-colors border font-semibold',
                              sent
                                ? 'bg-green-100 text-green-700 border-green-200'
                                : 'bg-green-600 hover:bg-green-700 text-white border-green-600'
                            )}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            {sent ? 'Enviado' : 'Enviar'}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {withoutWa.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                  <p className="px-4 py-3 text-xs font-semibold text-gray-400 border-b border-gray-100">
                    Sem WhatsApp — copiar manualmente ({withoutWa.length})
                  </p>
                  <div className="divide-y divide-gray-50">
                    {withoutWa.map(row => {
                      const narrative = generateNarrative(row, activePeriodLabel)
                      return (
                        <div key={row.id} className="flex items-center gap-4 px-4 py-3">
                          <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 text-xs font-bold text-gray-500">
                            {row.name.charAt(0).toUpperCase()}
                          </div>
                          <p className="flex-1 text-sm text-gray-700 truncate">{row.name}</p>
                          <CopyButton text={narrative} />
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
