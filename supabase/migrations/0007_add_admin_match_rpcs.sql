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
    order by table_number
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
    status = 'match_reserved',
    last_non_disconnect_status = 'match_reserved',
    current_match_id = v_match_id,
    queued_at = null
  where id = v_participant.id
  returning *
  into v_participant;

  update public.tables
  set
    status = 'reserved',
    current_match_id = v_match_id,
    held_by_admin_user_id = null
  where id = v_table.id
  returning *
  into v_table;

  match_id := v_match_id;
  return next;
end;
$$;

create or replace function public.resolve_staff_match(
  p_admin_user_id uuid,
  p_match_id uuid,
  p_participant_won boolean
)
returns table (
  match_status text
)
language plpgsql
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_admin_id uuid;
  v_match public.matches%rowtype;
  v_match_locked public.matches%rowtype;
  v_event public.events%rowtype;
  v_participant public.participants%rowtype;
  v_table public.tables%rowtype;
  v_payout integer := 0;
begin
  select id
  into v_admin_id
  from public.admin_users
  where id = p_admin_user_id;

  if v_admin_id is null then
    raise exception 'Admin user not found: %', p_admin_user_id;
  end if;

  select *
  into v_match
  from public.matches
  where id = p_match_id;

  if not found then
    raise exception 'Match not found: %', p_match_id;
  end if;

  select *
  into v_event
  from public.events
  where id = v_match.event_id
  for update;

  if not found then
    raise exception 'Event not found for match: %', p_match_id;
  end if;

  select *
  into v_participant
  from public.participants
  where id = v_match.player1_participant_id
  for update;

  if not found then
    raise exception 'Participant not found for staff match: %', v_match.player1_participant_id;
  end if;

  select *
  into v_match_locked
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match not found while locking: %', p_match_id;
  end if;

  if not v_match_locked.is_staff_match then
    raise exception 'Match is not a staff match: %', p_match_id;
  end if;

  select *
  into v_table
  from public.tables
  where id = v_match_locked.table_id
  for update;

  if not found then
    raise exception 'Table not found for match: %', v_match_locked.table_id;
  end if;

  if v_match_locked.status = 'completed' then
    match_status := v_match_locked.status;
    return next;
    return;
  end if;

  if v_match_locked.status in ('voided_by_admin', 'force_finished_by_admin') then
    raise exception 'Staff match cannot be resolved from status: %', v_match_locked.status;
  end if;

  if v_match_locked.status not in ('in_progress', 'winner_claimed') then
    raise exception 'Staff match is not resolvable from status: %', v_match_locked.status;
  end if;

  if v_match_locked.agreed_bet_amount is null or v_match_locked.agreed_bet_amount <= 0 then
    raise exception 'Staff match must have a positive agreed bet amount: %', p_match_id;
  end if;

  if p_participant_won then
    v_payout := v_match_locked.agreed_bet_amount * 2;

    update public.participants
    set chip_balance = chip_balance + v_payout
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
      v_match_locked.id,
      v_payout,
      'match_payout',
      v_participant.chip_balance,
      v_admin_id
    );
  end if;

  update public.matches
  set
    status = 'completed',
    winner_participant_id = case
      when p_participant_won then v_participant.id
      else null
    end,
    winner_claimed_by_participant_id = null,
    winner_claimed_at = null,
    completed_at = v_now,
    cancelled_by_participant_id = null,
    void_reason = null
  where id = v_match_locked.id
  returning *
  into v_match_locked;

  update public.participants
  set
    status = 'result_confirmed',
    last_non_disconnect_status = 'result_confirmed',
    queued_at = null
  where id = v_participant.id
  returning *
  into v_participant;

  update public.tables
  set
    status = 'available',
    current_match_id = null,
    held_by_admin_user_id = null
  where id = v_table.id
  returning *
  into v_table;

  match_status := v_match_locked.status;
  return next;
end;
$$;

create or replace function public.resolve_match_by_admin(
  p_admin_user_id uuid,
  p_match_id uuid,
  p_resolution_type text,
  p_winner_participant_id uuid
)
returns table (
  match_status text
)
language plpgsql
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_admin_id uuid;
  v_match public.matches%rowtype;
  v_match_locked public.matches%rowtype;
  v_event public.events%rowtype;
  v_player1 public.participants%rowtype;
  v_player2 public.participants%rowtype;
  v_locked_participant public.participants%rowtype;
  v_table public.tables%rowtype;
  v_refund_amount integer := 0;
  v_payout integer := 0;
begin
  select id
  into v_admin_id
  from public.admin_users
  where id = p_admin_user_id;

  if v_admin_id is null then
    raise exception 'Admin user not found: %', p_admin_user_id;
  end if;

  if p_resolution_type not in ('void', 'winner') then
    raise exception 'Unsupported admin match resolution type: %', p_resolution_type;
  end if;

  if p_resolution_type = 'void' and p_winner_participant_id is not null then
    raise exception 'Winner participant must be null when voiding a match: %', p_match_id;
  end if;

  if p_resolution_type = 'winner' and p_winner_participant_id is null then
    raise exception 'Winner participant is required for winner resolution: %', p_match_id;
  end if;

  select *
  into v_match
  from public.matches
  where id = p_match_id;

  if not found then
    raise exception 'Match not found: %', p_match_id;
  end if;

  select *
  into v_event
  from public.events
  where id = v_match.event_id
  for update;

  if not found then
    raise exception 'Event not found for match: %', p_match_id;
  end if;

  for v_locked_participant in
    select *
    from public.participants
    where id in (
      v_match.player1_participant_id,
      coalesce(v_match.player2_participant_id, v_match.player1_participant_id)
    )
    order by id
    for update
  loop
    if v_locked_participant.id = v_match.player1_participant_id then
      v_player1 := v_locked_participant;
    elsif v_match.player2_participant_id is not null and v_locked_participant.id = v_match.player2_participant_id then
      v_player2 := v_locked_participant;
    end if;
  end loop;

  if v_player1.id is null then
    raise exception 'Player1 not found while locking for match: %', p_match_id;
  end if;

  if v_match.player2_participant_id is not null and v_player2.id is null then
    raise exception 'Player2 not found while locking for match: %', p_match_id;
  end if;

  select *
  into v_match_locked
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match not found while locking: %', p_match_id;
  end if;

  select *
  into v_table
  from public.tables
  where id = v_match_locked.table_id
  for update;

  if not found then
    raise exception 'Table not found for match: %', v_match_locked.table_id;
  end if;

  if v_match_locked.status in ('voided_by_admin', 'force_finished_by_admin') then
    match_status := v_match_locked.status;
    return next;
    return;
  end if;

  if p_resolution_type = 'winner' then
    if v_match_locked.is_staff_match then
      raise exception 'Staff matches must be resolved with resolve_staff_match: %', p_match_id;
    end if;

    if p_winner_participant_id not in (v_player1.id, v_player2.id) then
      raise exception 'Winner participant % is not part of match %', p_winner_participant_id, p_match_id;
    end if;
  end if;

  if p_resolution_type = 'void' then
    if v_match_locked.status not in ('reserved', 'awaiting_ready', 'in_progress', 'winner_claimed') then
      raise exception 'Match cannot be voided from status: %', v_match_locked.status;
    end if;

    v_refund_amount := coalesce(v_match_locked.agreed_bet_amount, 0);

    if v_match_locked.status in ('in_progress', 'winner_claimed') then
      if v_refund_amount <= 0 then
        raise exception 'Rollback amount must be positive for started match: %', p_match_id;
      end if;

      update public.participants
      set chip_balance = chip_balance + v_refund_amount
      where id = v_player1.id
      returning *
      into v_player1;

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
        v_player1.id,
        v_match_locked.id,
        v_refund_amount,
        'rollback',
        v_player1.chip_balance,
        v_admin_id
      );

      if v_player2.id is not null then
        update public.participants
        set chip_balance = chip_balance + v_refund_amount
        where id = v_player2.id
        returning *
        into v_player2;

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
          v_player2.id,
          v_match_locked.id,
          v_refund_amount,
          'rollback',
          v_player2.chip_balance,
          v_admin_id
        );
      end if;
    end if;

    update public.matches
    set
      status = 'voided_by_admin',
      winner_participant_id = null,
      winner_claimed_by_participant_id = null,
      winner_claimed_at = null,
      completed_at = null,
      cancelled_by_participant_id = null,
      void_reason = 'resolved_by_admin'
    where id = v_match_locked.id
    returning *
    into v_match_locked;

    update public.participants
    set
      status = 'registered',
      last_non_disconnect_status = 'registered',
      current_match_id = null,
      queued_at = null
    where id in (
      v_player1.id,
      coalesce(v_player2.id, v_player1.id)
    );

    update public.tables
    set
      status = 'available',
      current_match_id = null,
      held_by_admin_user_id = null
    where id = v_table.id
    returning *
    into v_table;

    match_status := v_match_locked.status;
    return next;
    return;
  end if;

  if v_match_locked.status not in ('in_progress', 'winner_claimed') then
    raise exception 'Match cannot be force-finished from status: %', v_match_locked.status;
  end if;

  if v_match_locked.agreed_bet_amount is null or v_match_locked.agreed_bet_amount <= 0 then
    raise exception 'Started match must have a positive agreed bet amount: %', p_match_id;
  end if;

  v_payout := v_match_locked.agreed_bet_amount * 2;

  if p_winner_participant_id = v_player1.id then
    update public.participants
    set chip_balance = chip_balance + v_payout
    where id = v_player1.id
    returning *
    into v_player1;
  else
    update public.participants
    set chip_balance = chip_balance + v_payout
    where id = v_player2.id
    returning *
    into v_player2;
  end if;

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
    p_winner_participant_id,
    v_match_locked.id,
    v_payout,
    'match_payout',
    case
      when p_winner_participant_id = v_player1.id then v_player1.chip_balance
      else v_player2.chip_balance
    end,
    v_admin_id
  );

  update public.matches
  set
    status = 'force_finished_by_admin',
    winner_participant_id = p_winner_participant_id,
    winner_claimed_by_participant_id = null,
    winner_claimed_at = null,
    completed_at = v_now,
    cancelled_by_participant_id = null,
    void_reason = null
  where id = v_match_locked.id
  returning *
  into v_match_locked;

  update public.participants
  set
    status = 'result_confirmed',
    last_non_disconnect_status = 'result_confirmed',
    queued_at = null,
    last_opponent_participant_id = case
      when v_match_locked.is_staff_match then last_opponent_participant_id
      when id = v_player1.id then v_player2.id
      else v_player1.id
    end
  where id in (v_player1.id, v_player2.id);

  update public.tables
  set
    status = 'available',
    current_match_id = null,
    held_by_admin_user_id = null
  where id = v_table.id
  returning *
  into v_table;

  match_status := v_match_locked.status;
  return next;
end;
$$;
