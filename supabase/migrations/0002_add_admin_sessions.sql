create table if not exists public.admin_sessions (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references public.admin_users(id) on delete cascade,
  session_token_hash text not null,
  is_active boolean not null default true,
  issued_at timestamptz not null default timezone('utc', now()),
  expires_at timestamptz not null,
  invalidated_at timestamptz,
  last_seen_at timestamptz not null default timezone('utc', now())
);

alter table public.admin_sessions enable row level security;

create index if not exists admin_sessions_token_hash_idx
  on public.admin_sessions (session_token_hash);

create index if not exists admin_sessions_admin_user_idx
  on public.admin_sessions (admin_user_id, issued_at desc);

create index if not exists admin_sessions_active_expires_idx
  on public.admin_sessions (is_active, expires_at);
