create or replace function public.disqualify_participant(
  p_admin_user_id uuid,
  p_participant_id uuid,
  p_mode text,
  p_reason text
)
returns table (
  participant_status text,
  affected_match_id uuid
)
language plpgsql
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
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
  v_payout integer := 0;
begin
  if p_reason is null then
    raise exception 'Disqualification reason is required';
  end if;

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

  if p_mode not in ('void_current_match', 'lose_current_match') then
    raise exception 'Unsupported disqualification mode: %', p_mode;
  end if;

  if v_participant.current_match_id is null then
    update public.participants
    set
      status = 'disqualified',
      last_non_disconnect_status = 'disqualified',
      current_match_id = null,
      queued_at = null,
      disqualified_reason = p_reason
    where id = v_participant.id
    returning *
    into v_participant;

    participant_status := v_participant.status;
    affected_match_id := null;
    return next;
    return;
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

  if v_match.status not in ('reserved', 'awaiting_ready', 'in_progress', 'winner_claimed') then
    update public.participants
    set
      status = 'disqualified',
      last_non_disconnect_status = 'disqualified',
      current_match_id = null,
      queued_at = null,
      disqualified_reason = p_reason
    where id = v_participant.id
    returning *
    into v_participant;

    participant_status := v_participant.status;
    affected_match_id := null;
    return next;
    return;
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

  if p_mode = 'void_current_match' then
    if v_match_locked.status not in ('reserved', 'awaiting_ready', 'in_progress', 'winner_claimed') then
      raise exception 'Participant current match cannot be voided from status: %', v_match_locked.status;
    end if;

    if v_actor.status not in (
      'match_reserved',
      'ready',
      'playing',
      'claiming_win',
      'awaiting_result_approval'
    ) then
      raise exception 'Participant cannot be disqualified from active match status: %', v_actor.status;
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
      void_reason = 'participant_disqualified_by_admin',
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
      status = 'disqualified',
      last_non_disconnect_status = 'disqualified',
      current_match_id = null,
      queued_at = null,
      disqualified_reason = p_reason
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
    return;
  end if;

  if v_match_locked.is_staff_match then
    raise exception 'Participant cannot lose a staff match by disqualification: %', v_match_locked.id;
  end if;

  if v_match_locked.status not in ('in_progress', 'winner_claimed') then
    raise exception 'Participant current match cannot be force-finished from status: %', v_match_locked.status;
  end if;

  if v_opponent.id is null then
    raise exception 'Opponent not found for match: %', v_match_locked.id;
  end if;

  if v_actor.status not in ('playing', 'claiming_win', 'awaiting_result_approval') then
    raise exception 'Participant cannot lose current match from status: %', v_actor.status;
  end if;

  if v_match_locked.agreed_bet_amount is null or v_match_locked.agreed_bet_amount <= 0 then
    raise exception 'Started match must have a positive agreed bet amount: %', v_match_locked.id;
  end if;

  v_payout := v_match_locked.agreed_bet_amount * 2;

  update public.matches
  set
    status = 'force_finished_by_admin',
    winner_participant_id = v_opponent.id,
    winner_claimed_by_participant_id = null,
    winner_claimed_at = null,
    completed_at = v_now,
    cancelled_by_participant_id = null,
    void_reason = null
  where id = v_match_locked.id
  returning *
  into v_match_locked;

  update public.participants
  set chip_balance = chip_balance + v_payout
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
    v_payout,
    'match_payout',
    v_opponent.chip_balance,
    v_admin_id
  );

  update public.participants
  set
    status = 'disqualified',
    last_non_disconnect_status = 'disqualified',
    current_match_id = null,
    queued_at = null,
    disqualified_reason = p_reason,
    last_opponent_participant_id = v_opponent.id
  where id = v_actor.id
  returning *
  into v_actor;

  update public.participants
  set
    status = 'result_confirmed',
    last_non_disconnect_status = 'result_confirmed',
    current_match_id = null,
    queued_at = null,
    last_opponent_participant_id = v_actor.id
  where id = v_opponent.id
  returning *
  into v_opponent;

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

create or replace function public.force_release_table(
  p_admin_user_id uuid,
  p_table_id uuid
)
returns table (
  table_status text,
  affected_match_id uuid
)
language plpgsql
set search_path = public
as $$
declare
  v_table public.tables%rowtype;
  v_event public.events%rowtype;
  v_match public.matches%rowtype;
  v_match_locked public.matches%rowtype;
  v_admin_id uuid;
  v_player1 public.participants%rowtype;
  v_player2 public.participants%rowtype;
  v_locked_participant public.participants%rowtype;
  v_refund_amount integer := 0;
begin
  select id
  into v_admin_id
  from public.admin_users
  where id = p_admin_user_id;

  if v_admin_id is null then
    raise exception 'Admin user not found: %', p_admin_user_id;
  end if;

  select *
  into v_table
  from public.tables
  where id = p_table_id;

  if not found then
    raise exception 'Table not found: %', p_table_id;
  end if;

  select *
  into v_event
  from public.events
  where id = v_table.event_id
  for update;

  if not found then
    raise exception 'Event not found for table: %', p_table_id;
  end if;

  if v_table.current_match_id is not null then
    select *
    into v_match
    from public.matches
    where id = v_table.current_match_id;

    if not found then
      raise exception 'Current match not found for table: %', v_table.current_match_id;
    end if;

    if v_match.event_id <> v_event.id then
      raise exception 'Current match % does not belong to table event %', v_match.id, v_event.id;
    end if;
  end if;

  if v_table.current_match_id is not null and v_match.status in ('reserved', 'awaiting_ready', 'in_progress', 'winner_claimed') then
    select *
    into v_match_locked
    from public.matches
    where id = v_match.id
    for update;

    if not found then
      raise exception 'Current match not found while locking: %', v_match.id;
    end if;

    for v_locked_participant in
      select *
      from public.participants
      where id in (
        v_match_locked.player1_participant_id,
        coalesce(v_match_locked.player2_participant_id, v_match_locked.player1_participant_id)
      )
      order by id
      for update
    loop
      if v_locked_participant.id = v_match_locked.player1_participant_id then
        v_player1 := v_locked_participant;
      elsif v_match_locked.player2_participant_id is not null then
        v_player2 := v_locked_participant;
      end if;
    end loop;
  end if;

  select *
  into v_table
  from public.tables
  where id = p_table_id
  for update;

  if not found then
    raise exception 'Table not found while locking: %', p_table_id;
  end if;

  if v_table.current_match_id is null or v_match.id is null or v_match.status not in ('reserved', 'awaiting_ready', 'in_progress', 'winner_claimed') then
    update public.tables
    set
      status = 'available',
      current_match_id = null,
      held_by_admin_user_id = null
    where id = v_table.id
    returning *
    into v_table;

    table_status := v_table.status;
    affected_match_id := null;
    return next;
    return;
  end if;

  v_refund_amount := coalesce(v_match_locked.agreed_bet_amount, 0);

  if v_match_locked.status in ('in_progress', 'winner_claimed') then
    if v_refund_amount <= 0 then
      raise exception 'Rollback amount must be positive for started match: %', v_match_locked.id;
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
    void_reason = 'table_force_released_by_admin',
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
    status = 'registered',
    last_non_disconnect_status = 'registered',
    current_match_id = null,
    queued_at = null
  where id = v_player1.id
  returning *
  into v_player1;

  if v_player2.id is not null then
    update public.participants
    set
      status = 'registered',
      last_non_disconnect_status = 'registered',
      current_match_id = null,
      queued_at = null
    where id = v_player2.id
    returning *
    into v_player2;
  end if;

  update public.tables
  set
    status = 'available',
    current_match_id = null,
    held_by_admin_user_id = null
  where id = v_table.id
  returning *
  into v_table;

  table_status := v_table.status;
  affected_match_id := v_match_locked.id;
  return next;
end;
$$;

create or replace function public.hold_table_by_admin(
  p_admin_user_id uuid,
  p_table_id uuid
)
returns table (
  table_status text
)
language plpgsql
set search_path = public
as $$
declare
  v_table public.tables%rowtype;
  v_event public.events%rowtype;
  v_event_id uuid;
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
  from public.tables
  where id = p_table_id;

  if v_event_id is null then
    raise exception 'Table not found: %', p_table_id;
  end if;

  select *
  into v_event
  from public.events
  where id = v_event_id
  for update;

  if not found then
    raise exception 'Event not found for table: %', p_table_id;
  end if;

  select *
  into v_table
  from public.tables
  where id = p_table_id
  for update;

  if not found then
    raise exception 'Table not found while locking: %', p_table_id;
  end if;

  if v_table.status = 'admin_hold' then
    table_status := v_table.status;
    return next;
    return;
  end if;

  if v_table.status <> 'available' then
    raise exception 'Table cannot be held from status: %', v_table.status;
  end if;

  update public.tables
  set
    status = 'admin_hold',
    held_by_admin_user_id = v_admin_id,
    current_match_id = null
  where id = v_table.id
  returning *
  into v_table;

  table_status := v_table.status;
  return next;
end;
$$;

create or replace function public.release_table_admin_hold(
  p_admin_user_id uuid,
  p_table_id uuid
)
returns table (
  table_status text
)
language plpgsql
set search_path = public
as $$
declare
  v_table public.tables%rowtype;
  v_event public.events%rowtype;
  v_event_id uuid;
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
  from public.tables
  where id = p_table_id;

  if v_event_id is null then
    raise exception 'Table not found: %', p_table_id;
  end if;

  select *
  into v_event
  from public.events
  where id = v_event_id
  for update;

  if not found then
    raise exception 'Event not found for table: %', p_table_id;
  end if;

  select *
  into v_table
  from public.tables
  where id = p_table_id
  for update;

  if not found then
    raise exception 'Table not found while locking: %', p_table_id;
  end if;

  if v_table.status <> 'admin_hold' then
    table_status := v_table.status;
    return next;
    return;
  end if;

  update public.tables
  set
    status = 'available',
    current_match_id = null,
    held_by_admin_user_id = null
  where id = v_table.id
  returning *
  into v_table;

  table_status := v_table.status;
  return next;
end;
$$;
