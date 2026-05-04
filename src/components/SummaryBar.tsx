'use client'

import { ClientAccount } from '@/types/meta'
import { formatCurrency } from '@/lib/utils'
import { Activity, TrendingUp, TrendingDown, Users, ShoppingCart, MessageCircle, AlertTriangle } from 'lucide-react'

interface SummaryBarProps {
  accounts: ClientAccount[]
}

function SpendArrow({ current, prev }: { current: number; prev: number }) {
  if (!prev || prev === 0) return null
  const pct = ((current - prev) / prev) * 100
  const absPct = Math.abs(pct).toFixed(0)
  return (
    <span className={`flex items-center gap-0.5 text-[9px] font-bold ${pct <= 0 ? 'text-green-600' : 'text-red-500'}`}>
      {pct > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
      {absPct}% vs mês ant.
    </span>
  )
}

export function SummaryBar({ accounts }: SummaryBarProps) {
  const active = accounts.filter((a) => a.status === 'active')
  const totalDailySpend = accounts.reduce((s, a) => s + a.dailySpend, 0)
  const totalMonthlySpend = accounts.reduce((s, a) => s + a.monthlySpend, 0)
  const totalLastMonthSpend = accounts.reduce((s, a) => s + (a.lastMonthSpend || 0), 0)
  const totalLeads = accounts.reduce((s, a) => s + (a.leads || 0), 0)
  const totalPurchases = accounts.reduce((s, a) => s + (a.purchases || 0), 0)
  const totalConversations = accounts.reduce((s, a) => s + (a.conversations || 0), 0)
  const alertCount = accounts.reduce((s, a) => s + a.alerts.filter(al => al.severity === 'high').length, 0)
  const totalResults = totalLeads + totalPurchases + totalConversations

  const stats = [
    {
      icon: Activity,
      label: 'Contas ativas',
      value: `${active.length}/${accounts.length}`,
      sub: `${accounts.length - active.length} inativas`,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      extra: null,
    },
    {
      icon: TrendingUp,
      label: 'Gasto hoje',
      value: formatCurrency(totalDailySpend),
      sub: `mês: ${formatCurrency(totalMonthlySpend)}`,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      extra: totalLastMonthSpend > 0 ? <SpendArrow current={totalMonthlySpend} prev={totalLastMonthSpend} /> : null,
    },
    {
      icon: Users,
      label: 'Leads (mês)',
      value: totalLeads.toLocaleString('pt-BR'),
      sub: totalResults > 0 ? `${Math.round(totalLeads / totalResults * 100)}% dos resultados` : '—',
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      extra: null,
    },
    {
      icon: ShoppingCart,
      label: 'Compras (mês)',
      value: totalPurchases.toLocaleString('pt-BR'),
      sub: totalResults > 0 ? `${Math.round(totalPurchases / totalResults * 100)}% dos resultados` : '—',
      color: 'text-green-600',
      bg: 'bg-green-50',
      extra: null,
    },
    {
      icon: MessageCircle,
      label: 'Conversas (mês)',
      value: totalConversations.toLocaleString('pt-BR'),
      sub: totalResults > 0 ? `${Math.round(totalConversations / totalResults * 100)}% dos resultados` : '—',
      color: 'text-purple-600',
      bg: 'bg-purple-50',
      extra: null,
    },
    {
      icon: AlertTriangle,
      label: 'Alertas críticos',
      value: alertCount.toString(),
      sub: alertCount > 0 ? 'requerem atenção' : 'tudo ok',
      color: alertCount > 0 ? 'text-red-600' : 'text-gray-400',
      bg: alertCount > 0 ? 'bg-red-50' : 'bg-gray-50',
      extra: null,
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white rounded-xl border border-gray-200 p-3">
          <div className={`w-7 h-7 ${stat.bg} rounded-lg flex items-center justify-center mb-2`}>
            <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
          </div>
          <p className="text-[10px] text-gray-400 mb-0.5">{stat.label}</p>
          <p className={`text-lg font-bold ${stat.color} leading-none`}>{stat.value}</p>
          <p className="text-[10px] text-gray-400 mt-1">{stat.sub}</p>
          {stat.extra && <div className="mt-1">{stat.extra}</div>}
        </div>
      ))}
    </div>
  )
}
