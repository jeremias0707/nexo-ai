-- Durable rate limiting for /api/chat (12 requests per minute per client).
--
-- One row per accepted request, keyed by a SHA-256 hash of the client IP (the
-- raw IP is never stored). Rows older than a few minutes are pruned
-- opportunistically by src/lib/rate-limit.server.ts, so the table stays tiny.
-- Unowned by design: this app has no accounts and nothing reads it but the
-- server-side limiter.

create table if not exists chat_rate_hits (
  id bigserial primary key,
  client_key text not null,
  hit_at timestamptz not null default now()
);

create index if not exists chat_rate_hits_client_time_idx
  on chat_rate_hits (client_key, hit_at);
