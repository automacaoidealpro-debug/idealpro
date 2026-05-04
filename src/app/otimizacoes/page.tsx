'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Zap, RefreshCw, AlertTriangle, TrendingDown, TrendingUp, DollarSign, Brain, MessageSquare } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'
import { getTargets, AccountTarget } from '@/lib/account-targets'

interface Account {
  id: string
  name: string
  spend: number
  results: number
  cpp: number
  ctr: number
  impressions: number
  clicks: number
  frequency: number
  type: 'lead' | 'ecommerce' | 'conversa'
}

interface Alert {
  level: 'critical' | 'warning' | 'opportunity'
  icon: React.ReactNode
  title: string
  detail: string
}

function getAlerts(acc: Account, targetCpp?: number): Alert[] {
  const alerts: Alert[] = []

  if (acc.spend > 0 && acc.results === 0) {
    alerts.push({
      level: 'critical',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      title: 'Sem conversões',
      detail: `Gastou ${formatCurrency(acc.spend)} sem nenhum resultado — verificar pixel e segmentação`,
    })
  }

  if (acc.cpp > 0 && acc.results > 0) {
    if (targetCpp) {
      if (acc.cpp > targetCpp * 1.5) {
        alerts.push({
          level: 'critical',
          icon: <DollarSign className="w-3.5 h-3.5" />,
          title: 'CPP acima da meta',
          detail: `${formatCurrency(acc.cpp)} vs meta de ${formatCurrency(targetCpp)} — 50% acima do alvo`,
        })
      } else if (acc.cpp > targetCpp) {
        alerts.push({
          level: 'warning',
          icon: <DollarSign className="w-3.5 h-3.5" />,
          title: 'CPP acima da meta',
          detail: `${formatCurrency(acc.cpp)} vs meta de ${formatCurrency(targetCpp)} — ajustar campanhas`,
        })
      } else if (acc.cpp < targetCpp * 0.7 && acc.results > 5) {
        alerts.push({
          level: 'opportunity',
          icon: <TrendingUp className="w-3.5 h-3.5" />,
          title: 'Escalar agora',
          detail: `CPP ${formatCurrency(acc.cpp)} — 30% abaixo da meta de ${formatCurrency(targetCpp)}, considerar aumentar orçamento`,
        })
      }
    } else {
      if (acc.cpp > 100) {
        alerts.push({
          level: 'critical',
          icon: <DollarSign className="w-3.5 h-3.5" />,
          title: 'CPP muito alto',
          detail: `Custo por resultado de ${formatCurrency(acc.cpp)} — acima de R$100`,
        })
      } else if (acc.cpp > 50) {
        alerts.push({
          level: 'warning',
          icon: <DollarSign className="w-3.5 h-3.5" />,
          title: 'CPP elevado',
          detail: `Custo por resultado de ${formatCurrency(acc.cpp)} — atenção`,
        })
      } else if (acc.cpp < 20 && acc.results > 5) {
        alerts.push({
          level: 'opportunity',
          icon: <TrendingUp className="w-3.5 h-3.5" />,
          title: 'Escalar agora',
          detail: `CPP de ${formatCurrency(acc.cpp)} — ótimo resultado, considerar aumentar orçamento`,
        })
      }
    }
  }

  if (acc.ctr < 0.5 && acc.impressions > 5000) {
    alerts.push({
      level: 'warning',
      icon: <TrendingDown className="w-3.5 h-3.5" />,
      title: 'CTR baixo',
      detail: `CTR de ${acc.ctr.toFixed(2)}% — criativo pode estar cansado`,
    })
  }

  if (acc.frequency > 6 && acc.impressions > 5000) {
    alerts.push({
      level: 'critical',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      title: 'Frequência muito alta',
      detail: `Frequência de ${acc.frequency.toFixed(1)} — mesmo público vendo o anúncio muitas vezes, trocar criativo urgente`,
    })
  } else if (acc.frequency > 3.5 && acc.impressions > 5000) {
    alerts.push({
      level: 'warning',
      icon: <AlertTriangle className="w-3.5 h-3.5" />,
      title: 'Frequência elevada',
      detail: `Frequência de ${acc.frequency.toFixed(1)} — considerar novo criativo ou ampliar público`,
    })
  }

  return alerts
}

const LEVEL_CFG = {
  critical:    { border: 'border-l-red-500',    badge: 'bg-red-100 text-red-700',       dot: 'bg-red-500' },
  warning:     { border: 'border-l-yellow-500', badge: 'bg-yellow-100 text-yellow-700', dot: 'bg-yellow-500' },
  opportunity: { border: 'border-l-green-500',  badge: 'bg-green-100 text-green-700',   dot: 'bg-green-500' },
}

export default function OtimizacoesPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [targets, setTargets] = useState<Record<string, AccountTarget>>({})

  useEffect(() => {
    setTargets(getTargets())
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/meta/report?period=last_7d')
      const data = await res.json()
      setAccounts(data.rows || [])
      setLastUpdated(new Date())
    } catch { setAccounts([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const accountsWithAlerts = accounts
    .map(acc => ({ acc, alerts: getAlerts(acc, targets[acc.id]?.targetCpp) }))
    .filter(x => x.alerts.length > 0)
    .sort((a, b) => {
      const priority = (alerts: Alert[]) =>
        alerts.filter(a => a.level === 'critical').length * 10 +
        alerts.filter(a => a.level === 'warning').length * 2 +
        alerts.filter(a => a.level === 'opportunity').length
      return priority(b.alerts) - priority(a.alerts)
    })

  const criticalCount = accountsWithAlerts.filter(x => x.alerts.some(a => a.level === 'critical')).length
  const warningCount  = accountsWithAlerts.filter(x => x.alerts.some(a => a.level === 'warning') && !x.alerts.some(a => a.level === 'critical')).length
  const oppCount      = accountsWithAlerts.filter(x => x.alerts.every(a => a.level === 'opportunity')).length

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-gray-900 via-orange-950 to-gray-900 text-white px-4 sm:px-6 py-6 sm:py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-600/30 rounded-2xl flex items-center justify-center border border-orange-500/30 flex-shrink-0">
                <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-orange-300" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-bold">Otimizações</h1>
                <p className="text-gray-400 text-xs sm:text-sm mt-0.5">
                  {lastUpdated ? `Atualizado às ${lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : 'Analisando...'}
                </p>
              </div>
            </div>
            <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-xs font-medium transition-all">
              <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>

          {!loading && (
            <div className="flex gap-4 sm:gap-6 mt-5">
              {[
                { val: criticalCount, label: 'Crítico', color: 'text-red-400' },
                { val: warningCount,  label: 'Atenção',  color: 'text-yellow-400' },
                { val: oppCount,      label: 'Oportunidade', color: 'text-green-400' },
                { val: accounts.length - accountsWithAlerts.length, label: 'Saudável', color: 'text-white' },
              ].map(s => (
                <div key={s.label}>
                  <p className={cn('text-xl sm:text-2xl font-black', s.color)}>{s.val}</p>
                  <p className="text-[10px] sm:text-xs text-gray-400">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 space-y-3">
        {loading ? (
          [1,2,3,4].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-200 p-4 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-3" />
              <div className="h-3 bg-gray-100 rounded w-3/4" />
            </div>
          ))
        ) : accountsWithAlerts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Zap className="w-7 h-7 text-green-500" />
            </div>
            <p className="font-bold text-gray-900">Tudo em ordem!</p>
            <p className="text-sm text-gray-400 mt-1">Nenhuma otimização urgente nos últimos 7 dias</p>
          </div>
        ) : (
          accountsWithAlerts.map(({ acc, alerts }) => {
            const whatsapp = targets[acc.id]?.whatsapp
            const notifyMsg = `Olá! Identificamos alertas nas suas campanhas:\n${alerts.map(a => `• ${a.title}: ${a.detail}`).join('\n')}\nEntre em contato para ajustarmos.`
            return (
            <div key={acc.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-gray-100">
                <div className="min-w-0">
                  <p className="font-bold text-gray-900 text-sm truncate">{acc.name}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    7d: {formatCurrency(acc.spend)} · {acc.results} resultado{acc.results !== 1 ? 's' : ''}
                    {acc.cpp > 0 ? ` · CPP ${formatCurrency(acc.cpp)}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                  {whatsapp && (
                    <button
                      onClick={() => window.open(`https://wa.me/${whatsapp}?text=${encodeURIComponent(notifyMsg)}`, '_blank')}
                      className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition-colors border border-green-200"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Notificar</span>
                    </button>
                  )}
                  <Link href={`/inteligencia/${acc.id}`} className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 bg-purple-50 hover:bg-purple-100 px-3 py-1.5 rounded-lg transition-colors">
                    <Brain className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Analisar</span>
                  </Link>
                </div>
              </div>
              <div className="divide-y divide-gray-50">
                {alerts.map((alert, i) => {
                  const cfg = LEVEL_CFG[alert.level]
                  return (
                    <div key={i} className={cn('flex items-start gap-3 px-4 sm:px-5 py-3 border-l-4', cfg.border)}>
                      <span className={cn('flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5', cfg.badge)}>
                        {alert.icon}
                        {alert.level === 'critical' ? 'Crítico' : alert.level === 'warning' ? 'Atenção' : 'Oportunidade'}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{alert.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{alert.detail}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            )
          })
        )}
      </div>
    </div>
  )
}
