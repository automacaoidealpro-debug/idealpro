-- Rodar uma vez no Supabase SQL Editor (dashboard.supabase.com → SQL Editor)
-- Cria a tabela de cache de insights da Meta API

CREATE TABLE IF NOT EXISTS meta_cache (
  cache_key   TEXT PRIMARY KEY,
  data        JSONB NOT NULL,
  fetched_at  TIMESTAMPTZ DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL
);

-- Índice para limpeza de cache expirado
CREATE INDEX IF NOT EXISTS meta_cache_expires_idx ON meta_cache (expires_at);

-- Limpeza automática de entradas expiradas (opcional, rodar periodicamente)
-- DELETE FROM meta_cache WHERE expires_at < NOW();
