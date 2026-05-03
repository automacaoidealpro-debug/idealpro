const KEY = 'idealpro_targets'

export interface AccountTarget {
  targetCpp: number
  whatsapp?: string // phone number with country code, e.g. "5511999999999"
}

export function getTargets(): Record<string, AccountTarget> {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') } catch { return {} }
}

export function setTarget(id: string, target: AccountTarget) {
  const targets = getTargets()
  targets[id] = target
  localStorage.setItem(KEY, JSON.stringify(targets))
}

export function getTarget(id: string): AccountTarget | null {
  return getTargets()[id] || null
}
