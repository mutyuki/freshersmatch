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
  v_now timestamptz := timezone('utc', now());
  v_event_id uuid;
  v_event public.events%rowtype;
  v_participant public.participants%rowtype;
  v_opponent public.participants%rowtype;
  v_table public.tables%rowtype;
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
      queued_at = v_now
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
  end if;

  if v_opponent.status <> 'queueing'
     or v_opponent.current_match_id is not null
     or v_opponent.chip_balance <= 0 then
    match_id := null;
    participant_status := v_participant.status;
    return next;
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
  end if;

  if v_table.status <> 'available' or v_table.current_match_id is not null then
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
    v_table.id,
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
