'use client'

import { formatCurrency, formatNumber, cn } from '@/lib/utils'

export interface BreakdownRow {
  label: string
  spend: number
  impressions: number
  clicks: number
  ctr: number
  cpp: number
  results: number
  costPerResult: number
}

interface BreakdownTableProps {
  title: string
  rows: BreakdownRow[]
  resultLabel?: string
  sortBy?: 'spend' | 'results' | 'ctr'
  maxRows?: number
  note?: string
}

function ctrColor(v: number) {
  if (v >= 2) return 'text-green-600 font-semibold'
  if (v >= 1) return 'text-yellow-600'
  if (v > 0) return 'text-red-500'
  return 'text-gray-300'
}

function cppColor(v: number) {
  if (v <= 0) return 'text-gray-300'
  if (v < 30) return 'text-green-600'
  if (v < 80) return 'text-yellow-600'
  return 'text-red-500'
}

function SpendBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-1.5 min-w-[120px]">
      <div className="w-16 bg-gray-100 rounded-full h-1.5 flex-shrink-0">
        <div className="h-1.5 rounded-full bg-blue-400" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-700 whitespace-nowrap">
        {formatCurrency(value)}
      </span>
    </div>
  )
}

export function BreakdownTable({
  title,
  rows,
  resultLabel = 'Resultados',
  sortBy = 'spend',
  maxRows = 20,
  note,
}: BreakdownTableProps) {
  const header = (
    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      {note && (
        <span className="text-xs text-gray-400 italic flex-shrink-0">{note}</span>
      )}
    </div>
  )

  if (!rows || rows.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {header}
        <div className="px-4 py-8 text-center text-gray-400 text-sm">
          Sem dados para o período selecionado
        </div>
      </div>
    )
  }

  const sorted = [...rows]
    .sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0))
    .slice(0, maxRows)

  const maxSpend = Math.max(...sorted.map((r) => r.spend))
  const hasResults = sorted.some((r) => r.results > 0)
  const hasCostPerResult = sorted.some((r) => r.costPerResult > 0)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {header}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-2 text-gray-400 font-medium w-40">Segmento</th>
              <th className="text-left px-4 py-2 text-gray-400 font-medium">Gasto</th>
              <th className="text-right px-4 py-2 text-gray-400 font-medium">Impressões</th>
              <th className="text-right px-4 py-2 text-gray-400 font-medium">Cliques</th>
              <th className="text-right px-4 py-2 text-gray-400 font-medium">CTR</th>
              <th className="text-right px-4 py-2 text-gray-400 font-medium">CPP</th>
              {hasResults && (
                <th className="text-right px-4 py-2 text-gray-400 font-medium">{resultLabel}</th>
              )}
              {hasCostPerResult && (
                <th className="text-right px-4 py-2 text-gray-400 font-medium">Custo/result.</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sorted.map((row, i) => (
              <tr
                key={row.label}
                className={cn(
                  'hover:bg-blue-50/60 transition-colors',
                  i === 0 && 'bg-blue-50/40'
                )}
              >
                <td className="px-4 py-2.5 font-medium text-gray-800 whitespace-nowrap">
                  {i === 0 && (
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5 mb-0.5 flex-shrink-0" />
                  )}
                  {row.label}
                </td>
                <td className="px-4 py-2.5">
                  <SpendBar value={row.spend} max={maxSpend} />
                </td>
                <td className="px-4 py-2.5 text-right text-gray-500">
                  {row.impressions > 0 ? formatNumber(row.impressions) : '—'}
                </td>
                <td className="px-4 py-2.5 text-right text-gray-500">
                  {row.clicks > 0 ? formatNumber(row.clicks) : '—'}
                </td>
                <td className={cn('px-4 py-2.5 text-right', ctrColor(row.ctr))}>
                  {row.ctr > 0 ? `${row.ctr.toFixed(2)}%` : '—'}
                </td>
                <td className={cn('px-4 py-2.5 text-right', cppColor(row.cpp))}>
                  {row.cpp > 0 ? formatCurrency(row.cpp) : '—'}
                </td>
                {hasResults && (
                  <td className="px-4 py-2.5 text-right font-semibold text-green-700">
                    {row.results > 0 ? formatNumber(row.results) : '—'}
                  </td>
                )}
                {hasCostPerResult && (
                  <td className="px-4 py-2.5 text-right font-medium text-purple-700">
                    {row.costPerResult > 0 ? formatCurrency(row.costPerResult) : '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
