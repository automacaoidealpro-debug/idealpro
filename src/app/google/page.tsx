'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { TrendingUp, AlertTriangle, RefreshCw, ExternalLink, CheckCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface GoogleAccount {
  id: string
  name: string
  currency: string
  timezone: string
  status: string
  isTest: boolean
}

interface AccountsResponse {
  accounts?: GoogleAccount[]
  total?: number
  error?: string
  developer_token_status?: string
  hint?: string
}

export default function GoogleAdsPage() {
  const [data, setData] = useState<AccountsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    fetch('/api/google/accounts')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const isTestMode = data?.developer_token_status === 'TEST_ONLY'
  const accounts = data?.accounts || []

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 text-white px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center border border-white/20">
              <TrendingUp className="w-6 h-6 text-blue-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Google Ads</h1>
              <p className="text-blue-300 text-sm mt-0.5">MCC {process.env.NEXT_PUBLIC_GOOGLE_MCC_ID || '414-737-3044'}</p>
            </div>

            <div className="ml-auto flex items-center gap-2">
              {!loading && !data?.error && (
                <span className="flex items-center gap-1.5 text-xs bg-green-500/20 text-green-300 border border-green-500/30 px-3 py-1.5 rounded-full">
                  <CheckCircle className="w-3.5 h-3.5" /> OAuth2 conectado
                </span>
              )}
              {isTestMode && (
                <span className="flex items-center gap-1.5 text-xs bg-blue-500/20 text-blue-300 border border-blue-500/30 px-3 py-1.5 rounded-full">
                  <RefreshCw className="w-3.5 h-3.5" /> Propagando aprovação...
                </span>
              )}
              <button
                onClick={load}
                disabled={loading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
            <RefreshCw className="w-7 h-7 text-blue-400 animate-spin mx-auto mb-3" />
            <p className="text-sm text-gray-500">Conectando ao Google Ads MCC...</p>
          </div>
        )}

        {/* Test mode warning */}
        {isTestMode && !loading && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
            <div className="flex items-start gap-3">
              <RefreshCw className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5 animate-spin" />
              <div>
                <p className="font-semibold text-blue-800 text-sm">Aprovação em propagação — aguarde alguns minutos</p>
                <p className="text-sm text-blue-700 mt-1 leading-relaxed">
                  O Google confirma a aprovação do Basic Access mas leva <strong>30 minutos a 2 horas</strong> para propagar nos servidores da API.
                  O sistema está pronto — assim que propagar, as contas aparecem automaticamente. Clique em Atualizar para checar.
                </p>
                <p className="text-xs text-blue-500 mt-2 font-mono">Token: {data?.hint || 'DEVELOPER_TOKEN_NOT_APPROVED (aguardando propagação)'}</p>
              </div>
            </div>
          </div>
        )}

        {/* Error (non test-mode) */}
        {data?.error && !isTestMode && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
            <p className="font-semibold text-red-800 text-sm mb-1">Erro ao conectar</p>
            <p className="text-sm text-red-600 font-mono">{data.error}</p>
          </div>
        )}

        {/* Accounts list */}
        {accounts.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-blue-500" />
                <h2 className="font-bold text-gray-900">Contas Google Ads</h2>
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{accounts.length} conta{accounts.length !== 1 ? 's' : ''}</span>
              </div>
            </div>

            <div className="divide-y divide-gray-50">
              {accounts.map(account => (
                <Link
                  key={account.id}
                  href={`/google/${account.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-5 h-5 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{account.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">ID: {account.id} · {account.currency} · {account.timezone}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {account.isTest && (
                      <span className="text-[10px] bg-yellow-50 text-yellow-600 border border-yellow-200 px-2 py-0.5 rounded-full">TESTE</span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-medium
                      ${account.status === 'ENABLED'
                        ? 'bg-green-50 text-green-600 border-green-200'
                        : 'bg-gray-50 text-gray-400 border-gray-200'}`}>
                      {account.status === 'ENABLED' ? 'Ativa' : account.status}
                    </span>
                    <span className="text-gray-300">›</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Empty: OAuth works but no accounts (test mode) */}
        {!loading && !data?.error && accounts.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center shadow-sm">
            <TrendingUp className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="font-semibold text-gray-700">Nenhuma conta encontrada</p>
            <p className="text-sm text-gray-400 mt-1">OAuth2 conectado — mas o developer token em TEST não acessa contas reais ainda.</p>
          </div>
        )}

      </div>
    </div>
  )
}
