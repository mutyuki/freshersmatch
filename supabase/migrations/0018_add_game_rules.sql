create table if not exists public.game_rules (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.game_rules enable row level security;

alter table public.tables
  add column if not exists game_rule_id uuid references public.game_rules(id) on delete set null;

create index if not exists game_rules_event_id_idx on public.game_rules (event_id, updated_at desc);
create index if not exists tables_game_rule_id_idx on public.tables (game_rule_id);

drop trigger if exists set_game_rules_updated_at on public.game_rules;
create trigger set_game_rules_updated_at
before update on public.game_rules
for each row execute function public.set_updated_at();
