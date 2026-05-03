'use client'

import { useRouter } from 'next/navigation'
import { ClientAccount } from '@/types/meta'
import { formatCurrency } from '@/lib/utils'
import { AlertTriangle, TrendingUp, Users, ShoppingCart, MessageCircle, Zap, ChevronRight } from 'lucide-react'

interface AccountCardProps {
  account: ClientAccount
  onClick?: () => void
}

const statusConfig = {
  active: { label: 'Ativo', dot: 'bg-green-400', border: 'border-l-green-400', text: 'text-green-600' },
  paused: { label: 'Pausado', dot: 'bg-yellow-400', border: 'border-l-yellow-400', text: 'text-yellow-600' },
  error: { label: 'Sem gasto', dot: 'bg-red-400', border: 'border-l-red-400', text: 'text-red-600' },
  no_campaigns: { label: 'Sem campanha', dot: 'bg-gray-300', border: 'border-l-gray-300', text: 'text-gray-400' },
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? 'text-green-600 bg-green-50 border-green-200'
    : score >= 40 ? 'text-yellow-600 bg-yellow-50 border-yellow-200'
    : 'text-red-600 bg-red-50 border-red-200'
  return (
    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${color}`}>{score}</span>
  )
}

export function AccountCard({ account, onClick }: AccountCardProps) {
  const router = useRouter()
  const status = statusConfig[account.status]
  const highAlerts = account.alerts.filter((a) => a.severity === 'high')
  const medAlerts = account.alerts.filter((a) => a.severity === 'medium')
  const allAlerts = [...highAlerts, ...medAlerts]

  const handle = () => {
    if (onClick) onClick()
    else router.push(`/clientes/${account.id}`)
  }

  const results = (account.leads || 0) + (account.purchases || 0) + (account.conversations || 0)

  return (
    <div
      onClick={handle}
      className={`bg-white rounded-xl border border-gray-200 border-l-4 ${status.border} hover:shadow-md transition-all cursor-pointer group`}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${status.dot}`} />
              <span className={`text-[10px] font-medium ${status.text}`}>{status.label}</span>
              {!account.pixel && (
                <span className="flex items-center gap-0.5 text-[10px] text-red-500 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200 ml-1">
                  <Zap className="w-2.5 h-2.5" /> Sem pixel
                </span>
              )}
            </div>
            <h3 className="font-semibold text-gray-900 text-sm leading-tight truncate">{account.name}</h3>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <ScoreBadge score={account.healthScore} />
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500 transition-colors" />
          </div>
        </div>

        {/* Spend metrics */}
        <div className="grid grid-cols-3 gap-1.5 mb-3">
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-gray-400 mb-0.5">Hoje</p>
            <p className="text-xs font-bold text-gray-900">{formatCurrency(account.dailySpend)}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-2 text-center">
            <p className="text-[10px] text-blue-400 mb-0.5">Mês</p>
            <p className="text-xs font-bold text-blue-700">{formatCurrency(account.monthlySpend)}</p>
          </div>
          <div className={`rounded-lg p-2 text-center ${account.cpp > 100 ? 'bg-red-50' : 'bg-gray-50'}`}>
            <p className={`text-[10px] mb-0.5 ${account.cpp > 100 ? 'text-red-400' : 'text-gray-400'}`}>CPP</p>
            <p className={`text-xs font-bold ${account.cpp > 100 ? 'text-red-700' : 'text-gray-900'}`}>
              {account.cpp > 0 ? formatCurrency(account.cpp) : '—'}
            </p>
          </div>
        </div>

        {/* Conversions row */}
        <div className="flex items-center gap-3 text-xs mb-3">
          {account.leads > 0 && (
            <span className="flex items-center gap-1 text-blue-600">
              <Users className="w-3 h-3" />
              <span className="font-semibold">{account.leads}</span>
              <span className="text-gray-400">leads</span>
            </span>
          )}
          {account.purchases > 0 && (
            <span className="flex items-center gap-1 text-green-600">
              <ShoppingCart className="w-3 h-3" />
              <span className="font-semibold">{account.purchases}</span>
              <span className="text-gray-400">compras</span>
            </span>
          )}
          {(account.conversations || 0) > 0 && (
            <span className="flex items-center gap-1 text-purple-600">
              <MessageCircle className="w-3 h-3" />
              <span className="font-semibold">{account.conversations}</span>
              <span className="text-gray-400">conv.</span>
            </span>
          )}
          {results === 0 && (
            <span className="text-gray-300 text-[10px]">sem resultados no mês</span>
          )}
        </div>

        {/* Footer stats */}
        <div className="flex items-center justify-between text-[10px] text-gray-400 border-t border-gray-50 pt-2">
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            {account.activeCampaigns} ativa{account.activeCampaigns !== 1 ? 's' : ''}
            {account.pausedCampaigns > 0 && ` · ${account.pausedCampaigns} pausada${account.pausedCampaigns !== 1 ? 's' : ''}`}
          </span>
          {account.ctr > 0 && (
            <span>CTR {account.ctr.toFixed(2)}%</span>
          )}
        </div>

        {/* Alerts */}
        {allAlerts.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-50 space-y-1">
            {allAlerts.slice(0, 2).map((alert, i) => (
              <div key={i} className="flex items-center gap-1.5 text-[10px]">
                <AlertTriangle className={`w-3 h-3 flex-shrink-0 ${alert.severity === 'high' ? 'text-red-500' : 'text-yellow-500'}`} />
                <span className="text-gray-500 truncate">{alert.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
