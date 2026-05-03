'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, Users, ShoppingCart, MessageCircle, RefreshCw } from 'lucide-react'

function fmtC(n: number) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function fmt(n: number) { return n.toLocaleString('pt-BR') }

interface PublicData {
  name: string
  spend: number
  results: number
  cpp: number
  leads: number
  purchases: number
  conversations: number
  revenue: number
  type: 'lead' | 'ecommerce' | 'conversa'
}

function generateNarrative(d: PublicData): string {
  const period = 'neste mês'
  if (d.spend === 0 && d.results === 0) {
    return `Ainda não temos dados disponíveis ${period}.`
  }
  if (d.type === 'ecommerce') {
    const rev = d.revenue > 0 ? ` Faturamento gerado: ${fmtC(d.revenue)}.` : ''
    const cpp = d.purchases > 0 ? ` Custo por compra: ${fmtC(d.spend / d.purchases)}.` : ''
    return `${period === 'neste mês' ? 'Neste mês' : 'No período'}, sua loja realizou ${fmt(d.purchases)} venda${d.purchases !== 1 ? 's' : ''} com investimento de ${fmtC(d.spend)}.${rev}${cpp}`
  }
  if (d.type === 'conversa') {
    const cpc = d.conversations > 0 ? ` Custo por conversa: ${fmtC(d.spend / d.conversations)}.` : ''
    return `Neste mês, suas campanhas geraram ${fmt(d.conversations)} conversa${d.conversations !== 1 ? 's' : ''} no WhatsApp com investimento de ${fmtC(d.spend)}.${cpc}`
  }
  const cpl = d.leads > 0 ? ` Custo por lead: ${fmtC(d.spend / d.leads)}.` : ''
  return `Neste mês, suas campanhas geraram ${fmt(d.leads)} lead${d.leads !== 1 ? 's' : ''} com investimento de ${fmtC(d.spend)}.${cpl}`
}

export default function PublicDashboardPage({ params }: { params: { id: string } }) {
  const [data, setData] = useState<PublicData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/meta/report?period=this_month`)
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        const row = (json.rows || []).find((r: { id: string }) => r.id === params.id || r.id === `act_${params.id}`)
        if (!row) throw new Error('Conta não encontrada')
        setData(row as PublicData)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar dados')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-gradient-to-r from-gray-900 to-blue-900 text-white px-6 py-6">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center font-black text-lg">IP</div>
            <span className="font-bold text-lg">Ideal Pro Marketing</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3" />
            <p className="text-gray-500 text-sm">Carregando seus dados...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <div className="bg-gradient-to-r from-gray-900 to-blue-900 text-white px-6 py-6">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center font-black text-lg">IP</div>
            <span className="font-bold text-lg">Ideal Pro Marketing</span>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <p className="text-gray-700 font-semibold mb-2">Dados indisponíveis</p>
            <p className="text-gray-400 text-sm">{error || 'Não encontramos dados para esta conta.'}</p>
          </div>
        </div>
      </div>
    )
  }

  const narrative = generateNarrative(data)
  const mainResults = data.type === 'ecommerce' ? data.purchases
    : data.type === 'conversa' ? data.conversations
    : data.leads

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 via-blue-900 to-gray-900 text-white px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center font-black text-lg">IP</div>
            <span className="font-bold text-lg tracking-tight">Ideal Pro Marketing</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">{data.name}</h1>
          <p className="text-gray-300 text-sm">Relatório de desempenho — mês atual</p>
        </div>
      </div>

      {/* Metrics */}
      <div className="max-w-2xl mx-auto w-full px-4 py-6 space-y-4">

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-indigo-600" />
              </div>
              <span className="text-xs text-gray-500 font-medium">Investido</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{fmtC(data.spend)}</p>
            <p className="text-[11px] text-gray-400 mt-1">no mês atual</p>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                data.type === 'ecommerce' ? 'bg-green-50' : data.type === 'conversa' ? 'bg-purple-50' : 'bg-blue-50'
              }`}>
                {data.type === 'ecommerce' ? <ShoppingCart className="w-4 h-4 text-green-600" />
                  : data.type === 'conversa' ? <MessageCircle className="w-4 h-4 text-purple-600" />
                  : <Users className="w-4 h-4 text-blue-600" />}
              </div>
              <span className="text-xs text-gray-500 font-medium">
                {data.type === 'ecommerce' ? 'Vendas' : data.type === 'conversa' ? 'Conversas' : 'Leads'}
              </span>
            </div>
            <p className={`text-2xl font-bold ${
              data.type === 'ecommerce' ? 'text-green-700' : data.type === 'conversa' ? 'text-purple-700' : 'text-blue-700'
            }`}>{fmt(mainResults)}</p>
            <p className="text-[11px] text-gray-400 mt-1">resultados gerados</p>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-white rounded-2xl border border-gray-200 p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 bg-orange-50 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-orange-600" />
              </div>
              <span className="text-xs text-gray-500 font-medium">Custo por resultado</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{data.cpp > 0 ? fmtC(data.cpp) : '—'}</p>
            <p className="text-[11px] text-gray-400 mt-1">CPP médio do mês</p>
          </div>
        </div>

        {/* Revenue card (ecommerce only) */}
        {data.type === 'ecommerce' && data.revenue > 0 && (
          <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-5 text-white shadow-sm">
            <p className="text-sm text-green-100 mb-1">Faturamento gerado</p>
            <p className="text-3xl font-bold">{fmtC(data.revenue)}</p>
            <p className="text-sm text-green-200 mt-1">ROAS: {(data.revenue / data.spend).toFixed(2)}x</p>
          </div>
        )}

        {/* Narrative */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Resumo do período</p>
          <p className="text-gray-800 text-sm leading-relaxed">{narrative}</p>
        </div>

        {/* Footer */}
        <div className="text-center py-4">
          <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2 shadow-sm">
            <div className="w-5 h-5 bg-gray-900 rounded-md flex items-center justify-center text-white text-[9px] font-black">IP</div>
            <span className="text-xs text-gray-500">Powered by <strong className="text-gray-700">Ideal Pro Marketing</strong></span>
          </div>
        </div>
      </div>
    </div>
  )
}
