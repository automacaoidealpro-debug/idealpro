'use client'

interface BreakdownItem {
  label: string
  spend: number
  impressions?: number
  ctr?: number
  results?: number
}

interface BreakdownBarProps {
  title: string
  items: BreakdownItem[]
  valueKey?: 'spend' | 'impressions' | 'results'
  format?: (v: number) => string
}

export function BreakdownBar({
  title,
  items,
  valueKey = 'spend',
  format = (v) => `R$${v.toFixed(2)}`,
}: BreakdownBarProps) {
  if (!items || items.length === 0) return null

  const max = Math.max(...items.map((i) => i[valueKey] || 0))

  const sorted = [...items].sort((a, b) => (b[valueKey] || 0) - (a[valueKey] || 0))

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      <div className="space-y-2">
        {sorted.map((item, i) => {
          const val = item[valueKey] || 0
          const pct = max > 0 ? (val / max) * 100 : 0
          const isTop = i === 0
          return (
            <div key={item.label} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-28 flex-shrink-0 truncate">
                {item.label}
              </span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${isTop ? 'bg-blue-500' : 'bg-blue-200'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`text-xs font-medium w-20 text-right ${isTop ? 'text-blue-600' : 'text-gray-500'}`}>
                {format(val)}
              </span>
              {item.ctr !== undefined && (
                <span className="text-xs text-gray-400 w-16 text-right">
                  {item.ctr.toFixed(2)}% CTR
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
