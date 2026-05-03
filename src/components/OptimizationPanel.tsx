'use client'

import { useState } from 'react'
import { Optimization } from '@/lib/optimizations'
import { cn } from '@/lib/utils'
import { ChevronDown, Lightbulb, AlertTriangle, TrendingUp, Pause } from 'lucide-react'

interface OptimizationPanelProps {
  optimizations: Optimization[]
  loading?: boolean
}

const PRIORITY_CONFIG = {
  high:   { label: 'Urgente',  bg: 'bg-red-50',    border: 'border-red-200',    dot: 'bg-red-500',    text: 'text-red-700'    },
  medium: { label: 'Atenção',  bg: 'bg-yellow-50', border: 'border-yellow-200', dot: 'bg-yellow-500', text: 'text-yellow-700' },
  low:    { label: 'Oportunidade', bg: 'bg-green-50', border: 'border-green-200', dot: 'bg-green-500', text: 'text-green-700'  },
}

const TYPE_ICONS: Record<string, React.ReactNode> = {
  pause:      <Pause className="w-3.5 h-3.5" />,
  scale:      <TrendingUp className="w-3.5 h-3.5" />,
  creative:   <Lightbulb className="w-3.5 h-3.5" />,
  audience:   <AlertTriangle className="w-3.5 h-3.5" />,
  budget:     <TrendingUp className="w-3.5 h-3.5" />,
  remarketing:<TrendingUp className="w-3.5 h-3.5" />,
  pixel:      <AlertTriangle className="w-3.5 h-3.5" />,
}

function OptCard({ opt }: { opt: Optimization }) {
  const [open, setOpen] = useState(false)
  const p = PRIORITY_CONFIG[opt.priority]

  return (
    <div className={cn('rounded-xl border p-3.5 cursor-pointer', p.bg, p.border)}
      onClick={() => setOpen(v => !v)}>
      <div className="flex items-start gap-3">
        <span className="text-lg flex-shrink-0 leading-none mt-0.5">{opt.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded', p.bg, p.text)}>
              {p.label}
            </span>
            <span className="flex items-center gap-1 text-[10px] text-gray-500">
              {TYPE_ICONS[opt.type]}
              {opt.type === 'pause' ? 'Pausar' : opt.type === 'scale' ? 'Escalar' : opt.type === 'creative' ? 'Criativo' : opt.type === 'audience' ? 'Público' : opt.type === 'remarketing' ? 'Remarketing' : 'Orçamento'}
            </span>
          </div>
          <p className={cn('text-xs font-semibold mt-1', p.text)}>{opt.title}</p>
          <p className="text-[11px] text-gray-500 mt-0.5 font-mono">{opt.metrics}</p>
        </div>
        <ChevronDown className={cn('w-4 h-4 text-gray-400 flex-shrink-0 transition-transform mt-1', open && 'rotate-180')} />
      </div>
      {open && (
        <div className="mt-3 pt-3 border-t border-gray-200/60">
          <p className="text-xs text-gray-700 leading-relaxed">{opt.detail}</p>
        </div>
      )}
    </div>
  )
}

export function OptimizationPanel({ optimizations, loading }: OptimizationPanelProps) {
  const [collapsed, setCollapsed] = useState(false)

  const high = optimizations.filter(o => o.priority === 'high')
  const medium = optimizations.filter(o => o.priority === 'medium')
  const low = optimizations.filter(o => o.priority === 'low')

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm mb-6">
      {/* Header */}
      <button
        onClick={() => setCollapsed(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">🧠</span>
          <div className="text-left">
            <h2 className="font-bold text-gray-900 text-sm">Análise de Otimização — IA</h2>
            <p className="text-xs text-gray-400">
              {loading ? 'Analisando campanhas...'
                : optimizations.length === 0 ? 'Sem sugestões — conta saudável'
                : `${optimizations.length} sugestão${optimizations.length !== 1 ? 'ões' : ''}: ${high.length} urgente${high.length !== 1 ? 's' : ''}, ${medium.length} atenção, ${low.length} oportunidade${low.length !== 1 ? 's' : ''}`
              }
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {high.length > 0 && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-bold">
              {high.length} urgente{high.length !== 1 ? 's' : ''}
            </span>
          )}
          <ChevronDown className={cn('w-5 h-5 text-gray-400 transition-transform', collapsed && 'rotate-180')} />
        </div>
      </button>

      {/* Content */}
      {!collapsed && (
        <div className="px-5 pb-5 border-t border-gray-100">
          {loading ? (
            <div className="space-y-2 mt-4">
              {[1,2,3].map(i => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : optimizations.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-2xl mb-2">✅</p>
              <p className="text-sm font-medium text-gray-700">Conta com boa saúde</p>
              <p className="text-xs text-gray-400 mt-1">Não há sugestões de otimização para os dados do período selecionado.</p>
            </div>
          ) : (
            <div className="mt-4 space-y-2.5">
              {optimizations.map((opt, i) => <OptCard key={i} opt={opt} />)}
            </div>
          )}

          {optimizations.length > 0 && (
            <p className="text-[10px] text-gray-400 mt-4 border-t border-gray-100 pt-3">
              ⚠️ Toda otimização requer aprovação humana. O sistema analisa — você decide — o sistema executa.
              Sugestões baseadas em dados mínimos de R$30+ gastos por conjunto.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
