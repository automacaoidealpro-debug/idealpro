'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Zap, Send, Loader2, Check, AlertTriangle, Info, ChevronDown, ChevronUp, Image as ImageIcon, Mic, MicOff } from 'lucide-react'
import { addLog } from '@/lib/action-log'
import { cn } from '@/lib/utils'

interface Creative {
  id: string
  name: string
  format: string
  status: string
  notes?: string
}

interface PlanAction {
  id: string
  type: string
  description: string
  entityId?: string
  params?: Record<string, string>
  risk: 'low' | 'medium' | 'high'
  estimated_impact: string
  creative_used?: string | null
}

interface Plan {
  summary: string
  actions: PlanAction[]
}

interface Campaign {
  id: string
  name: string
  status: string
  spend?: number
  results?: number
}

interface ExecutionPanelProps {
  accountId: string
  accountName: string
  campaigns: Campaign[]
  spend: number
  resultLabel: string
  analysisSummary?: string
}

const RISK_CFG = {
  low: { label: 'Baixo risco', color: 'text-green-600 bg-green-50 border-green-200' },
  medium: { label: 'Risco médio', color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  high: { label: 'Alto risco', color: 'text-red-600 bg-red-50 border-red-200' },
}

const TYPE_LABELS: Record<string, string> = {
  pause_campaign: 'Pausar campanha',
  activate_campaign: 'Ativar campanha',
  pause_adset: 'Pausar conjunto',
  activate_adset: 'Ativar conjunto',
  update_adset_budget: 'Alterar orçamento',
  update_campaign_budget: 'Alterar orçamento',
  create_campaign: 'Criar campanha',
  info: 'Recomendação',
}

const STORE_KEY = 'idealpro_criativos'

export function ExecutionPanel({ accountId, accountName, campaigns, spend, resultLabel, analysisSummary }: ExecutionPanelProps) {
  const [open, setOpen] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [plan, setPlan] = useState<Plan | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [executed, setExecuted] = useState<Record<string, 'running' | 'done' | 'error'>>({})
  const [execResults, setExecResults] = useState<Record<string, string>>({})
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [recording, setRecording] = useState(false)
  const [audioError, setAudioError] = useState('')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)

  const startRecording = useCallback(() => {
    setAudioError('')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) {
      setAudioError('Reconhecimento de voz não suportado. Use Chrome ou Safari.')
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rec: any = new SR()
    rec.lang = 'pt-BR'
    rec.continuous = true
    rec.interimResults = true
    rec.maxAlternatives = 1

    let finalTranscript = instruction

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let interim = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript
        if (e.results[i].isFinal) {
          finalTranscript += (finalTranscript && !finalTranscript.endsWith(' ') ? ' ' : '') + t
        } else {
          interim = t
        }
      }
      setInstruction(finalTranscript + (interim ? ` ${interim}` : ''))
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      if (e.error !== 'aborted') setAudioError(`Erro no microfone: ${e.error}`)
      setRecording(false)
    }

    rec.onend = () => {
      setInstruction(finalTranscript)
      setRecording(false)
    }

    recognitionRef.current = rec
    rec.start()
    setRecording(true)
  }, [instruction])

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop()
    setRecording(false)
  }, [])

  useEffect(() => {
    try {
      const store = JSON.parse(localStorage.getItem(STORE_KEY) || '{}')
      setCreatives(store[accountId] || [])
    } catch { setCreatives([]) }
  }, [accountId])

  const generatePlan = async () => {
    if (!instruction.trim()) return
    setLoading(true)
    setError('')
    setPlan(null)
    setExecuted({})
    setExecResults({})
    try {
      const res = await fetch('/api/ai/execute-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction, accountId, accountName, campaigns, creatives, spend, resultLabel, analysisSummary }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setPlan(data)
    } catch (e) {
      setError(String(e))
    } finally {
      setLoading(false)
    }
  }

  const executeAction = async (action: PlanAction) => {
    setExecuted(prev => ({ ...prev, [action.id]: 'running' }))
    try {
      const res = await fetch('/api/meta/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: action.type, entityId: action.entityId, params: action.params }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error || 'Erro na execução')
      const msg = data.message || 'Executado com sucesso'
      setExecuted(prev => ({ ...prev, [action.id]: 'done' }))
      setExecResults(prev => ({ ...prev, [action.id]: msg }))
      addLog({ accountId, accountName, action: action.description, result: 'ok', detail: msg })
    } catch (e) {
      const errMsg = String(e)
      setExecuted(prev => ({ ...prev, [action.id]: 'error' }))
      setExecResults(prev => ({ ...prev, [action.id]: errMsg }))
      addLog({ accountId, accountName, action: action.description, result: 'error', detail: errMsg })
    }
  }

  const activeCreatives = creatives.filter(c => c.status === 'ativo' || c.status === 'em_analise')

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-orange-400 to-red-500 rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <p className="font-bold text-gray-900">Painel de Execução</p>
            <p className="text-xs text-gray-400">IA executa ações nas campanhas após sua aprovação</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 p-5 space-y-4">

          {/* Creatives available */}
          {activeCreatives.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                <p className="text-xs font-semibold text-blue-700">{activeCreatives.length} criativo{activeCreatives.length !== 1 ? 's' : ''} disponíveis na pasta deste cliente</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activeCreatives.map(c => (
                  <span key={c.id} className="text-[10px] bg-white text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                    {c.name} ({c.format})
                  </span>
                ))}
              </div>
              <p className="text-[10px] text-blue-500 mt-1.5">Você pode referenciar esses criativos no seu pedido abaixo</p>
            </div>
          )}

          {/* Instruction input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-gray-700">
                O que você quer fazer nesta conta?
              </label>
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                title={recording ? 'Parar gravação' : 'Falar instrução'}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all',
                  recording
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-gray-100 text-gray-600 hover:bg-orange-100 hover:text-orange-600'
                )}
              >
                {recording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                {recording ? 'Parar' : 'Falar'}
              </button>
            </div>
            <textarea
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              placeholder={`Exemplos:\n• Pausar campanhas com CPP acima de R$80\n• Criar campanha de leads usando o criativo "Banner V2"\n• Aumentar orçamento dos conjuntos que mais convertem\n• Criar nova campanha de tráfego para o produto X`}
              rows={4}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
            />
            {recording && (
              <p className="text-[10px] text-red-500 mt-1 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                Gravando... fale sua instrução em português
              </p>
            )}
            {audioError && (
              <p className="text-[10px] text-red-500 mt-1">{audioError}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={generatePlan}
              disabled={loading || !instruction.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl text-sm font-semibold hover:from-orange-600 hover:to-red-600 disabled:opacity-50 transition-all"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {loading ? 'Gerando plano...' : 'Gerar plano com IA'}
            </button>
            <p className="text-[10px] text-gray-400">A IA vai propor ações — você aprova cada uma antes de executar</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">{error}</div>
          )}

          {/* Plan */}
          {plan && (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <p className="text-xs font-semibold text-gray-500 mb-1">PLANO DA IA</p>
                <p className="text-sm text-gray-800">{plan.summary}</p>
              </div>

              <div className="space-y-2">
                {plan.actions.map((action) => {
                  const execState = executed[action.id]
                  const execMsg = execResults[action.id]
                  const risk = RISK_CFG[action.risk] || RISK_CFG.low
                  const isInfo = action.type === 'info'

                  return (
                    <div
                      key={action.id}
                      className={cn(
                        'rounded-xl border p-4 transition-all',
                        execState === 'done' ? 'bg-green-50 border-green-200'
                        : execState === 'error' ? 'bg-red-50 border-red-200'
                        : 'bg-white border-gray-200'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5',
                          isInfo ? 'bg-blue-50' : 'bg-orange-50'
                        )}>
                          {isInfo
                            ? <Info className="w-4 h-4 text-blue-500" />
                            : <Zap className="w-4 h-4 text-orange-500" />}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                              {TYPE_LABELS[action.type] || action.type}
                            </span>
                            <span className={cn('text-[10px] px-2 py-0.5 rounded-full border font-medium', risk.color)}>
                              {risk.label}
                            </span>
                            {action.creative_used && (
                              <span className="text-[10px] bg-blue-50 text-blue-600 border border-blue-200 px-2 py-0.5 rounded-full">
                                Criativo: {action.creative_used}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-900 font-medium">{action.description}</p>
                          {action.entityId && (
                            <p className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {action.entityId}</p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">{action.estimated_impact}</p>

                          {execState === 'done' && (
                            <p className="text-xs text-green-700 mt-1.5 flex items-center gap-1">
                              <Check className="w-3 h-3" /> {execMsg}
                            </p>
                          )}
                          {execState === 'error' && (
                            <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3" /> {execMsg}
                            </p>
                          )}
                        </div>

                        {/* Action button */}
                        <div className="flex-shrink-0">
                          {execState === 'done' ? (
                            <span className="flex items-center gap-1 text-green-600 text-xs font-medium">
                              <Check className="w-4 h-4" /> Feito
                            </span>
                          ) : execState === 'running' ? (
                            <Loader2 className="w-5 h-5 text-orange-500 animate-spin" />
                          ) : execState === 'error' ? (
                            <button
                              onClick={() => executeAction(action)}
                              className="text-xs text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50"
                            >
                              Tentar novamente
                            </button>
                          ) : isInfo ? (
                            <span className="text-xs text-gray-400">Leitura</span>
                          ) : (
                            <button
                              onClick={() => executeAction(action)}
                              className="flex items-center gap-1.5 text-xs font-semibold text-white bg-orange-500 hover:bg-orange-600 px-3 py-1.5 rounded-lg transition-colors"
                            >
                              <Zap className="w-3 h-3" /> Executar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {plan.actions.filter(a => a.type !== 'info').length > 1 && (
                <p className="text-[10px] text-gray-400 text-center pt-1">
                  Execute cada ação individualmente — você pode ignorar as que não quiser
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
