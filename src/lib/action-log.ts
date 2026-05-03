const KEY = 'idealpro_action_log'
const MAX = 200

export interface LogEntry {
  id: string
  ts: number // timestamp
  accountId: string
  accountName: string
  action: string
  result: 'ok' | 'error'
  detail: string
}

export function addLog(entry: Omit<LogEntry, 'id' | 'ts'>) {
  try {
    const log = getLogs()
    log.unshift({ ...entry, id: Math.random().toString(36).slice(2), ts: Date.now() })
    localStorage.setItem(KEY, JSON.stringify(log.slice(0, MAX)))
  } catch {}
}

export function getLogs(): LogEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}

export function clearLogs() {
  localStorage.removeItem(KEY)
}
