'use client'

import { cn } from '@/lib/utils'

interface HealthScoreProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
}

export function HealthScore({ score, size = 'md' }: HealthScoreProps) {
  const color =
    score >= 70 ? 'text-green-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600'

  const ring =
    score >= 70 ? 'border-green-500' : score >= 40 ? 'border-yellow-500' : 'border-red-500'

  const sizes = {
    sm: 'w-10 h-10 text-xs border-2',
    md: 'w-14 h-14 text-sm border-3',
    lg: 'w-20 h-20 text-lg border-4',
  }

  return (
    <div
      className={cn(
        'rounded-full flex flex-col items-center justify-center font-bold border-4',
        ring,
        sizes[size]
      )}
    >
      <span className={cn('leading-none', color, size === 'lg' ? 'text-2xl' : 'text-sm')}>
        {score}
      </span>
      {size !== 'sm' && <span className="text-gray-400 text-[9px] leading-none">score</span>}
    </div>
  )
}
