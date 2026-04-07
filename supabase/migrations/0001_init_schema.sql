create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  venue_code text not null unique,
  fixed_bet_amount integer not null check (fixed_bet_amount >= 0),
  staff_match_wait_seconds integer not null default 90 check (staff_match_wait_seconds >= 0),
  disconnect_threshold_seconds integer not null default 30 check (disconnect_threshold_seconds >= 1),
  status text not null default 'draft' check (status in ('draft', 'active', 'closed')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  passcode_hash text not null,
  role text not null default 'staff' check (role in ('staff', 'admin')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  table_id uuid,
  player1_participant_id uuid,
  player2_participant_id uuid,
  status text not null default 'reserved' check (
    status in (
      'reserved',
      'awaiting_ready',
      'in_progress',
      'winner_claimed',
      'completed',
      'cancelled_before_start',
      'voided_by_admin',
      'force_finished_by_admin'
    )
  ),
  is_staff_match boolean not null default false,
  staff_operator_id uuid references public.admin_users(id) on delete set null,
  player1_ready_at timestamptz,
  player2_ready_at timestamptz,
  agreed_bet_amount integer check (agreed_bet_amount >= 0),
  winner_participant_id uuid,
  winner_claimed_by_participant_id uuid,
  winner_claimed_at timestamptz,
  completed_at timestamptz,
  cancelled_by_participant_id uuid,
  void_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  nickname text not null,
  status text not null default 'registered' check (
    status in (
      'unregistered',
      'registered',
      'queueing',
      'match_reserved',
      'ready',
      'playing',
      'claiming_win',
      'awaiting_result_approval',
      'result_confirmed',
      'paused',
      'disqualified',
      'disconnected'
    )
  ),
  last_non_disconnect_status text check (
    last_non_disconnect_status is null or last_non_disconnect_status in (
      'unregistered',
      'registered',
      'queueing',
      'match_reserved',
      'ready',
      'playing',
      'claiming_win',
      'awaiting_result_approval',
      'result_confirmed',
      'paused',
      'disqualified'
    )
  ),
  chip_balance integer not null default 0 check (chip_balance >= 0),
  current_match_id uuid references public.matches(id) on delete set null,
  last_opponent_participant_id uuid,
  queued_at timestamptz,
  last_seen_at timestamptz not null default timezone('utc', now()),
  is_paused boolean not null default false,
  is_disqualified boolean not null default false,
  disqualified_reason text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (event_id, nickname)
);

create table if not exists public.tables (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  table_number integer not null check (table_number between 1 and 5),
  game_title text not null,
  status text not null default 'available' check (status in ('available', 'reserved', 'in_use', 'admin_hold')),
  current_match_id uuid references public.matches(id) on delete set null,
  held_by_admin_user_id uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (event_id, table_number)
);

create table if not exists public.participant_sessions (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references public.participants(id) on delete cascade,
  session_token_hash text not null,
  is_active boolean not null default true,
  issued_at timestamptz not null default timezone('utc', now()),
  invalidated_at timestamptz,
  last_seen_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.chip_ledger (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  participant_id uuid not null references public.participants(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  delta integer not null,
  reason text not null check (reason in ('match_bet', 'match_payout', 'admin_adjustment', 'rollback')),
  balance_after integer not null check (balance_after >= 0),
  created_by_admin_user_id uuid references public.admin_users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.events enable row level security;
alter table public.admin_users enable row level security;
alter table public.matches enable row level security;
alter table public.participants enable row level security;
alter table public.tables enable row level security;
alter table public.participant_sessions enable row level security;
alter table public.chip_ledger enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'matches_table_id_fkey'
  ) then
    alter table public.matches
      add constraint matches_table_id_fkey
      foreign key (table_id) references public.tables(id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'matches_player1_participant_id_fkey'
  ) then
    alter table public.matches
      add constraint matches_player1_participant_id_fkey
      foreign key (player1_participant_id) references public.participants(id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'matches_player2_participant_id_fkey'
  ) then
    alter table public.matches
      add constraint matches_player2_participant_id_fkey
      foreign key (player2_participant_id) references public.participants(id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'matches_winner_participant_id_fkey'
  ) then
    alter table public.matches
      add constraint matches_winner_participant_id_fkey
      foreign key (winner_participant_id) references public.participants(id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'matches_winner_claimed_by_participant_id_fkey'
  ) then
    alter table public.matches
      add constraint matches_winner_claimed_by_participant_id_fkey
      foreign key (winner_claimed_by_participant_id) references public.participants(id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'matches_cancelled_by_participant_id_fkey'
  ) then
    alter table public.matches
      add constraint matches_cancelled_by_participant_id_fkey
      foreign key (cancelled_by_participant_id) references public.participants(id) on delete set null;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'participants_last_opponent_participant_id_fkey'
  ) then
    alter table public.participants
      add constraint participants_last_opponent_participant_id_fkey
      foreign key (last_opponent_participant_id) references public.participants(id) on delete set null;
  end if;
end
$$;

create unique index if not exists participant_sessions_one_active_session_idx
  on public.participant_sessions (participant_id)
  where is_active = true;

create index if not exists participants_status_idx on public.participants (event_id, status);
create index if not exists participants_queue_idx on public.participants (event_id, queued_at);
create index if not exists participants_current_match_idx on public.participants (current_match_id);
create index if not exists tables_status_idx on public.tables (event_id, status);
create index if not exists matches_status_idx on public.matches (event_id, status, created_at desc);
create index if not exists chip_ledger_participant_idx on public.chip_ledger (participant_id, created_at desc);

drop trigger if exists set_events_updated_at on public.events;
create trigger set_events_updated_at
before update on public.events
for each row execute function public.set_updated_at();

drop trigger if exists set_admin_users_updated_at on public.admin_users;
create trigger set_admin_users_updated_at
before update on public.admin_users
for each row execute function public.set_updated_at();

drop trigger if exists set_matches_updated_at on public.matches;
create trigger set_matches_updated_at
before update on public.matches
for each row execute function public.set_updated_at();

drop trigger if exists set_participants_updated_at on public.participants;
create trigger set_participants_updated_at
before update on public.participants
for each row execute function public.set_updated_at();

drop trigger if exists set_tables_updated_at on public.tables;
create trigger set_tables_updated_at
before update on public.tables
for each row execute function public.set_updated_at();
