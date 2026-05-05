import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function ttlMinutes(period: string, since?: string | null, until?: string | null): number {
  const today = new Date().toISOString().split('T')[0]
  if (since && until && until < today) return 60 * 24  // período histórico fechado → 24h
  switch (period) {
    case 'last_month': return 60 * 12
    case 'last_28d':
    case 'last_14d': return 60 * 6
    case 'yesterday':
    case 'last_7d': return 60 * 2
    case 'today':
    case 'this_month': return 5
    default: return 10
  }
}

export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const { data, error } = await supabase
      .from('meta_cache')
      .select('data')
      .eq('cache_key', key)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()
    if (error || !data) return null
    return data.data as T
  } catch { return null }
}

export async function setCached(
  key: string,
  data: unknown,
  period: string,
  since?: string | null,
  until?: string | null
): Promise<void> {
  try {
    const mins = ttlMinutes(period, since, until)
    const expires_at = new Date(Date.now() + mins * 60 * 1000).toISOString()
    await supabase
      .from('meta_cache')
      .upsert({ cache_key: key, data, expires_at }, { onConflict: 'cache_key' })
  } catch { /* falha de cache não é fatal */ }
}
