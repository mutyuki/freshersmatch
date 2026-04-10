create or replace function public.adjust_participant_chip(
  p_admin_user_id uuid,
  p_participant_id uuid,
  p_delta integer,
  p_reason text
)
returns table (
  new_balance integer
)
language plpgsql
set search_path = public
as $$
declare
  v_event_id uuid;
  v_event public.events%rowtype;
  v_participant public.participants%rowtype;
  v_admin_id uuid;
begin
  perform p_reason;

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

  if v_participant.chip_balance + p_delta < 0 then
    raise exception 'Participant chip balance cannot go negative: participant %, current %, delta %',
      p_participant_id,
      v_participant.chip_balance,
      p_delta;
  end if;

  if p_delta = 0 then
    new_balance := v_participant.chip_balance;
    return next;
    return;
  end if;

  update public.participants
  set chip_balance = chip_balance + p_delta
  where id = v_participant.id
  returning *
  into v_participant;

  insert into public.chip_ledger (
    event_id,
    participant_id,
    match_id,
    delta,
    reason,
    balance_after,
    created_by_admin_user_id
  )
  values (
    v_event.id,
    v_participant.id,
    null,
    p_delta,
    'admin_adjustment',
    v_participant.chip_balance,
    v_admin_id
  );

  new_balance := v_participant.chip_balance;
  return next;
end;
$$;

create or replace function public.pause_participant(
  p_admin_user_id uuid,
  p_participant_id uuid
)
returns table (
  participant_status text,
  affected_match_id uuid
)
language plpgsql
set search_path = public
as $$
declare
  v_event_id uuid;
  v_event public.events%rowtype;
  v_admin_id uuid;
  v_participant public.participants%rowtype;
  v_actor public.participants%rowtype;
  v_opponent public.participants%rowtype;
  v_locked_participant public.participants%rowtype;
  v_match public.matches%rowtype;
  v_match_locked public.matches%rowtype;
  v_table public.tables%rowtype;
  v_refund_amount integer := 0;
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

  if v_participant.status = 'paused' then
    participant_status := v_participant.status;
    affected_match_id := null;
    return next;
    return;
  end if;

  if v_participant.current_match_id is null then
    if v_participant.status = 'registered' then
      update public.participants
      set
        status = 'paused',
        last_non_disconnect_status = 'paused'
      where id = v_participant.id
      returning *
      into v_participant;

      participant_status := v_participant.status;
      affected_match_id := null;
      return next;
      return;
    end if;

    if v_participant.status = 'queueing' then
      update public.participants
      set
        status = 'paused',
        last_non_disconnect_status = 'paused',
        queued_at = null
      where id = v_participant.id
      returning *
      into v_participant;

      participant_status := v_participant.status;
      affected_match_id := null;
      return next;
      return;
    end if;

    raise exception 'Participant cannot be paused from status without active match: %', v_participant.status;
  end if;

  select *
  into v_match
  from public.matches
  where id = v_participant.current_match_id;

  if not found then
    raise exception 'Current match not found for participant: %', v_participant.current_match_id;
  end if;

  if v_match.event_id <> v_event.id then
    raise exception 'Current match % does not belong to participant event %', v_match.id, v_event.id;
  end if;

  for v_locked_participant in
    select *
    from public.participants
    where id in (v_match.player1_participant_id, coalesce(v_match.player2_participant_id, v_match.player1_participant_id))
    order by id
    for update
  loop
    if v_locked_participant.id = p_participant_id then
      v_actor := v_locked_participant;
    elsif v_match.player2_participant_id is not null then
      v_opponent := v_locked_participant;
    end if;
  end loop;

  if v_actor.id is null then
    raise exception 'Participant not found in current match while locking: %', p_participant_id;
  end if;

  select *
  into v_match_locked
  from public.matches
  where id = v_match.id
  for update;

  if not found then
    raise exception 'Current match not found while locking: %', v_match.id;
  end if;

  if p_participant_id not in (
    v_match_locked.player1_participant_id,
    coalesce(v_match_locked.player2_participant_id, p_participant_id)
  ) then
    raise exception 'Participant % is not part of current match %', p_participant_id, v_match_locked.id;
  end if;

  select *
  into v_table
  from public.tables
  where id = v_match_locked.table_id
  for update;

  if not found then
    raise exception 'Table not found for current match: %', v_match_locked.table_id;
  end if;

  if v_match_locked.status not in ('reserved', 'awaiting_ready', 'in_progress', 'winner_claimed') then
    raise exception 'Participant cannot be paused from match status: %', v_match_locked.status;
  end if;

  if v_actor.status not in ('match_reserved', 'ready', 'playing', 'claiming_win', 'awaiting_result_approval') then
    raise exception 'Participant cannot be paused from active match status: %', v_actor.status;
  end if;

  v_refund_amount := coalesce(v_match_locked.agreed_bet_amount, 0);

  if v_match_locked.status in ('in_progress', 'winner_claimed') then
    if v_refund_amount <= 0 then
      raise exception 'Rollback amount must be positive for started match: %', v_match_locked.id;
    end if;

    update public.participants
    set chip_balance = chip_balance + v_refund_amount
    where id = v_actor.id
    returning *
    into v_actor;

    insert into public.chip_ledger (
      event_id,
      participant_id,
      match_id,
      delta,
      reason,
      balance_after,
      created_by_admin_user_id
    )
    values (
      v_event.id,
      v_actor.id,
      v_match_locked.id,
      v_refund_amount,
      'rollback',
      v_actor.chip_balance,
      v_admin_id
    );

    if v_opponent.id is not null then
      update public.participants
      set chip_balance = chip_balance + v_refund_amount
      where id = v_opponent.id
      returning *
      into v_opponent;

      insert into public.chip_ledger (
        event_id,
        participant_id,
        match_id,
        delta,
        reason,
        balance_after,
        created_by_admin_user_id
      )
      values (
        v_event.id,
        v_opponent.id,
        v_match_locked.id,
        v_refund_amount,
        'rollback',
        v_opponent.chip_balance,
        v_admin_id
      );
    end if;
  end if;

  update public.matches
  set
    status = 'voided_by_admin',
    void_reason = 'participant_paused_by_admin',
    winner_participant_id = null,
    winner_claimed_by_participant_id = null,
    winner_claimed_at = null,
    completed_at = null,
    cancelled_by_participant_id = null
  where id = v_match_locked.id
  returning *
  into v_match_locked;

  update public.participants
  set
    status = 'paused',
    last_non_disconnect_status = 'paused',
    current_match_id = null,
    queued_at = null
  where id = v_actor.id
  returning *
  into v_actor;

  if v_opponent.id is not null then
    update public.participants
    set
      status = 'registered',
      last_non_disconnect_status = 'registered',
      current_match_id = null,
      queued_at = null
    where id = v_opponent.id
    returning *
    into v_opponent;
  end if;

  update public.tables
  set
    status = 'available',
    current_match_id = null,
    held_by_admin_user_id = null
  where id = v_table.id
  returning *
  into v_table;

  participant_status := v_actor.status;
  affected_match_id := v_match_locked.id;
  return next;
end;
$$;

create or replace function public.unpause_participant(
  p_admin_user_id uuid,
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
  v_admin_id uuid;
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

  if v_participant.status <> 'paused' then
    participant_status := v_participant.status;
    return next;
    return;
  end if;

  update public.participants
  set
    status = 'registered',
    last_non_disconnect_status = 'registered'
  where id = v_participant.id
  returning *
  into v_participant;

  participant_status := v_participant.status;
  return next;
end;
$$;
