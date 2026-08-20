'use client'

import { formatCurrency, formatNumber, cn } from '@/lib/utils'

export interface AdInsights {
  spend: number
  impressions: number
  clicks: number
  reach: number
  ctr: number
  cpm: number
  cpp: number
  linkClicks: number
  outboundClicks: number
  hookRate: number
  videoView3s: number
  thruplayCount: number
  profileVisits: number
  postEngagement: number
  addToCart: number
  initiateCheckout: number
  messages: number
  clickToMessage: number
  reachToMessage: number
  results: number
  resultType: string
  costPerResult: number
}

interface AdMetricsRowProps {
  name: string
  status: string
  insights: AdInsights | null
  resultLabel?: string
  isAd?: boolean
  thumbnailUrl?: string
}

function Metric({
  label,
  value,
  color,
}: {
  label: string
  value: string
  color?: string
}) {
  return (
    <div className="text-center min-w-[70px]">
      <p className="text-[10px] text-gray-400 leading-tight">{label}</p>
      <p className={cn('text-xs font-semibold mt-0.5', color || 'text-gray-700')}>{value}</p>
    </div>
  )
}

// Thresholds per brief: ≥1% good, 0.8-1% attention, <0.8% critical
function ctrColor(v: number) {
  if (v >= 1) return 'text-green-600'
  if (v >= 0.8) return 'text-yellow-600'
  if (v > 0) return 'text-red-500'
  return 'text-gray-300'
}

function hookColor(v: number) {
  if (v >= 30) return 'text-green-600'
  if (v >= 15) return 'text-yellow-600'
  if (v > 0) return 'text-red-500'
  return 'text-gray-300'
}

// CPM: ≤R$15 good, R$15-30 attention, >R$30 critical
function cpmColor(v: number) {
  if (v <= 0) return 'text-gray-300'
  if (v <= 15) return 'text-green-600'
  if (v <= 30) return 'text-yellow-600'
  return 'text-red-500'
}

// Taxa Cliques→Msg: ≥40% good, 30-40% attention, <30% critical
function c2mColor(v: number) {
  if (v >= 40) return 'text-green-600'
  if (v >= 30) return 'text-yellow-600'
  if (v > 0) return 'text-red-500'
  return 'text-gray-300'
}

// Taxa Alcance→Msg: ≥0.5% good, 0.3-0.5% attention, <0.3% critical
function r2mColor(v: number) {
  if (v >= 0.5) return 'text-green-600'
  if (v >= 0.3) return 'text-yellow-600'
  if (v > 0) return 'text-red-500'
  return 'text-gray-300'
}

function statusLabel(s: string) {
  if (s === 'ACTIVE') return '● Ativo'
  if (s === 'ARCHIVED') return '○ Arquivado'
  return '○ Pausado'
}

export function AdMetricsRow({
  name,
  status,
  insights: ins,
  resultLabel = 'Resultados',
  isAd = false,
  thumbnailUrl,
}: AdMetricsRowProps) {
  const isActive = status === 'ACTIVE'

  return (
    <div
      className={cn(
        'flex items-center gap-3 px-4 py-3 border-b border-gray-100 last:border-0',
        isAd ? 'bg-gray-50/50 pl-8' : 'bg-white',
        !isActive && 'opacity-60'
      )}
    >
      {/* Thumbnail (ads only) */}
      {isAd && (
        <div className="w-10 h-10 rounded flex-shrink-0 bg-gray-200 overflow-hidden">
          {thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumbnailUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
              —
            </div>
          )}
        </div>
      )}

      {/* Name + status */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-gray-800 truncate" title={name}>
          {name}
        </p>
        <span
          className={cn(
            'text-[10px] font-medium',
            isActive ? 'text-green-600' : 'text-gray-400'
          )}
        >
          {statusLabel(status)}
        </span>
      </div>

      {/* Metrics */}
      {ins ? (
        <div className="flex items-center gap-1 flex-wrap justify-end">
          <Metric label="Gasto" value={formatCurrency(ins.spend)} />
          <div className="w-px h-6 bg-gray-200 mx-1" />
          <Metric label="Impressões" value={formatNumber(ins.impressions)} />
          <Metric label="CTR" value={ins.ctr > 0 ? `${ins.ctr.toFixed(2)}%` : '—'} color={ctrColor(ins.ctr)} />
          <Metric label="CPM" value={ins.cpm > 0 ? formatCurrency(ins.cpm) : '—'} color={cpmColor(ins.cpm)} />
          <Metric
            label="Hook Rate"
            value={ins.hookRate > 0 ? `${ins.hookRate.toFixed(1)}%` : '—'}
            color={hookColor(ins.hookRate)}
          />
          <div className="w-px h-6 bg-gray-200 mx-1" />
          <Metric label="Cliques" value={ins.clicks > 0 ? formatNumber(ins.clicks) : '—'} />
          <Metric
            label="Clique link"
            value={ins.linkClicks > 0 ? formatNumber(ins.linkClicks) : '—'}
          />
          <Metric
            label="Saída site"
            value={ins.outboundClicks > 0 ? formatNumber(ins.outboundClicks) : '—'}
          />
          {ins.messages > 0 && (
            <Metric label="Mensagens" value={formatNumber(ins.messages)} color="text-teal-600" />
          )}
          {ins.clickToMessage > 0 && (
            <Metric
              label="Cliq→Msg"
              value={`${ins.clickToMessage.toFixed(1)}%`}
              color={c2mColor(ins.clickToMessage)}
            />
          )}
          {ins.reachToMessage > 0 && (
            <Metric
              label="Alc→Msg"
              value={`${ins.reachToMessage.toFixed(2)}%`}
              color={r2mColor(ins.reachToMessage)}
            />
          )}
          {ins.profileVisits > 0 && (
            <Metric
              label="Visita perfil"
              value={formatNumber(ins.profileVisits)}
              color="text-purple-600"
            />
          )}
          {ins.addToCart > 0 && (
            <Metric
              label="Add carrinho"
              value={formatNumber(ins.addToCart)}
              color="text-blue-600"
            />
          )}
          <div className="w-px h-6 bg-gray-200 mx-1" />
          <Metric
            label={resultLabel}
            value={ins.results > 0 ? formatNumber(ins.results) : '—'}
            color={ins.results > 0 ? 'text-green-700 font-bold' : undefined}
          />
          <Metric
            label="Custo/result."
            value={ins.costPerResult > 0 ? formatCurrency(ins.costPerResult) : '—'}
            color={ins.costPerResult > 0 ? 'text-purple-700' : undefined}
          />
        </div>
      ) : (
        <span className="text-xs text-gray-400">Sem dados no período</span>
      )}
    </div>
  )
}
