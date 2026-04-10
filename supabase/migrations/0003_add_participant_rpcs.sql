create or replace function public.register_participant_and_issue_session(
  p_venue_code text,
  p_nickname text,
  p_session_token_hash text
)
returns table (
  participant_id uuid,
  event_id uuid,
  session_id uuid,
  chip_balance integer
)
language plpgsql
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_event public.events%rowtype;
  v_participant public.participants%rowtype;
  v_session public.participant_sessions%rowtype;
begin
  select *
  into v_event
  from public.events
  where venue_code = p_venue_code
    and status = 'active'
  for update;

  if not found then
    raise exception 'Active event not found for venue code: %', p_venue_code;
  end if;

  if exists (
    select 1
    from public.participants
    where event_id = v_event.id
      and nickname = p_nickname
  ) then
    raise exception 'Participant nickname is already registered in this event: %', p_nickname;
  end if;

  insert into public.participants (
    event_id,
    nickname,
    status,
    last_non_disconnect_status,
    chip_balance,
    last_seen_at
  )
  values (
    v_event.id,
    p_nickname,
    'registered',
    'registered',
    v_event.initial_chip_balance,
    v_now
  )
  returning *
  into v_participant;

  update public.participant_sessions
  set
    is_active = false,
    invalidated_at = v_now
  where participant_id = v_participant.id
    and is_active = true;

  insert into public.participant_sessions (
    participant_id,
    session_token_hash,
    is_active,
    issued_at,
    last_seen_at
  )
  values (
    v_participant.id,
    p_session_token_hash,
    true,
    v_now,
    v_now
  )
  returning *
  into v_session;

  participant_id := v_participant.id;
  event_id := v_event.id;
  session_id := v_session.id;
  chip_balance := v_participant.chip_balance;

  return next;
end;
$$;

create or replace function public.start_queue_and_try_match(
  p_participant_id uuid
)
returns table (
  match_id uuid,
  participant_status text
)
language plpgsql
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_event_id uuid;
  v_event public.events%rowtype;
  v_participant public.participants%rowtype;
  v_opponent public.participants%rowtype;
  v_table_id uuid;
  v_match public.matches%rowtype;
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
    and status = 'active'
  for update;

  if not found then
    raise exception 'Active event not found for participant: %', p_participant_id;
  end if;

  select *
  into v_participant
  from public.participants
  where id = p_participant_id
  for update;

  if not found then
    raise exception 'Participant not found: %', p_participant_id;
  end if;

  if v_participant.status <> 'registered' then
    raise exception 'Participant is not in registered status: %', v_participant.status;
  end if;

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
    queued_at = v_now
  where id = v_participant.id
  returning *
  into v_participant;

  select *
  into v_opponent
  from public.participants
  where event_id = v_event.id
    and id <> v_participant.id
    and status = 'queueing'
    and current_match_id is null
    and chip_balance > 0
  order by
    case
      when v_participant.last_opponent_participant_id is not null
        and id = v_participant.last_opponent_participant_id then 1
      else 0
    end,
    random()
  for update skip locked
  limit 1;

  if not found then
    match_id := null;
    participant_status := v_participant.status;
    return next;
  end if;

  select id
  into v_table_id
  from public.tables
  where event_id = v_event.id
    and status = 'available'
    and current_match_id is null
  order by table_number asc
  limit 1;

  if v_table_id is null then
    match_id := null;
    participant_status := v_participant.status;
    return next;
  end if;

  insert into public.matches (
    event_id,
    table_id,
    player1_participant_id,
    player2_participant_id,
    status,
    is_staff_match
  )
  values (
    v_event.id,
    v_table_id,
    v_participant.id,
    v_opponent.id,
    'reserved',
    false
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

  select *
  into v_participant
  from public.participants
  where id = v_participant.id;

  perform 1
  from public.tables
  where id = v_table_id
    and status = 'available'
    and current_match_id is null
  for update;

  if not found then
    raise exception 'Available table vanished during match reservation: %', v_table_id;
  end if;

  update public.tables
  set
    status = 'reserved',
    current_match_id = v_match.id
  where id = v_table_id;

  match_id := v_match.id;
  participant_status := v_participant.status;
  return next;
end;
$$;

create or replace function public.cancel_queue(
  p_participant_id uuid
)
returns table (
  participant_status text
)
language plpgsql
set search_path = public
as $$
declare
  v_event_id uuid;
  v_event public.events%rowtype;
  v_participant public.participants%rowtype;
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

  if not found then
    raise exception 'Event not found for participant: %', p_participant_id;
  end if;

  select *
  into v_participant
  from public.participants
  where id = p_participant_id
  for update;

  if not found then
    raise exception 'Participant not found: %', p_participant_id;
  end if;

  if v_participant.status <> 'queueing' then
    raise exception 'Participant is not queueing: %', v_participant.status;
  end if;

  update public.participants
  set
    status = 'registered',
    last_non_disconnect_status = 'registered',
    queued_at = null
  where id = v_participant.id
  returning *
  into v_participant;

  participant_status := v_participant.status;
  return next;
end;
$$;

create or replace function public.acknowledge_result_confirmed(
  p_participant_id uuid
)
returns table (
  participant_status text
)
language plpgsql
set search_path = public
as $$
declare
  v_event_id uuid;
  v_event public.events%rowtype;
  v_participant public.participants%rowtype;
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

  if not found then
    raise exception 'Event not found for participant: %', p_participant_id;
  end if;

  select *
  into v_participant
  from public.participants
  where id = p_participant_id
  for update;

  if not found then
    raise exception 'Participant not found: %', p_participant_id;
  end if;

  if v_participant.status = 'registered' then
    participant_status := v_participant.status;
    return next;
    return;
  end if;

  if v_participant.status <> 'result_confirmed' then
    raise exception 'Participant is not ready to acknowledge result: %', v_participant.status;
  end if;

  update public.participants
  set
    status = 'registered',
    last_non_disconnect_status = 'registered',
    current_match_id = null
  where id = v_participant.id
  returning *
  into v_participant;

  participant_status := v_participant.status;
  return next;
end;
$$;
