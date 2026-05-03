'use client'

import { cn } from '@/lib/utils'

interface MetricCardProps {
  label: string
  value: string
  sub?: string
  color?: 'blue' | 'green' | 'purple' | 'indigo' | 'orange' | 'red' | 'gray'
}

const colors: Record<string, { text: string; bg: string }> = {
  blue: { text: 'text-blue-600', bg: 'bg-blue-50' },
  green: { text: 'text-green-600', bg: 'bg-green-50' },
  purple: { text: 'text-purple-600', bg: 'bg-purple-50' },
  indigo: { text: 'text-indigo-600', bg: 'bg-indigo-50' },
  orange: { text: 'text-orange-600', bg: 'bg-orange-50' },
  red: { text: 'text-red-600', bg: 'bg-red-50' },
  gray: { text: 'text-gray-600', bg: 'bg-gray-50' },
}

export function MetricCard({ label, value, sub, color = 'blue' }: MetricCardProps) {
  const c = colors[color] || colors.blue
  return (
    <div className={cn('rounded-xl p-4', c.bg)}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={cn('text-2xl font-bold', c.text)}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}
