create or replace function public.start_staff_match(
  p_admin_user_id uuid,
  p_participant_id uuid,
  p_table_id uuid
)
returns table (
  match_id uuid
)
language plpgsql
set search_path = public
as $$
declare
  v_event_id uuid;
  v_event public.events%rowtype;
  v_admin_id uuid;
  v_participant public.participants%rowtype;
  v_table public.tables%rowtype;
  v_match_id uuid;
begin
  select id
  into v_admin_id
  from public.admin_users
  where id = p_admin_user_id;

  if v_admin_id is null then
    raise exception 'Admin user not found: %', p_admin_user_id;
  end if;

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
    raise exception 'Participant not found while locking: %', p_participant_id;
  end if;

  if v_participant.status <> 'queueing' then
    raise exception 'Participant is not queueing for a staff match: %', v_participant.status;
  end if;

  if v_participant.current_match_id is not null then
    raise exception 'Participant already has an active match: %', v_participant.current_match_id;
  end if;

  if v_participant.chip_balance <= 0 then
    raise exception 'Participant must have a positive chip balance to start a staff match: %', p_participant_id;
  end if;

  if p_table_id is not null then
    select *
    into v_table
    from public.tables
    where id = p_table_id
      and event_id = v_event.id
    for update;

    if not found then
      raise exception 'Table not found for event: %', p_table_id;
    end if;

    if v_table.status <> 'available' then
      raise exception 'Table is not available for a staff match: %', v_table.status;
    end if;
  else
    select *
    into v_table
    from public.tables
    where event_id = v_event.id
      and status = 'available'
    order by random()
    limit 1
    for update;

    if not found then
      raise exception 'No available table found for event: %', v_event.id;
    end if;
  end if;

  insert into public.matches (
    event_id,
    table_id,
    player1_participant_id,
    player2_participant_id,
    status,
    is_staff_match,
    staff_operator_id
  )
  values (
    v_event.id,
    v_table.id,
    v_participant.id,
    null,
    'reserved',
    true,
    v_admin_id
  )
  returning id
  into v_match_id;

  update public.participants
  set
    status = 'playing',
    last_non_disconnect_status = 'playing',
    current_match_id = v_match_id,
    queued_at = null,
    updated_at = timezone('utc', now())
  where id = v_participant.id;

  update public.tables
  set
    status = 'in_use',
    current_match_id = v_match_id,
    updated_at = timezone('utc', now())
  where id = v_table.id;

  match_id := v_match_id;
  return next;
end;
$$;
