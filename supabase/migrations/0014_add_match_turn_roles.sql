alter table public.matches
add column if not exists player1_turn_role text,
add column if not exists player2_turn_role text;

alter table public.matches
drop constraint if exists matches_player1_turn_role_check,
drop constraint if exists matches_player2_turn_role_check;

alter table public.matches
add constraint matches_player1_turn_role_check
check (player1_turn_role in ('first', 'second') or player1_turn_role is null),
add constraint matches_player2_turn_role_check
check (player2_turn_role in ('first', 'second') or player2_turn_role is null);

update public.matches
set
  player1_turn_role = 'first',
  player2_turn_role = 'second'
where is_staff_match = false
  and player2_participant_id is not null
  and (player1_turn_role is null or player2_turn_role is null);

create or replace function public.start_queue_and_try_match(
  p_participant_id uuid,
  p_opponent_participant_id uuid default null,
  p_table_id uuid default null
)
returns table (
  match_id uuid,
  participant_status text
)
language plpgsql
set search_path = public
as $$
declare
  v_event_id uuid;
  v_event public.events%rowtype;
  v_participant public.participants%rowtype;
  v_opponent public.participants%rowtype;
  v_table public.tables%rowtype;
  v_match public.matches%rowtype;
  v_player1_turn_role text;
  v_player2_turn_role text;
begin
  select event_id
  into v_event_id
  from public.participants
  where id = p_participant_id;

  if v_event_id is null then
    raise exception 'Participant not found: %', p_participant_id;
  end if;

  select *
  into v_event
  from public.events
  where id = v_event_id
  for update;

  if not found or v_event.status <> 'active' then
    raise exception 'Active event not found for participant: %', p_participant_id;
  end if;

  select *
  into v_participant
  from public.participants
  where id = p_participant_id
  for update;

  if not found then
    raise exception 'Participant not found while locking: %', p_participant_id;
  end if;

  if v_participant.status = 'registered' then
    if v_participant.current_match_id is not null then
      raise exception 'Participant already has an active match: %', v_participant.current_match_id;
    end if;

    if v_participant.chip_balance <= 0 then
      raise exception 'Participant chip balance must be positive to start queueing: %', p_participant_id;
    end if;

    update public.participants
    set
      status = 'queueing',
      last_non_disconnect_status = 'queueing',
      queued_at = timezone('utc', now())
    where id = v_participant.id
    returning *
    into v_participant;
  elsif v_participant.status = 'queueing' then
    if v_participant.current_match_id is not null then
      raise exception 'Participant already has an active match: %', v_participant.current_match_id;
    end if;

    if v_participant.chip_balance <= 0 then
      raise exception 'Participant chip balance must be positive to start queueing: %', p_participant_id;
    end if;
  else
    raise exception 'Participant is not in queueable status: %', v_participant.status;
  end if;

  if p_opponent_participant_id is null or p_table_id is null or p_opponent_participant_id = v_participant.id then
    match_id := null;
    participant_status := v_participant.status;
    return next;
    return;
  end if;

  select *
  into v_opponent
  from public.participants
  where id = p_opponent_participant_id
    and event_id = v_event.id
  for update;

  if not found then
    match_id := null;
    participant_status := v_participant.status;
    return next;
    return;
  end if;

  if v_opponent.status <> 'queueing'
     or v_opponent.current_match_id is not null
     or v_opponent.chip_balance <= 0 then
    match_id := null;
    participant_status := v_participant.status;
    return next;
    return;
  end if;

  select *
  into v_table
  from public.tables
  where id = p_table_id
    and event_id = v_event.id
  for update;

  if not found then
    match_id := null;
    participant_status := v_participant.status;
    return next;
    return;
  end if;

  if v_table.status <> 'available' or v_table.current_match_id is not null then
    match_id := null;
    participant_status := v_participant.status;
    return next;
    return;
  end if;

  if random() < 0.5 then
    v_player1_turn_role := 'first';
    v_player2_turn_role := 'second';
  else
    v_player1_turn_role := 'second';
    v_player2_turn_role := 'first';
  end if;

  insert into public.matches (
    event_id,
    table_id,
    player1_participant_id,
    player2_participant_id,
    status,
    is_staff_match,
    player1_turn_role,
    player2_turn_role
  )
  values (
    v_event.id,
    v_table.id,
    v_participant.id,
    v_opponent.id,
    'reserved',
    false,
    v_player1_turn_role,
    v_player2_turn_role
  )
  returning *
  into v_match;

  update public.participants
  set
    status = 'match_reserved',
    last_non_disconnect_status = 'match_reserved',
    current_match_id = v_match.id,
    queued_at = null
  where id in (v_participant.id, v_opponent.id);

  update public.tables
  set
    status = 'reserved',
    current_match_id = v_match.id
  where id = v_table.id;

  select *
  into v_participant
  from public.participants
  where id = v_participant.id;

  match_id := v_match.id;
  participant_status := v_participant.status;
  return next;
end;
$$;
