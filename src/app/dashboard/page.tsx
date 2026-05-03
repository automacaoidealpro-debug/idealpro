'use client'

import { useEffect, useState, useCallback } from 'react'
import { ClientAccount } from '@/types/meta'
import { AccountCard } from '@/components/AccountCard'
import { SummaryBar } from '@/components/SummaryBar'
import { RefreshCw, Search, Filter, LayoutGrid, List } from 'lucide-react'
import { cn } from '@/lib/utils'

type FilterType = 'all' | 'active' | 'alerts' | 'no_pixel'

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<ClientAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchAccounts = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/meta/accounts')
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setAccounts(data.accounts)
      setLastUpdated(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar contas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAccounts()
  }, [fetchAccounts])

  const filtered = accounts.filter((a) => {
    const matchSearch = a.name.toLowerCase().includes(search.toLowerCase())
    const matchFilter =
      filter === 'all' ||
      (filter === 'active' && a.status === 'active') ||
      (filter === 'alerts' && a.alerts.length > 0) ||
      (filter === 'no_pixel' && !a.pixel)
    return matchSearch && matchFilter
  })

  const filterButtons: { key: FilterType; label: string; count?: number }[] = [
    { key: 'all', label: 'Todas', count: accounts.length },
    { key: 'active', label: 'Ativas', count: accounts.filter(a => a.status === 'active').length },
    { key: 'alerts', label: 'Com alerta', count: accounts.filter(a => a.alerts.length > 0).length },
    { key: 'no_pixel', label: 'Sem pixel', count: accounts.filter(a => !a.pixel).length },
  ]

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Painel Geral</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {lastUpdated
              ? `Atualizado às ${lastUpdated.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
              : 'Carregando dados...'}
          </p>
        </div>
        <button
          onClick={fetchAccounts}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          Atualizar
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 text-red-700 text-sm">
          {error}
        </div>
      )}

      {!loading && accounts.length > 0 && <SummaryBar accounts={accounts} />}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar cliente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          {filterButtons.map((btn) => (
            <button
              key={btn.key}
              onClick={() => setFilter(btn.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5',
                filter === btn.key
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              )}
            >
              {btn.label}
              {btn.count !== undefined && (
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full',
                  filter === btn.key ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                )}>{btn.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-gray-200 p-4 animate-pulse">
              <div className="flex justify-between mb-3">
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded w-16" />
                  <div className="h-4 bg-gray-200 rounded w-32" />
                </div>
                <div className="h-6 w-8 bg-gray-200 rounded-full" />
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="h-12 bg-gray-100 rounded-lg" />
                ))}
              </div>
              <div className="h-3 bg-gray-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <LayoutGrid className="w-10 h-10 mx-auto mb-3 text-gray-200" />
          <p className="font-medium text-gray-500">Nenhuma conta encontrada</p>
          <p className="text-sm mt-1">Ajuste os filtros ou a busca</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      )}
    </div>
  )
}
