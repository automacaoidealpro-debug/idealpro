'use client'

import { useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Brain, Zap, CheckCircle, XCircle, Clock,
  AlertTriangle, TrendingUp, Pause, RefreshCw, Target,
  Users, Wrench, Play,
} from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { ExecutionPanel } from '@/components/ExecutionPanel'

interface ActionItem {
  id: string
  priority: 'high' | 'medium' | 'low'
  type: string
  title: string
  reason: string
  expected_impact: string
  entity_type: string
  entity_id: string
  entity_name: string
  execution_params: Record<string, unknown> | null
  approved: boolean
  executing: boolean
  executed: boolean
  failed: boolean
  error?: string
}

interface AudienceSuggestion {
  name: string
  type: string
  retention_days: number | null
  description: string
  base_audience: string | null
}

interface HourlyRow   { hour: number; label: string; spend: number; ctr: number; impressions: number; clicks: number }
interface DayRow      { day: number; name: string; spend: number; results: number; ctr: number; costPerResult: number; avgSpend: number }
interface WeekRow     { week: number; name: string; spend: number; results: number; ctr: number; costPerResult: number }
interface BreakRow    {
  segment: string; spend: number; results: number; ctr: number
  costPerResult?: number; resultType?: string
  leads?: number; purchases?: number; conversations?: number
}

interface PerformanceMaps {
  hourly: HourlyRow[]
  byDayOfWeek: DayRow[]
  byWeekOfMonth: WeekRow[]
  topPlatforms: BreakRow[]
  topDevices: BreakRow[]
  topCities: BreakRow[]
  topRegions: BreakRow[]
  topGender: BreakRow[]
  topAge: BreakRow[]
  bestHour: HourlyRow | null
  bestDay: DayRow | null
  bestWeek: WeekRow | null
}

interface Analysis {
  score: number
  summary: string
  critical_findings: string[]
  actions: ActionItem[]
  audience_suggestions: AudienceSuggestion[]
  campaign_structure_notes: string[]
  performance_maps?: PerformanceMaps
}

type Status = 'idle' | 'fetching' | 'analyzing' | 'done' | 'error'

const PRIORITY_CFG = {
  high:   { label: 'Urgente',      badge: 'bg-red-100 text-red-700',        dot: 'bg-red-500',    border: 'border-l-red-500'    },
  medium: { label: 'Atenção',      badge: 'bg-yellow-100 text-yellow-700',  dot: 'bg-yellow-500', border: 'border-l-yellow-500' },
  low:    { label: 'Oportunidade', badge: 'bg-green-100 text-green-700',    dot: 'bg-green-500',  border: 'border-l-green-500'  },
}

const TYPE_LABELS: Record<string, string> = {
  pause_campaign:       'Pausar Campanha',
  pause_adset:          'Pausar Conjunto',
  scale_adset:          'Escalar Conjunto',
  scale_campaign:       'Escalar Campanha',
  creative_change:      'Trocar Criativo',
  budget_reallocation:  'Redistribuir Verba',
  audience_fix:         'Corrigir Público',
  fix_tracking:         'Corrigir Rastreamento',
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  pause_campaign:      <Pause className="w-3 h-3" />,
  pause_adset:         <Pause className="w-3 h-3" />,
  scale_adset:         <TrendingUp className="w-3 h-3" />,
  scale_campaign:      <TrendingUp className="w-3 h-3" />,
  creative_change:     <Zap className="w-3 h-3" />,
  budget_reallocation: <Target className="w-3 h-3" />,
  audience_fix:        <Users className="w-3 h-3" />,
  fix_tracking:        <Wrench className="w-3 h-3" />,
}

const CAN_EXECUTE = new Set(['pause_campaign', 'pause_adset', 'unpause_campaign', 'unpause_adset', 'scale_adset', 'scale_campaign'])

function getResultLabel(resultType?: string): string {
  if (!resultType) return 'res.'
  if (resultType.includes('purchase') || resultType.includes('omni_purchase')) return 'vendas'
  if (resultType.includes('messaging') || resultType.includes('conversation')) return 'conversas'
  if (resultType === 'lead' || resultType.includes('registration')) return 'leads'
  return 'res.'
}

export default function InteligenciaPage() {
  const params = useParams()
  const id = params.id as string

  const [status, setStatus] = useState<Status>('idle')
  const [statusMsg, setStatusMsg] = useState('')
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [analysisSource, setAnalysisSource] = useState<'claude' | 'rule_engine' | null>(null)
  const [actions, setActions] = useState<ActionItem[]>([])
  const [execLog, setExecLog] = useState<{ time: string; msg: string; ok: boolean }[]>([])
  const [error, setError] = useState('')
  const [period, setPeriod] = useState('last_7d')
  const [filter, setFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [accountName, setAccountName] = useState('')
  const [accountSpend, setAccountSpend] = useState(0)
  const [resultType, setResultType] = useState('')

  const runAnalysis = useCallback(async () => {
    setStatus('fetching')
    setStatusMsg('Extraindo dados completos da conta...')
    setError('')
    setAnalysis(null)
    setActions([])
    setExecLog([])

    try {
      const dataRes = await fetch(`/api/meta/account/${id}/full-analysis?period=${period}`)
      const data = await dataRes.json()
      if (data.error) throw new Error(data.error)

      setAccountName(data.account?.name || id)
      setAccountSpend(data.account?.insights?.spend || 0)
      setResultType(data.account?.insights?.resultType || '')

      setStatus('analyzing')
      setStatusMsg('Analisando dados...')

      const aiRes = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data }),
      })
      const aiData = await aiRes.json()
      if (aiData.error) throw new Error(aiData.error)

      const result = aiData.analysis as Analysis
      setAnalysisSource(aiData._source === 'claude' ? 'claude' : 'rule_engine')

      const actionsWithState: ActionItem[] = (result.actions || []).map(a => ({
        ...a,
        approved: false,
        executing: false,
        executed: false,
        failed: false,
      }))

      setAnalysis(result)
      setActions(actionsWithState)
      setStatus('done')
    } catch (e) {
      setStatus('error')
      setError(String(e))
    }
  }, [id, period])

  const approveAction = useCallback((actionId: string) => {
    setActions(prev => prev.map(a => a.id === actionId ? { ...a, approved: true } : a))
  }, [])

  const rejectAction = useCallback((actionId: string) => {
    setActions(prev => prev.filter(a => a.id !== actionId))
  }, [])

  const approveAllHigh = useCallback(() => {
    setActions(prev => prev.map(a =>
      a.priority === 'high' && !a.executed && !a.approved ? { ...a, approved: true } : a
    ))
  }, [])

  const executeAction = useCallback(async (actionId: string) => {
    const action = actions.find(a => a.id === actionId)
    if (!action) return

    setActions(prev => prev.map(a => a.id === actionId ? { ...a, executing: true } : a))

    try {
      const res = await fetch('/api/meta/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: action.type,
          entityId: action.entity_id,
          params: action.execution_params,
        }),
      })
      const result = await res.json()
      if (result.error) throw new Error(result.error)

      setActions(prev => prev.map(a => a.id === actionId ? { ...a, executing: false, executed: true } : a))
      setExecLog(prev => [{
        time: new Date().toLocaleTimeString('pt-BR'),
        msg: `${action.title} — ${action.entity_name}`,
        ok: true,
      }, ...prev])
    } catch (e) {
      setActions(prev => prev.map(a =>
        a.id === actionId ? { ...a, executing: false, failed: true, error: String(e) } : a
      ))
      setExecLog(prev => [{
        time: new Date().toLocaleTimeString('pt-BR'),
        msg: `Falhou: ${action.title} — ${String(e)}`,
        ok: false,
      }, ...prev])
    }
  }, [actions])

  const filteredActions = actions.filter(a => filter === 'all' || a.priority === filter)
  const pendingCount = actions.filter(a => !a.executed).length
  const executedCount = actions.filter(a => a.executed).length
  const highCount = actions.filter(a => a.priority === 'high').length
  const pendingHighCount = actions.filter(a => a.priority === 'high' && !a.approved && !a.executed).length

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-gray-900 via-purple-950 to-indigo-900 text-white px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <Link
            href={`/clientes/${id}`}
            className="flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-5 w-fit transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar ao cliente
          </Link>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-600/30 rounded-2xl flex items-center justify-center border border-purple-500/30">
                <Brain className="w-6 h-6 text-purple-300" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Central de Inteligência</h1>
                <p className="text-gray-400 text-sm mt-0.5">
                  Análise profunda com IA + fila de execução aprovada
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 flex-shrink-0">
              <select
                value={period}
                onChange={e => setPeriod(e.target.value)}
                disabled={status === 'fetching' || status === 'analyzing'}
                className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                <option value="last_7d">Últimos 7 dias</option>
                <option value="last_14d">Últimos 14 dias</option>
                <option value="last_28d">Últimos 28 dias</option>
                <option value="this_month">Este mês</option>
                <option value="last_month">Mês passado</option>
              </select>

              <button
                onClick={runAnalysis}
                disabled={status === 'fetching' || status === 'analyzing'}
                className={cn(
                  'flex items-center gap-2 px-5 py-2 rounded-xl font-semibold text-sm transition-all',
                  status === 'fetching' || status === 'analyzing'
                    ? 'bg-white/10 text-white/50 cursor-not-allowed'
                    : 'bg-purple-500 hover:bg-purple-400 text-white shadow-lg'
                )}
              >
                {status === 'fetching' || status === 'analyzing'
                  ? <RefreshCw className="w-4 h-4 animate-spin" />
                  : <Brain className="w-4 h-4" />
                }
                {status === 'done' ? 'Reanalisar' : 'Analisar com IA'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">

        {/* Loading */}
        {(status === 'fetching' || status === 'analyzing') && (
          <div className="bg-white rounded-2xl border border-gray-200 p-10 text-center shadow-sm">
            <div className="w-14 h-14 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <RefreshCw className="w-7 h-7 text-purple-500 animate-spin" />
            </div>
            <p className="font-bold text-gray-900 text-base">{statusMsg}</p>
            <p className="text-sm text-gray-500 mt-1.5 max-w-sm mx-auto">
              {status === 'fetching'
                ? 'Buscando campanhas, conjuntos, anúncios, criativos e segmentações via Meta API...'
                : 'Claude está processando todos os dados e gerando recomendações priorizadas...'}
            </p>
            <div className="flex justify-center gap-8 mt-8">
              {[
                { label: 'Campanhas', done: status === 'analyzing' },
                { label: 'Conjuntos', done: status === 'analyzing' },
                { label: 'Anúncios', done: status === 'analyzing' },
                { label: 'Segmentações', done: status === 'analyzing' },
                { label: 'IA', done: false },
              ].map((step, i) => (
                <div key={step.label} className="flex flex-col items-center gap-2">
                  {step.done ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : (
                    <div className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                      i === (status === 'analyzing' ? 4 : 0)
                        ? 'border-purple-500'
                        : 'border-gray-200'
                    )}>
                      {i === (status === 'analyzing' ? 4 : 0) && (
                        <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                      )}
                    </div>
                  )}
                  <span className="text-[11px] font-medium text-gray-500">{step.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {status === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-2">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="font-semibold text-red-800">Erro na análise</p>
            </div>
            <p className="text-sm text-red-600 font-mono">{error}</p>
            {error.includes('ANTHROPIC_API_KEY') && (
              <p className="text-sm text-red-700 mt-3 font-medium bg-red-100 rounded-lg px-3 py-2">
                Adicione <code className="font-mono">ANTHROPIC_API_KEY=sua_chave</code> ao arquivo{' '}
                <code className="font-mono">.env.local</code> e reinicie o servidor.
              </p>
            )}
            <button
              onClick={runAnalysis}
              className="mt-3 text-sm text-red-600 hover:text-red-800 font-medium"
            >
              Tentar novamente →
            </button>
          </div>
        )}

        {/* Results */}
        {status === 'done' && analysis && (
          <>
            {/* Execution Panel — logo após análise */}
            <ExecutionPanel
              accountId={id}
              accountName={accountName || id}
              campaigns={[]}
              spend={accountSpend}
              resultLabel={getResultLabel(resultType)}
              analysisSummary={analysis.summary}
            />

            {/* Score + Summary */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0 text-center">
                  <div className={cn(
                    'w-20 h-20 rounded-2xl flex items-center justify-center border-4 text-2xl font-black',
                    analysis.score >= 75 ? 'border-green-400 text-green-600 bg-green-50' :
                    analysis.score >= 50 ? 'border-yellow-400 text-yellow-600 bg-yellow-50' :
                    'border-red-400 text-red-600 bg-red-50'
                  )}>
                    {analysis.score}
                  </div>
                  <p className="text-xs text-gray-500 mt-2 font-medium">
                    {analysis.score >= 75 ? '✅ Saudável' : analysis.score >= 50 ? '⚠️ Atenção' : '🚨 Crítico'}
                  </p>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="w-4 h-4 text-purple-500" />
                    <h2 className="font-bold text-gray-900">Diagnóstico</h2>
                    {analysisSource === 'claude' ? (
                      <span className="text-[10px] text-purple-600 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full font-medium">
                        ✨ Claude AI
                      </span>
                    ) : (
                      <span className="text-[10px] text-blue-600 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full font-medium">
                        ⚙️ Engine de regras
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 leading-relaxed">{analysis.summary}</p>
                  {analysis.critical_findings.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {analysis.critical_findings.map((f, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-purple-400 mt-0.5 flex-shrink-0">▸</span>
                          <span className="text-xs text-gray-600">{f}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Counts */}
              <div className="flex gap-6 mt-5 pt-5 border-t border-gray-100">
                <div>
                  <p className="text-2xl font-black text-red-500">{highCount}</p>
                  <p className="text-xs text-gray-500">Urgente{highCount !== 1 ? 's' : ''}</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-yellow-500">{actions.filter(a => a.priority === 'medium').length}</p>
                  <p className="text-xs text-gray-500">Atenção</p>
                </div>
                <div>
                  <p className="text-2xl font-black text-green-500">{actions.filter(a => a.priority === 'low').length}</p>
                  <p className="text-xs text-gray-500">Oportunidade{actions.filter(a => a.priority === 'low').length !== 1 ? 's' : ''}</p>
                </div>
                <div className="ml-auto">
                  <p className="text-2xl font-black text-blue-500">{executedCount}</p>
                  <p className="text-xs text-gray-500">Executada{executedCount !== 1 ? 's' : ''}</p>
                </div>
              </div>
            </div>

            {/* Action Queue */}
            {actions.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <Zap className="w-5 h-5 text-yellow-500" />
                    <h2 className="font-bold text-gray-900">Fila de Ações</h2>
                    {pendingCount > 0 && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                        {pendingCount} pendente{pendingCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {pendingHighCount > 0 && (
                      <button
                        onClick={approveAllHigh}
                        className="text-xs bg-red-50 text-red-600 hover:bg-red-100 px-2.5 py-1 rounded-lg font-medium transition-colors"
                      >
                        Aprovar todos urgentes ({pendingHighCount})
                      </button>
                    )}
                  </div>

                  <div className="flex gap-1">
                    {(['all', 'high', 'medium', 'low'] as const).map(p => (
                      <button
                        key={p}
                        onClick={() => setFilter(p)}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
                          filter === p ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
                        )}
                      >
                        {p === 'all' ? 'Todas' : p === 'high' ? 'Urgente' : p === 'medium' ? 'Atenção' : 'Oportunidade'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions list */}
                <div className="divide-y divide-gray-100">
                  {filteredActions.map(action => {
                    const pc = PRIORITY_CFG[action.priority]
                    const canExec = CAN_EXECUTE.has(action.type) && !!action.execution_params

                    return (
                      <div
                        key={action.id}
                        className={cn(
                          'flex items-start gap-3 p-4 border-l-4 transition-colors',
                          pc.border,
                          action.executed ? 'opacity-50 bg-gray-50' : 'hover:bg-gray-50/50'
                        )}
                      >
                        {/* Left: icon */}
                        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                          action.priority === 'high' ? 'bg-red-100 text-red-600' :
                          action.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-green-100 text-green-700'
                        )}>
                          {TYPE_ICONS[action.type] || <Zap className="w-3 h-3" />}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap mb-1">
                            <span className={cn('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded', pc.badge)}>
                              {pc.label}
                            </span>
                            <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              {TYPE_LABELS[action.type] || action.type}
                            </span>
                            <span className="text-[10px] text-gray-400 truncate max-w-[200px]">
                              {action.entity_type === 'campaign' ? '📊' : '🎯'} {action.entity_name}
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-gray-900">{action.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{action.reason}</p>
                          {action.expected_impact && (
                            <p className="text-xs text-green-700 mt-1 font-medium">
                              Impacto: {action.expected_impact}
                            </p>
                          )}
                          {action.failed && action.error && (
                            <p className="text-xs text-red-500 mt-1 font-mono">{action.error}</p>
                          )}
                          {!canExec && !action.executed && (
                            <p className="text-[10px] text-gray-400 mt-1 italic">
                              Ação manual — executar no Meta Business Manager
                            </p>
                          )}
                        </div>

                        {/* Right: buttons */}
                        <div className="flex-shrink-0 flex items-center gap-2">
                          {action.executed ? (
                            <span className="flex items-center gap-1 text-green-600 text-xs font-semibold">
                              <CheckCircle className="w-4 h-4" /> Executado
                            </span>
                          ) : action.executing ? (
                            <span className="flex items-center gap-1 text-blue-500 text-xs">
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Executando...
                            </span>
                          ) : action.failed ? (
                            <button
                              onClick={() => setActions(prev => prev.map(a =>
                                a.id === action.id ? { ...a, failed: false, error: undefined, approved: true } : a
                              ))}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                            >
                              Tentar novamente
                            </button>
                          ) : action.approved ? (
                            <div className="flex items-center gap-1.5">
                              {canExec ? (
                                <button
                                  onClick={() => executeAction(action.id)}
                                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold bg-green-500 hover:bg-green-600 text-white transition-colors"
                                >
                                  <Play className="w-3 h-3" /> Executar
                                </button>
                              ) : (
                                <span className="text-xs text-gray-400 italic">Manual</span>
                              )}
                              <button
                                onClick={() => setActions(prev => prev.map(a =>
                                  a.id === action.id ? { ...a, approved: false } : a
                                ))}
                                className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => approveAction(action.id)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                              >
                                Aprovar
                              </button>
                              <button
                                onClick={() => rejectAction(action.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-400 transition-colors"
                                title="Descartar"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {filteredActions.length === 0 && (
                    <div className="py-8 text-center">
                      <CheckCircle className="w-8 h-8 text-green-300 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">Nenhuma ação pendente nesta categoria</p>
                    </div>
                  )}
                </div>

                <div className="px-5 py-3 bg-gray-50 border-t border-gray-100">
                  <p className="text-[10px] text-gray-400">
                    ⚠️ O sistema analisa — você aprova — o sistema executa. Ações de pause/unpause são reversíveis. Alterações de orçamento são imediatas. Ações manuais precisam ser feitas no Meta Business Manager.
                  </p>
                </div>
              </div>
            )}

            {/* Performance Maps */}
            {analysis.performance_maps && (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                  <span className="text-lg">📊</span>
                  <h2 className="font-bold text-gray-900">Mapas de Performance</h2>
                  <span className="text-xs text-gray-400">onde, quando e quem converte mais</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-px bg-gray-100">

                  {/* Horários */}
                  {analysis.performance_maps.hourly.length > 0 && (
                    <div className="bg-white p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm">🕐</span>
                        <h3 className="text-sm font-bold text-gray-800">Melhor horário para anunciar</h3>
                      </div>
                      {analysis.performance_maps.bestHour && (
                        <div className="bg-blue-50 rounded-xl px-3 py-2 mb-3 flex items-center gap-2">
                          <span className="text-lg font-black text-blue-700">{analysis.performance_maps.bestHour.label}</span>
                          <div>
                            <p className="text-xs font-semibold text-blue-700">Melhor CTR</p>
                            <p className="text-[10px] text-blue-500">{analysis.performance_maps.bestHour.ctr.toFixed(2)}% — aumentar verba aqui</p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-end gap-0.5 h-20">
                        {Array.from({length: 24}, (_, h) => {
                          const row = analysis.performance_maps!.hourly.find(r => r.hour === h)
                          const maxCtr = Math.max(...analysis.performance_maps!.hourly.map(r => r.ctr), 0.01)
                          const height = row ? Math.max((row.ctr / maxCtr) * 100, 4) : 0
                          const isPeak = analysis.performance_maps!.bestHour?.hour === h
                          return (
                            <div key={h} className="flex-1 flex flex-col items-center gap-0.5" title={row ? `${h}h: CTR ${row.ctr.toFixed(2)}%` : `${h}h: sem dados`}>
                              <div
                                className={cn('w-full rounded-sm transition-all', isPeak ? 'bg-blue-500' : row ? 'bg-blue-200' : 'bg-gray-100')}
                                style={{ height: `${height}%` }}
                              />
                            </div>
                          )
                        })}
                      </div>
                      <div className="flex justify-between text-[9px] text-gray-400 mt-1">
                        <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
                      </div>
                    </div>
                  )}

                  {/* Dias da semana */}
                  {analysis.performance_maps.byDayOfWeek.length > 0 && (
                    <div className="bg-white p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm">📅</span>
                        <h3 className="text-sm font-bold text-gray-800">Dias da semana</h3>
                      </div>
                      {analysis.performance_maps.bestDay && (
                        <div className="bg-green-50 rounded-xl px-3 py-2 mb-3 flex items-center gap-2">
                          <span className="text-sm font-black text-green-700">{analysis.performance_maps.bestDay.name}</span>
                          <div>
                            <p className="text-xs font-semibold text-green-700">Melhor dia — focar atendimento</p>
                            <p className="text-[10px] text-green-500">
                              {analysis.performance_maps.bestDay.results > 0
                                ? `${analysis.performance_maps.bestDay.results} resultados`
                                : `CTR ${analysis.performance_maps.bestDay.ctr.toFixed(2)}%`}
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="space-y-1.5">
                        {['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map((name, i) => {
                          const row = analysis.performance_maps!.byDayOfWeek.find(d => d.day === i)
                          const maxSpend = Math.max(...analysis.performance_maps!.byDayOfWeek.map(d => d.spend), 0.01)
                          const pct = row ? (row.spend / maxSpend) * 100 : 0
                          const isHot = analysis.performance_maps!.bestDay?.day === i
                          return (
                            <div key={i} className="flex items-center gap-2">
                              <span className={cn('text-[10px] font-semibold w-7 flex-shrink-0', isHot ? 'text-green-600' : 'text-gray-500')}>{name}</span>
                              <div className="flex-1 bg-gray-100 rounded-full h-4 relative overflow-hidden">
                                <div
                                  className={cn('h-full rounded-full transition-all flex items-center pl-2', isHot ? 'bg-green-400' : 'bg-blue-200')}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              {row && (
                                <span className="text-[10px] text-gray-500 w-12 text-right flex-shrink-0">
                                  {row.results > 0 ? `${row.results} res.` : `${row.ctr.toFixed(1)}%`}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Semanas do mês */}
                  {analysis.performance_maps.byWeekOfMonth.length > 0 && (
                    <div className="bg-white p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-sm">🗓️</span>
                        <h3 className="text-sm font-bold text-gray-800">Semanas do mês</h3>
                      </div>
                      {analysis.performance_maps.bestWeek && (
                        <div className="bg-purple-50 rounded-xl px-3 py-2 mb-3 flex items-center gap-2">
                          <span className="text-sm font-black text-purple-700">{analysis.performance_maps.bestWeek.name}</span>
                          <div>
                            <p className="text-xs font-semibold text-purple-700">Ideal para promoções</p>
                            <p className="text-[10px] text-purple-500">
                              {analysis.performance_maps.bestWeek.results > 0 ? `${analysis.performance_maps.bestWeek.results} resultados` : 'maior engajamento'}
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-4 gap-2">
                        {[1,2,3,4].map(w => {
                          const row = analysis.performance_maps!.byWeekOfMonth.find(d => d.week === w)
                          const isHot = analysis.performance_maps!.bestWeek?.week === w
                          return (
                            <div key={w} className={cn('rounded-xl p-3 text-center border-2 transition-colors',
                              isHot ? 'bg-purple-50 border-purple-300' : 'bg-gray-50 border-gray-200'
                            )}>
                              <p className={cn('text-xs font-bold', isHot ? 'text-purple-700' : 'text-gray-500')}>{w}ª sem.</p>
                              {row ? (
                                <>
                                  <p className={cn('text-sm font-black mt-1', isHot ? 'text-purple-800' : 'text-gray-700')}>
                                    {row.results > 0 ? row.results : `${row.ctr.toFixed(1)}%`}
                                  </p>
                                  <p className="text-[9px] text-gray-400">{row.results > 0 ? 'resultados' : 'CTR'}</p>
                                </>
                              ) : <p className="text-[10px] text-gray-300 mt-2">sem dados</p>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Posicionamento — plataforma + dispositivo com conversões */}
                  {((analysis.performance_maps.topPlatforms ?? []).length > 0 || (analysis.performance_maps.topDevices ?? []).length > 0) && (
                    <div className="bg-white sm:col-span-2">
                      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
                        <span className="text-sm">📱</span>
                        <h3 className="text-sm font-bold text-gray-800">Posicionamento — leads, vendas e conversas por plataforma e dispositivo</h3>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-gray-100 pb-5">
                        {/* Tabela Plataforma */}
                        {(analysis.performance_maps.topPlatforms ?? []).length > 0 && (() => {
                          const rows = [...(analysis.performance_maps!.topPlatforms ?? [])].sort((a, b) => (b.results - a.results) || (b.spend - a.spend))
                          const hasConv = rows.some(r => r.results > 0)
                          const platformLabel: Record<string, string> = {
                            facebook: '🔵 Facebook',
                            instagram: '📸 Instagram',
                            audience_network: '🌐 Audience Network',
                            messenger: '💬 Messenger',
                          }
                          return (
                            <div>
                              <p className="px-5 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide">Por Plataforma</p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-gray-50 border-y border-gray-100">
                                      <th className="text-left px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase">Plataforma</th>
                                      <th className="text-center px-2 py-2 text-[10px] font-semibold text-blue-500 uppercase">Leads</th>
                                      <th className="text-center px-2 py-2 text-[10px] font-semibold text-emerald-600 uppercase">Vendas</th>
                                      <th className="text-center px-2 py-2 text-[10px] font-semibold text-purple-600 uppercase">Conv.</th>
                                      <th className="text-right px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase">Gasto</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-50">
                                    {rows.map((p, i) => {
                                      const leads = p.leads ?? 0
                                      const purchases = p.purchases ?? 0
                                      const convs = p.conversations ?? 0
                                      const isTop = i === 0 && hasConv
                                      return (
                                        <tr key={i} className={cn('hover:bg-gray-50/80', isTop && 'bg-blue-50/40')}>
                                          <td className={cn('px-5 py-2.5 font-semibold', isTop ? 'text-gray-900' : 'text-gray-700')}>
                                            {platformLabel[p.segment] ?? p.segment}
                                          </td>
                                          <td className="px-2 py-2.5 text-center">
                                            {leads > 0 ? <span className="inline-block bg-blue-100 text-blue-700 font-black px-2 py-0.5 rounded text-[11px]">{leads}</span> : <span className="text-gray-200">—</span>}
                                          </td>
                                          <td className="px-2 py-2.5 text-center">
                                            {purchases > 0 ? <span className="inline-block bg-emerald-100 text-emerald-700 font-black px-2 py-0.5 rounded text-[11px]">{purchases}</span> : <span className="text-gray-200">—</span>}
                                          </td>
                                          <td className="px-2 py-2.5 text-center">
                                            {convs > 0 ? <span className="inline-block bg-purple-100 text-purple-700 font-black px-2 py-0.5 rounded text-[11px]">{convs}</span> : <span className="text-gray-200">—</span>}
                                          </td>
                                          <td className="px-5 py-2.5 text-right text-gray-500">{formatCurrency(p.spend)}</td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )
                        })()}

                        {/* Tabela Dispositivo */}
                        {(analysis.performance_maps.topDevices ?? []).length > 0 && (() => {
                          const rows = [...(analysis.performance_maps!.topDevices ?? [])].sort((a, b) => (b.results - a.results) || (b.spend - a.spend))
                          const hasConv = rows.some(r => r.results > 0)
                          const deviceLabel: Record<string, string> = {
                            mobile: '📱 Mobile',
                            desktop: '🖥️ Desktop',
                            tablet: '📲 Tablet',
                            mobile_app: '📱 App Mobile',
                            connected_tv: '📺 TV Conectada',
                          }
                          return (
                            <div>
                              <p className="px-5 py-2 text-[11px] font-bold text-gray-500 uppercase tracking-wide">Por Dispositivo</p>
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="bg-gray-50 border-y border-gray-100">
                                      <th className="text-left px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase">Dispositivo</th>
                                      <th className="text-center px-2 py-2 text-[10px] font-semibold text-blue-500 uppercase">Leads</th>
                                      <th className="text-center px-2 py-2 text-[10px] font-semibold text-emerald-600 uppercase">Vendas</th>
                                      <th className="text-center px-2 py-2 text-[10px] font-semibold text-purple-600 uppercase">Conv.</th>
                                      <th className="text-right px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase">Gasto</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-50">
                                    {rows.map((d, i) => {
                                      const leads = d.leads ?? 0
                                      const purchases = d.purchases ?? 0
                                      const convs = d.conversations ?? 0
                                      const isTop = i === 0 && hasConv
                                      return (
                                        <tr key={i} className={cn('hover:bg-gray-50/80', isTop && 'bg-emerald-50/40')}>
                                          <td className={cn('px-5 py-2.5 font-semibold', isTop ? 'text-gray-900' : 'text-gray-700')}>
                                            {deviceLabel[d.segment] ?? d.segment}
                                          </td>
                                          <td className="px-2 py-2.5 text-center">
                                            {leads > 0 ? <span className="inline-block bg-blue-100 text-blue-700 font-black px-2 py-0.5 rounded text-[11px]">{leads}</span> : <span className="text-gray-200">—</span>}
                                          </td>
                                          <td className="px-2 py-2.5 text-center">
                                            {purchases > 0 ? <span className="inline-block bg-emerald-100 text-emerald-700 font-black px-2 py-0.5 rounded text-[11px]">{purchases}</span> : <span className="text-gray-200">—</span>}
                                          </td>
                                          <td className="px-2 py-2.5 text-center">
                                            {convs > 0 ? <span className="inline-block bg-purple-100 text-purple-700 font-black px-2 py-0.5 rounded text-[11px]">{convs}</span> : <span className="text-gray-200">—</span>}
                                          </td>
                                          <td className="px-5 py-2.5 text-right text-gray-500">{formatCurrency(d.spend)}</td>
                                        </tr>
                                      )
                                    })}
                                  </tbody>
                                </table>
                              </div>
                              {!hasConv && (
                                <p className="text-[10px] text-amber-600 bg-amber-50 rounded-lg mx-5 px-2 py-1.5 mt-2">
                                  Sem conversões por dispositivo — verifique Pixel e eventos de conversão.
                                </p>
                              )}
                            </div>
                          )
                        })()}
                      </div>

                      <p className="text-[10px] text-gray-400 px-5 pb-4">
                        * Posição detalhada (feed/stories/reels) não traz coluna de conversão — limitação da API do Meta nessa combinação de breakdown.
                      </p>
                    </div>
                  )}

                  {/* Origem dos Resultados por Localização */}
                  {(analysis.performance_maps.topCities.length > 0 || analysis.performance_maps.topRegions.length > 0) && (
                    <div className="bg-white sm:col-span-2">
                      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
                        <span className="text-sm">📍</span>
                        <h3 className="text-sm font-bold text-gray-800">De onde vêm leads, vendas e conversas</h3>
                      </div>
                      <p className="text-[10px] text-orange-600 bg-orange-50 mx-5 rounded-lg px-2 py-1.5 mb-4 leading-relaxed">
                        ⚠️ Meta API mostra cidade/estado — não bairro. Para comparar Tatuapé vs Itaim Paulista crie conjuntos com raio de 2km em cada bairro.
                      </p>

                      {/* Tabela Cidades */}
                      {analysis.performance_maps.topCities.length > 0 && (() => {
                        const rows = [...analysis.performance_maps!.topCities]
                          .sort((a, b) => (b.results - a.results) || (b.spend - a.spend))
                          .slice(0, 12)
                        const hasConv = rows.some(r => r.results > 0)
                        return (
                          <div className="mb-4">
                            <div className="px-5 mb-1 flex items-center gap-2">
                              <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">🏙️ Por Cidade</span>
                              {!hasConv && (
                                <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                                  Pixel sem conversões registradas — mostrando gasto
                                </span>
                              )}
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-gray-50 border-y border-gray-100">
                                    <th className="text-left px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-8">#</th>
                                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Cidade</th>
                                    <th className="text-center px-3 py-2 text-[10px] font-semibold text-blue-500 uppercase tracking-wide">Leads</th>
                                    <th className="text-center px-3 py-2 text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Vendas</th>
                                    <th className="text-center px-3 py-2 text-[10px] font-semibold text-purple-600 uppercase tracking-wide">Conversas</th>
                                    <th className="text-right px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Gasto</th>
                                    <th className="text-right px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Custo/res.</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {rows.map((city, i) => {
                                    const name = city.segment.split(',')[0]
                                    const leads = city.leads ?? 0
                                    const purchases = city.purchases ?? 0
                                    const convs = city.conversations ?? 0
                                    const isTop = i === 0 && hasConv
                                    return (
                                      <tr key={i} className={cn('hover:bg-gray-50/80', isTop && 'bg-green-50/60')}>
                                        <td className={cn('px-5 py-2.5 text-[10px] font-bold', isTop ? 'text-green-600' : 'text-gray-300')}>{i + 1}</td>
                                        <td className={cn('px-3 py-2.5 font-semibold', isTop ? 'text-gray-900' : 'text-gray-700')}>{name}</td>
                                        <td className="px-3 py-2.5 text-center">
                                          {leads > 0
                                            ? <span className="inline-block bg-blue-100 text-blue-700 font-black px-2 py-0.5 rounded text-[11px]">{leads}</span>
                                            : <span className="text-gray-200">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                          {purchases > 0
                                            ? <span className="inline-block bg-emerald-100 text-emerald-700 font-black px-2 py-0.5 rounded text-[11px]">{purchases}</span>
                                            : <span className="text-gray-200">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                          {convs > 0
                                            ? <span className="inline-block bg-purple-100 text-purple-700 font-black px-2 py-0.5 rounded text-[11px]">{convs}</span>
                                            : <span className="text-gray-200">—</span>}
                                        </td>
                                        <td className="px-5 py-2.5 text-right text-gray-500">{formatCurrency(city.spend)}</td>
                                        <td className="px-5 py-2.5 text-right text-gray-400">
                                          {city.costPerResult && city.results > 0 ? formatCurrency(city.costPerResult) : <span className="text-gray-200">—</span>}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )
                      })()}

                      {/* Tabela Estados */}
                      {analysis.performance_maps.topRegions.length > 0 && (() => {
                        const rows = [...analysis.performance_maps!.topRegions]
                          .sort((a, b) => (b.results - a.results) || (b.spend - a.spend))
                          .slice(0, 10)
                        const hasConv = rows.some(r => r.results > 0)
                        return (
                          <div className="pb-5">
                            <div className="px-5 mb-1 flex items-center gap-2">
                              <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">🗺️ Por Estado / Região</span>
                              {!hasConv && (
                                <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                                  sem conversões registradas
                                </span>
                              )}
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="bg-gray-50 border-y border-gray-100">
                                    <th className="text-left px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide w-8">#</th>
                                    <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Estado</th>
                                    <th className="text-center px-3 py-2 text-[10px] font-semibold text-blue-500 uppercase tracking-wide">Leads</th>
                                    <th className="text-center px-3 py-2 text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Vendas</th>
                                    <th className="text-center px-3 py-2 text-[10px] font-semibold text-purple-600 uppercase tracking-wide">Conversas</th>
                                    <th className="text-right px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Gasto</th>
                                    <th className="text-right px-5 py-2 text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Custo/res.</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {rows.map((region, i) => {
                                    const leads = region.leads ?? 0
                                    const purchases = region.purchases ?? 0
                                    const convs = region.conversations ?? 0
                                    const isTop = i === 0 && hasConv
                                    return (
                                      <tr key={i} className={cn('hover:bg-gray-50/80', isTop && 'bg-purple-50/60')}>
                                        <td className={cn('px-5 py-2.5 text-[10px] font-bold', isTop ? 'text-purple-600' : 'text-gray-300')}>{i + 1}</td>
                                        <td className={cn('px-3 py-2.5 font-semibold', isTop ? 'text-gray-900' : 'text-gray-700')}>{region.segment}</td>
                                        <td className="px-3 py-2.5 text-center">
                                          {leads > 0
                                            ? <span className="inline-block bg-blue-100 text-blue-700 font-black px-2 py-0.5 rounded text-[11px]">{leads}</span>
                                            : <span className="text-gray-200">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                          {purchases > 0
                                            ? <span className="inline-block bg-emerald-100 text-emerald-700 font-black px-2 py-0.5 rounded text-[11px]">{purchases}</span>
                                            : <span className="text-gray-200">—</span>}
                                        </td>
                                        <td className="px-3 py-2.5 text-center">
                                          {convs > 0
                                            ? <span className="inline-block bg-purple-100 text-purple-700 font-black px-2 py-0.5 rounded text-[11px]">{convs}</span>
                                            : <span className="text-gray-200">—</span>}
                                        </td>
                                        <td className="px-5 py-2.5 text-right text-gray-500">{formatCurrency(region.spend)}</td>
                                        <td className="px-5 py-2.5 text-right text-gray-400">
                                          {region.costPerResult && region.results > 0 ? formatCurrency(region.costPerResult) : <span className="text-gray-200">—</span>}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  )}

                  {/* Gênero + Idade */}
                  {(analysis.performance_maps.topGender.length > 0 || analysis.performance_maps.topAge.length > 0) && (
                    <div className="bg-white p-5 sm:col-span-2">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-sm">👥</span>
                        <h3 className="text-sm font-bold text-gray-800">Público que mais converte</h3>
                      </div>
                      <div className="grid grid-cols-2 gap-6">
                        {analysis.performance_maps.topGender.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-2">Gênero</p>
                            <div className="space-y-2">
                              {analysis.performance_maps.topGender.map((g, i) => {
                                const maxSpend = Math.max(...analysis.performance_maps!.topGender.map(x => x.spend), 1)
                                return (
                                  <div key={i} className="flex items-center gap-2">
                                    <span className="text-[11px] text-gray-600 w-16 flex-shrink-0">
                                      {g.segment === 'male' ? '👨 Homens' : g.segment === 'female' ? '👩 Mulheres' : g.segment}
                                    </span>
                                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                                      <div className="h-full bg-pink-300 rounded-full" style={{ width: `${(g.spend/maxSpend)*100}%` }} />
                                    </div>
                                    <span className="text-[10px] text-gray-500 w-12 text-right flex-shrink-0">
                                      {g.results > 0 ? `${g.results} res.` : `${g.ctr.toFixed(1)}%`}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        {analysis.performance_maps.topAge.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-2">Faixa etária</p>
                            <div className="space-y-2">
                              {analysis.performance_maps.topAge.slice(0, 6).map((a, i) => {
                                const maxSpend = Math.max(...analysis.performance_maps!.topAge.map(x => x.spend), 1)
                                const isTop = a.results > 0 && i === 0
                                return (
                                  <div key={i} className="flex items-center gap-2">
                                    <span className={cn('text-[11px] w-16 flex-shrink-0', isTop ? 'font-bold text-green-700' : 'text-gray-600')}>{a.segment}</span>
                                    <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                                      <div className={cn('h-full rounded-full', isTop ? 'bg-green-400' : 'bg-orange-200')} style={{ width: `${(a.spend/maxSpend)*100}%` }} />
                                    </div>
                                    <span className="text-[10px] text-gray-500 w-12 text-right flex-shrink-0">
                                      {a.results > 0 ? `${a.results} res.` : `${a.ctr.toFixed(1)}%`}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}

            {/* Audiences */}
            {analysis.audience_suggestions?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-indigo-500" />
                  <h2 className="font-bold text-gray-900">Públicos Sugeridos</h2>
                  <span className="text-xs text-gray-400">criação via Gerenciador de Anúncios</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {analysis.audience_suggestions.map((s, i) => (
                    <div key={i} className="flex items-start gap-3 p-3.5 bg-indigo-50 rounded-xl border border-indigo-100">
                      <span className="text-xl flex-shrink-0">
                        {s.type === 'lookalike' ? '🎯' : s.type === 'website_visitors' ? '🌐' : s.type === 'engagement' ? '📱' : '📋'}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-indigo-800">{s.name}</p>
                        <p className="text-xs text-indigo-600 mt-0.5 leading-relaxed">{s.description}</p>
                        {s.retention_days && (
                          <span className="text-[10px] text-indigo-400 mt-1 block">Janela: {s.retention_days} dias</span>
                        )}
                        {s.base_audience && (
                          <span className="text-[10px] text-indigo-400 block">Base: {s.base_audience}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Campaign structure notes */}
            {analysis.campaign_structure_notes?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-gray-500" />
                  <h2 className="font-bold text-gray-900 text-sm">Estrutura de Campanha</h2>
                </div>
                <ul className="space-y-2">
                  {analysis.campaign_structure_notes.map((note, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-gray-300 mt-0.5">▸</span>
                      <p className="text-xs text-gray-600 leading-relaxed">{note}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Execution log */}
            {execLog.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <h2 className="font-bold text-gray-900 text-sm">Log de Execução</h2>
                </div>
                <div className="space-y-1.5">
                  {execLog.map((log, i) => (
                    <div key={i} className="flex items-center gap-3 text-xs">
                      <span className="text-gray-400 font-mono flex-shrink-0">{log.time}</span>
                      <span className={log.ok ? 'text-green-600' : 'text-red-500'}>
                        {log.ok ? '✅' : '❌'} {log.msg}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Idle */}
        {status === 'idle' && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
            <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
              <Brain className="w-8 h-8 text-purple-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Super Máquina de Otimização</h2>
            <p className="text-sm text-gray-500 max-w-md mx-auto mb-8 leading-relaxed">
              Extrai o máximo de dados da Meta API, analisa com Claude AI e gera uma fila de ações
              priorizadas prontas para aprovação e execução com 1 clique.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-xl mx-auto mb-8 text-left">
              {[
                { icon: '🔍', title: 'Extração total', desc: 'campanhas, conjuntos, anúncios, segmentações, públicos' },
                { icon: '🧠', title: 'Claude AI', desc: 'diagnóstico profundo baseado nos dados reais da conta' },
                { icon: '⚡', title: 'Fila priorizada', desc: 'urgente → atenção → oportunidade' },
                { icon: '🎯', title: 'Execução segura', desc: 'toda ação requer aprovação humana' },
              ].map(item => (
                <div key={item.title} className="flex flex-col gap-2 p-3 bg-gray-50 rounded-xl">
                  <span className="text-2xl">{item.icon}</span>
                  <p className="text-xs font-semibold text-gray-800">{item.title}</p>
                  <p className="text-[10px] text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            <button
              onClick={runAnalysis}
              className="inline-flex items-center gap-2.5 px-7 py-3.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg hover:shadow-purple-500/30"
            >
              <Brain className="w-5 h-5" />
              Iniciar Análise com IA
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
