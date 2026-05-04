'use client'

import { use, useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatCurrency, formatNumber, cn } from '@/lib/utils'
import { generateOptimizations, CampaignItem } from '@/lib/optimizations'
import { CampaignTree } from '@/components/CampaignTree'
import { OptimizationPanel } from '@/components/OptimizationPanel'
import { BreakdownTable, BreakdownRow } from '@/components/BreakdownTable'
import { HealthScore } from '@/components/HealthScore'
import Link from 'next/link'
import {
  ArrowLeft, RefreshCw, Calendar, ChevronDown,
  TrendingUp, Users, ShoppingCart, DollarSign, BarChart2, Brain, FileText,
} from 'lucide-react'
import { ExecutionPanel } from '@/components/ExecutionPanel'
import { CreateCampaignForm } from '@/components/CreateCampaignForm'

const PERIODS = [
  { value: 'today',      label: 'Hoje' },
  { value: 'yesterday',  label: 'Ontem' },
  { value: 'last_7d',    label: '7 dias' },
  { value: 'last_14d',   label: '14 dias' },
  { value: 'last_28d',   label: '28 dias' },
  { value: 'this_month', label: 'Este mês' },
  { value: 'last_month', label: 'Mês passado' },
]

interface Insights {
  spend: string; impressions: string; clicks: string
  ctr: string; cpp: string; cpm: string; frequency: string
  actions?: { action_type: string; value: string }[]
  cost_per_action_type?: { action_type: string; value: string }[]
}

interface AccountData {
  resultType: string
  today: Insights | null
  week: Insights | null
  selected: Insights | null
  byGender: BreakdownRow[]
  byAge: BreakdownRow[]
  byPlatform: BreakdownRow[]
  byPosition: BreakdownRow[]
  byRegion: BreakdownRow[]
  byHour: BreakdownRow[]
  byDayOfWeek: BreakdownRow[]
  byWeekOfMonth: BreakdownRow[]
}

const RESULT_PRIORITY = [
  'purchase','omni_purchase',
  'onsite_conversion.messaging_conversation_started_7d',
  'lead','complete_registration',
]

function getResultValue(ins: Insights | null | undefined) {
  if (!ins?.actions) return 0
  for (const t of RESULT_PRIORITY) {
    const f = ins.actions.find(a => a.action_type === t)
    if (f && parseInt(f.value) > 0) return parseInt(f.value)
  }
  return 0
}

function getCpr(cpa?: { action_type: string; value: string }[]) {
  if (!cpa) return 0
  for (const t of RESULT_PRIORITY) {
    const v = parseFloat(cpa.find(a => a.action_type === t)?.value || '0')
    if (v > 0) return v
  }
  return 0
}

function today() { return new Date().toISOString().split('T')[0] }
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n)
  return d.toISOString().split('T')[0]
}

// Quick stat card for header bar
function QuickStat({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string
}) {
  return (
    <div className="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3 flex-1 min-w-0">
      <Icon className={cn('w-5 h-5 flex-shrink-0', color)} />
      <div className="min-w-0">
        <p className="text-xs text-white/60 leading-none">{label}</p>
        <p className="font-bold text-white text-base leading-tight mt-0.5 truncate">{value}</p>
        {sub && <p className="text-[10px] text-white/50 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

export default function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [accountName, setAccountName] = useState('')
  const [accountData, setAccountData] = useState<AccountData | null>(null)
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([])
  const [loadingAccount, setLoadingAccount] = useState(true)
  const [loadingCampaigns, setLoadingCampaigns] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [period, setPeriod] = useState('this_month')
  const [showCustom, setShowCustom] = useState(false)
  const [customFrom, setCustomFrom] = useState(daysAgo(30))
  const [customTo, setCustomTo] = useState(today())
  const [activeLabel, setActiveLabel] = useState('Este mês')
  const [activeSince, setActiveSince] = useState('')
  const [activeUntil, setActiveUntil] = useState('')
  const [showBreakdowns, setShowBreakdowns] = useState(false)

  const buildUrl = useCallback((base: string, p: string, s?: string, u?: string) => {
    let url = `${base}?period=${p}`
    if (s && u) url += `&since=${s}&until=${u}`
    return url
  }, [])

  const fetchAll = useCallback(async (p: string, s?: string, u?: string) => {
    setLoadingAccount(true)
    setLoadingCampaigns(true)
    setError(null)

    // Parallel: account overview + campaign tree (name comes from campaign response)
    const [accRes, campRes] = await Promise.allSettled([
      fetch(buildUrl(`/api/meta/account/${id}`, p, s, u)),
      fetch(buildUrl(`/api/meta/account/${id}/active-campaigns`, p, s, u)),
    ])

    if (accRes.status === 'fulfilled') {
      const d = await accRes.value.json().catch(() => null)
      if (d && !d.error) setAccountData(d)
      else if (d?.error) setError(d.error)
    }
    setLoadingAccount(false)

    if (campRes.status === 'fulfilled') {
      const d = await campRes.value.json().catch(() => null)
      if (d?.campaigns) setCampaigns(d.campaigns)
      if (d?.name) setAccountName(d.name)
      if (d?.error && !d?.campaigns) setError(`Campanhas: ${d.error}`)
    } else {
      setError('Erro ao carregar campanhas. Verifique a conexão e o token Meta.')
    }
    setLoadingCampaigns(false)
  }, [id, buildUrl])

  useEffect(() => { fetchAll(period) }, [fetchAll, period])

  const changePeriod = (p: string, label: string) => {
    setPeriod(p); setActiveLabel(label)
    setActiveSince(''); setActiveUntil(''); setShowCustom(false)
    fetchAll(p)
  }

  const applyCustom = () => {
    if (!customFrom || !customTo) return
    setActiveSince(customFrom); setActiveUntil(customTo)
    setActiveLabel(`${customFrom} → ${customTo}`)
    setShowCustom(false)
    fetchAll(period, customFrom, customTo)
  }

  const sel = accountData?.selected
  const todaySpend = parseFloat(accountData?.today?.spend || '0')
  const weekSpend = parseFloat(accountData?.week?.spend || '0')
  const selSpend = parseFloat(sel?.spend || '0')
  const selCtr = parseFloat(sel?.ctr || '0')
  const selCpp = parseFloat(sel?.cpp || '0')
  const selResults = getResultValue(sel)
  const selCpr = getCpr(sel?.cost_per_action_type)
  const resultLabel = accountData?.resultType || 'Resultados'

  const optimizations = generateOptimizations(campaigns)

  let healthScore = 0
  if (selSpend > 0) healthScore += 30
  if (campaigns.length > 0) healthScore += 20
  if (selCpp > 0 && selCpp < 50) healthScore += 25
  if (selCtr > 1) healthScore += 15
  if (selResults > 0) healthScore += 10
  healthScore = Math.min(healthScore, 100)

  return (
    <div className="max-w-7xl">
      {/* ── Hero header ───────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-gray-900 to-blue-900 rounded-2xl p-5 mb-5 text-white">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <p className="text-xs text-white/50 uppercase tracking-wider">Conta de anúncios</p>
              <h1 className="text-xl font-bold leading-tight">{accountName || id}</h1>
              <p className="text-xs text-white/40 mt-0.5">{id}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <HealthScore score={healthScore} size="lg" />
            <Link
              href={`/relatorios/${id}`}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-medium transition-colors"
            >
              <FileText className="w-4 h-4" />
              Relatório
            </Link>
            <Link
              href={`/inteligencia/${id}`}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600/80 hover:bg-purple-500 rounded-lg text-sm font-semibold transition-colors"
            >
              <Brain className="w-4 h-4" />
              Inteligência
            </Link>
            <button
              onClick={() => fetchAll(period, activeSince || undefined, activeUntil || undefined)}
              disabled={loadingAccount && loadingCampaigns}
              className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={cn('w-4 h-4', (loadingAccount || loadingCampaigns) && 'animate-spin')} />
              Atualizar
            </button>
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <QuickStat icon={DollarSign} label="Hoje" value={formatCurrency(todaySpend)} color="text-blue-300" />
          <QuickStat icon={DollarSign} label="7 dias" value={formatCurrency(weekSpend)} color="text-purple-300" />
          <QuickStat icon={DollarSign} label={activeLabel} value={formatCurrency(selSpend)} color="text-indigo-300" />
          <QuickStat icon={BarChart2} label="CTR" value={selCtr > 0 ? `${selCtr.toFixed(2)}%` : '—'} color={selCtr >= 2 ? 'text-green-300' : selCtr >= 1 ? 'text-yellow-300' : 'text-red-300'} />
          <QuickStat icon={Users} label={resultLabel} value={selResults > 0 ? formatNumber(selResults) : '—'} color="text-green-300" />
          <QuickStat icon={ShoppingCart} label="Custo/result." value={selCpr > 0 ? formatCurrency(selCpr) : '—'} color={selCpr < 30 && selCpr > 0 ? 'text-green-300' : 'text-yellow-300'} />
        </div>
      </div>

      {/* ── Period selector ───────────────────────────────────────────────── */}
      <div className="bg-white border border-gray-200 rounded-xl p-3 mb-5">
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
          {PERIODS.map(p => (
            <button key={p.value}
              onClick={() => changePeriod(p.value, p.label)}
              disabled={loadingAccount}
              className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                activeLabel === p.label && !showCustom
                  ? 'bg-blue-600 text-white' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40'
              )}
            >{p.label}</button>
          ))}
          <button onClick={() => setShowCustom(!showCustom)}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
              showCustom || activeLabel.includes('→')
                ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
            )}>
            <Calendar className="w-3 h-3" />
            {activeLabel.includes('→') ? activeLabel : 'Personalizado'}
            <ChevronDown className={cn('w-3 h-3 transition-transform', showCustom && 'rotate-180')} />
          </button>
          {(loadingAccount || loadingCampaigns) && (
            <span className="text-xs text-gray-400 animate-pulse ml-1">carregando...</span>
          )}
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
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm mb-5">{error}</div>
      )}

      {/* ── AI Optimization Panel ─────────────────────────────────────────── */}
      <OptimizationPanel
        optimizations={optimizations}
        loading={loadingCampaigns}
      />

      {/* ── Criar Campanha ───────────────────────────────────────────────── */}
      <div className="mb-4">
        <CreateCampaignForm accountId={id} />
      </div>

      {/* ── Execution Panel ───────────────────────────────────────────────── */}
      <div className="mb-6">
        <ExecutionPanel
          accountId={id}
          accountName={accountName}
          campaigns={campaigns.map(c => ({
            id: c.id,
            name: c.name,
            status: c.effective_status,
            spend: c.insights?.spend || 0,
            results: c.insights?.results || 0,
          }))}
          spend={selSpend}
          resultLabel={resultLabel}
        />
      </div>

      {/* ── Active Campaigns Tree ─────────────────────────────────────────── */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-4">
          <TrendingUp className="w-5 h-5 text-blue-500" />
          <h2 className="text-base font-bold text-gray-900">
            Campanhas ativas
          </h2>
          {!loadingCampaigns && (
            <span className="text-xs text-gray-400">
              {campaigns.length} campanha{campaigns.length !== 1 ? 's' : ''} rodando
            </span>
          )}
        </div>
        <CampaignTree
          campaigns={campaigns}
          resultLabel={resultLabel}
          period={period}
          since={activeSince}
          until={activeUntil}
          loading={loadingCampaigns}
        />
      </div>

      {/* ── Breakdowns (collapsible) ──────────────────────────────────────── */}
      {accountData && (
        <div className="mb-8">
          <button
            onClick={() => setShowBreakdowns(v => !v)}
            className="flex items-center gap-2 mb-4 w-full text-left"
          >
            <BarChart2 className="w-5 h-5 text-gray-400" />
            <h2 className="text-base font-bold text-gray-900">Detalhamentos</h2>
            <span className="text-xs text-gray-400">— {activeLabel}</span>
            <ChevronDown className={cn('w-4 h-4 text-gray-400 ml-auto transition-transform', showBreakdowns && 'rotate-180')} />
          </button>

          {showBreakdowns && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <BreakdownTable title="Por plataforma" rows={accountData.byPlatform} resultLabel={resultLabel} />
                <BreakdownTable title="Por posicionamento (Feed / Stories / Reels)"
                  rows={accountData.byPosition} resultLabel={resultLabel}
                  note="Conversões indisponíveis neste nível" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <BreakdownTable title="Por gênero" rows={accountData.byGender} resultLabel={resultLabel} />
                <BreakdownTable title="Por faixa etária" rows={accountData.byAge} resultLabel={resultLabel} />
              </div>
              <BreakdownTable title={`Por estado — quais regiões trazem mais ${resultLabel.toLowerCase()}`}
                rows={accountData.byRegion} resultLabel={resultLabel} sortBy="results" />
              <BreakdownTable title="Por hora do dia" rows={accountData.byHour} resultLabel={resultLabel} maxRows={24} />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <BreakdownTable title="Por dia da semana" rows={accountData.byDayOfWeek} resultLabel={resultLabel} />
                <BreakdownTable title="Por semana do mês" rows={accountData.byWeekOfMonth} resultLabel={resultLabel} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
