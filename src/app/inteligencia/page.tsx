'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Brain, RefreshCw, Search, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

interface Account {
  id: string
  name: string
  spend: number
  results: number
  cpp: number
  type: 'lead' | 'ecommerce' | 'conversa'
}

export default function InteligenciaIndexPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/meta/report?period=last_7d')
      const data = await res.json()
      setAccounts(data.rows || [])
    } catch { setAccounts([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = accounts.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase())
  )

  const getHealth = (cpp: number) => {
    if (cpp === 0) return { label: 'Sem dados', color: 'text-gray-400', dot: 'bg-gray-300', icon: null }
    if (cpp < 30) return { label: 'Saudável', color: 'text-green-600', dot: 'bg-green-500', icon: CheckCircle }
    if (cpp < 80) return { label: 'Atenção', color: 'text-yellow-600', dot: 'bg-yellow-500', icon: AlertTriangle }
    return { label: 'Crítico', color: 'text-red-600', dot: 'bg-red-500', icon: AlertTriangle }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-gray-900 via-purple-950 to-indigo-900 text-white px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-600/30 rounded-2xl flex items-center justify-center border border-purple-500/30">
              <Brain className="w-6 h-6 text-purple-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Central de Inteligência</h1>
              <p className="text-gray-400 text-sm mt-0.5">Selecione uma conta para análise profunda com IA</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {/* Search */}
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar conta..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 text-gray-900"
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-3" />
                <div className="h-3 bg-gray-100 rounded w-1/2 mb-4" />
                <div className="h-8 bg-purple-100 rounded-xl w-full" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <Brain className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="font-medium">Nenhuma conta encontrada</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(acc => {
              const health = getHealth(acc.cpp)
              const HealthIcon = health.icon
              return (
                <div key={acc.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow p-5 flex flex-col gap-4">
                  {/* Header */}
                  <div className="flex items-start gap-2">
                    <span className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-1.5', health.dot)} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm leading-snug">{acc.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        {HealthIcon && <HealthIcon className={cn('w-3 h-3', health.color)} />}
                        <span className={cn('text-xs font-medium', health.color)}>{health.label}</span>
                      </div>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-gray-50 rounded-xl px-3 py-2">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">Gasto 7d</p>
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(acc.spend)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl px-3 py-2">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide">
                        {acc.type === 'ecommerce' ? 'Vendas' : acc.type === 'conversa' ? 'Conv.' : 'Leads'}
                      </p>
                      <p className="text-sm font-bold text-gray-900">{acc.results}</p>
                    </div>
                  </div>

                  {/* CTA */}
                  <Link
                    href={`/inteligencia/${acc.id}`}
                    className="flex items-center justify-center gap-2 w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-semibold transition-colors"
                  >
                    <Brain className="w-4 h-4" />
                    Analisar com IA
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
