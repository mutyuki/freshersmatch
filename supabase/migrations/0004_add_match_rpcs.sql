create or replace function public.ready_match(
  p_participant_id uuid,
  p_match_id uuid
)
returns table (
  match_status text,
  participant_status text,
  agreed_bet_amount integer,
  started_at timestamptz
)
language plpgsql
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_event_id uuid;
  v_event public.events%rowtype;
  v_match public.matches%rowtype;
  v_match_locked public.matches%rowtype;
  v_table public.tables%rowtype;
  v_actor public.participants%rowtype;
  v_player1 public.participants%rowtype;
  v_player2 public.participants%rowtype;
  v_locked_participant public.participants%rowtype;
  v_actor_ready_at timestamptz;
  v_other_ready_at timestamptz;
  v_actual_bet integer;
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
  into v_match
  from public.matches
  where id = p_match_id;

  if not found then
    raise exception 'Match not found: %', p_match_id;
  end if;

  if v_match.event_id <> v_event.id then
    raise exception 'Match % does not belong to participant event %', p_match_id, v_event.id;
  end if;

  for v_locked_participant in
    select *
    from public.participants
    where id in (v_match.player1_participant_id, coalesce(v_match.player2_participant_id, p_participant_id))
    order by id
    for update
  loop
    if v_locked_participant.id = p_participant_id then
      v_actor := v_locked_participant;
    end if;

    if v_locked_participant.id = v_match.player1_participant_id then
      v_player1 := v_locked_participant;
    end if;

    if v_match.player2_participant_id is not null and v_locked_participant.id = v_match.player2_participant_id then
      v_player2 := v_locked_participant;
    end if;
  end loop;

  if v_actor.id is null then
    raise exception 'Participant not found while locking: %', p_participant_id;
  end if;

  select *
  into v_match_locked
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match not found while locking: %', p_match_id;
  end if;

  if p_participant_id not in (v_match_locked.player1_participant_id, coalesce(v_match_locked.player2_participant_id, p_participant_id)) then
    raise exception 'Participant % is not part of match %', p_participant_id, p_match_id;
  end if;

  select *
  into v_table
  from public.tables
  where id = v_match_locked.table_id
  for update;

  if not found then
    raise exception 'Table not found for match: %', v_match_locked.table_id;
  end if;

  if v_match_locked.is_staff_match then
    if v_actor.id <> v_match_locked.player1_participant_id then
      raise exception 'Only the participant can ready a staff match: %', p_participant_id;
    end if;
  end if;

  if v_match_locked.player1_participant_id = p_participant_id then
    v_actor_ready_at := v_match_locked.player1_ready_at;
    v_other_ready_at := v_match_locked.player2_ready_at;
  else
    v_actor_ready_at := v_match_locked.player2_ready_at;
    v_other_ready_at := v_match_locked.player1_ready_at;
  end if;

  if v_actor_ready_at is not null and v_match_locked.status in ('awaiting_ready', 'in_progress', 'winner_claimed', 'completed', 'force_finished_by_admin') then
    match_status := v_match_locked.status;
    participant_status := v_actor.status;
    agreed_bet_amount := v_match_locked.agreed_bet_amount;
    started_at := v_match_locked.started_at;
    return next;
    return;
  end if;

  if v_match_locked.status in ('in_progress', 'winner_claimed', 'completed', 'force_finished_by_admin') then
    match_status := v_match_locked.status;
    participant_status := v_actor.status;
    agreed_bet_amount := v_match_locked.agreed_bet_amount;
    started_at := v_match_locked.started_at;
    return next;
    return;
  end if;

  if v_match_locked.status not in ('reserved', 'awaiting_ready') then
    raise exception 'Match is not readyable: %', v_match_locked.status;
  end if;

  if v_actor.status not in ('match_reserved', 'ready', 'playing') then
    raise exception 'Participant is not in a readyable status: %', v_actor.status;
  end if;

  if v_match_locked.is_staff_match then
    if v_match_locked.status <> 'reserved' then
      raise exception 'Staff match is not in reserved status: %', v_match_locked.status;
    end if;

    update public.matches
    set
      player1_ready_at = coalesce(player1_ready_at, v_now),
      status = 'in_progress',
      agreed_bet_amount = least(v_player1.chip_balance, v_event.fixed_bet_amount),
      started_at = v_now
    where id = v_match_locked.id
    returning *
    into v_match_locked;

    if v_match_locked.agreed_bet_amount is null or v_match_locked.agreed_bet_amount <= 0 then
      raise exception 'Staff match bet must be positive for match: %', p_match_id;
    end if;

    update public.participants
    set
      chip_balance = chip_balance - v_match_locked.agreed_bet_amount,
      status = 'playing',
      last_non_disconnect_status = 'playing'
    where id = v_player1.id
    returning *
    into v_player1;

    insert into public.chip_ledger (
      event_id,
      participant_id,
      match_id,
      delta,
      reason,
      balance_after
    )
    values (
      v_event.id,
      v_player1.id,
      v_match_locked.id,
      -v_match_locked.agreed_bet_amount,
      'match_bet',
      v_player1.chip_balance
    );

    update public.tables
    set
      status = 'in_use',
      current_match_id = v_match_locked.id
    where id = v_table.id
    returning *
    into v_table;

    match_status := v_match_locked.status;
    participant_status := v_player1.status;
    agreed_bet_amount := v_match_locked.agreed_bet_amount;
    started_at := v_match_locked.started_at;
    return next;
    return;
  end if;

  if v_match_locked.player1_participant_id = p_participant_id then
    update public.matches
    set player1_ready_at = coalesce(player1_ready_at, v_now)
    where id = v_match_locked.id
    returning *
    into v_match_locked;
  else
    update public.matches
    set player2_ready_at = coalesce(player2_ready_at, v_now)
    where id = v_match_locked.id
    returning *
    into v_match_locked;
  end if;

  if v_match_locked.player1_participant_id = p_participant_id then
    v_actor_ready_at := v_match_locked.player1_ready_at;
    v_other_ready_at := v_match_locked.player2_ready_at;

    update public.participants
    set
      status = case
        when v_match_locked.player2_ready_at is not null then 'playing'
        else 'ready'
      end,
      last_non_disconnect_status = case
        when v_match_locked.player2_ready_at is not null then 'playing'
        else 'ready'
      end
    where id = v_player1.id
    returning *
    into v_player1;
  else
    v_actor_ready_at := v_match_locked.player2_ready_at;
    v_other_ready_at := v_match_locked.player1_ready_at;

    update public.participants
    set
      status = case
        when v_match_locked.player1_ready_at is not null then 'playing'
        else 'ready'
      end,
      last_non_disconnect_status = case
        when v_match_locked.player1_ready_at is not null then 'playing'
        else 'ready'
      end
    where id = v_player2.id
    returning *
    into v_player2;
  end if;

  if v_other_ready_at is null then
    update public.matches
    set status = 'awaiting_ready'
    where id = v_match_locked.id
    returning *
    into v_match_locked;

    match_status := v_match_locked.status;
    participant_status := case
      when p_participant_id = v_player1.id then v_player1.status
      else v_player2.status
    end;
    agreed_bet_amount := v_match_locked.agreed_bet_amount;
    started_at := v_match_locked.started_at;
    return next;
    return;
  end if;

  v_actual_bet := least(v_player1.chip_balance, v_player2.chip_balance, v_event.fixed_bet_amount);

  if v_actual_bet is null or v_actual_bet <= 0 then
    raise exception 'Match bet must be positive for match: %', p_match_id;
  end if;

  update public.participants
  set
    chip_balance = chip_balance - v_actual_bet,
    status = 'playing',
    last_non_disconnect_status = 'playing'
  where id = v_player1.id
  returning *
  into v_player1;

  update public.participants
  set
    chip_balance = chip_balance - v_actual_bet,
    status = 'playing',
    last_non_disconnect_status = 'playing'
  where id = v_player2.id
  returning *
  into v_player2;

  insert into public.chip_ledger (
    event_id,
    participant_id,
    match_id,
    delta,
    reason,
    balance_after
  )
  values
    (
      v_event.id,
      v_player1.id,
      v_match_locked.id,
      -v_actual_bet,
      'match_bet',
      v_player1.chip_balance
    ),
    (
      v_event.id,
      v_player2.id,
      v_match_locked.id,
      -v_actual_bet,
      'match_bet',
      v_player2.chip_balance
    );

  update public.matches
  set
    status = 'in_progress',
    agreed_bet_amount = v_actual_bet,
    started_at = v_now
  where id = v_match_locked.id
  returning *
  into v_match_locked;

  update public.tables
  set
    status = 'in_use',
    current_match_id = v_match_locked.id
  where id = v_table.id
  returning *
  into v_table;

  match_status := v_match_locked.status;
  participant_status := case
    when p_participant_id = v_player1.id then v_player1.status
    else v_player2.status
  end;
  agreed_bet_amount := v_match_locked.agreed_bet_amount;
  started_at := v_match_locked.started_at;
  return next;
end;
$$;

create or replace function public.cancel_match_before_start(
  p_participant_id uuid,
  p_match_id uuid
)
returns table (
  match_status text
)
language plpgsql
set search_path = public
as $$
declare
  v_event_id uuid;
  v_event public.events%rowtype;
  v_match public.matches%rowtype;
  v_match_locked public.matches%rowtype;
  v_table public.tables%rowtype;
  v_actor public.participants%rowtype;
  v_locked_participant public.participants%rowtype;
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
  into v_match
  from public.matches
  where id = p_match_id;

  if not found then
    raise exception 'Match not found: %', p_match_id;
  end if;

  if v_match.event_id <> v_event.id then
    raise exception 'Match % does not belong to participant event %', p_match_id, v_event.id;
  end if;

  for v_locked_participant in
    select *
    from public.participants
    where id in (v_match.player1_participant_id, coalesce(v_match.player2_participant_id, p_participant_id))
    order by id
    for update
  loop
    if v_locked_participant.id = p_participant_id then
      v_actor := v_locked_participant;
    end if;
  end loop;

  if v_actor.id is null then
    raise exception 'Participant not found while locking: %', p_participant_id;
  end if;

  select *
  into v_match_locked
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match not found while locking: %', p_match_id;
  end if;

  if p_participant_id not in (v_match_locked.player1_participant_id, coalesce(v_match_locked.player2_participant_id, p_participant_id)) then
    raise exception 'Participant % is not part of match %', p_participant_id, p_match_id;
  end if;

  select *
  into v_table
  from public.tables
  where id = v_match_locked.table_id
  for update;

  if not found then
    raise exception 'Table not found for match: %', v_match_locked.table_id;
  end if;

  if v_match_locked.status = 'cancelled_before_start' then
    match_status := v_match_locked.status;
    return next;
    return;
  end if;

  if v_match_locked.status not in ('reserved', 'awaiting_ready') then
    raise exception 'Match can no longer be cancelled before start: %', v_match_locked.status;
  end if;

  update public.matches
  set
    status = 'cancelled_before_start',
    cancelled_by_participant_id = p_participant_id
  where id = v_match_locked.id
  returning *
  into v_match_locked;

  update public.participants
  set
    status = 'registered',
    last_non_disconnect_status = 'registered',
    current_match_id = null,
    queued_at = null
  where id in (v_match_locked.player1_participant_id, coalesce(v_match_locked.player2_participant_id, v_match_locked.player1_participant_id));

  update public.tables
  set
    status = 'available',
    current_match_id = null
  where id = v_table.id
  returning *
  into v_table;

  match_status := v_match_locked.status;
  return next;
end;
$$;

create or replace function public.claim_match_win(
  p_participant_id uuid,
  p_match_id uuid
)
returns table (
  match_status text
)
language plpgsql
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_event_id uuid;
  v_event public.events%rowtype;
  v_match public.matches%rowtype;
  v_match_locked public.matches%rowtype;
  v_actor public.participants%rowtype;
  v_opponent public.participants%rowtype;
  v_locked_participant public.participants%rowtype;
  v_table public.tables%rowtype;
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
  into v_match
  from public.matches
  where id = p_match_id;

  if not found then
    raise exception 'Match not found: %', p_match_id;
  end if;

  if v_match.event_id <> v_event.id then
    raise exception 'Match % does not belong to participant event %', p_match_id, v_event.id;
  end if;

  for v_locked_participant in
    select *
    from public.participants
    where id in (v_match.player1_participant_id, coalesce(v_match.player2_participant_id, p_participant_id))
    order by id
    for update
  loop
    if v_locked_participant.id = p_participant_id then
      v_actor := v_locked_participant;
    else
      v_opponent := v_locked_participant;
    end if;
  end loop;

  if v_actor.id is null then
    raise exception 'Participant not found while locking: %', p_participant_id;
  end if;

  select *
  into v_match_locked
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match not found while locking: %', p_match_id;
  end if;

  if p_participant_id not in (v_match_locked.player1_participant_id, coalesce(v_match_locked.player2_participant_id, p_participant_id)) then
    raise exception 'Participant % is not part of match %', p_participant_id, p_match_id;
  end if;

  select *
  into v_table
  from public.tables
  where id = v_match_locked.table_id
  for update;

  if not found then
    raise exception 'Table not found for match: %', v_match_locked.table_id;
  end if;

  if v_match_locked.is_staff_match then
    raise exception 'Staff matches cannot be claimed by participants: %', p_match_id;
  end if;

  if v_match_locked.status = 'winner_claimed' and v_match_locked.winner_claimed_by_participant_id = p_participant_id then
    match_status := v_match_locked.status;
    return next;
    return;
  end if;

  if v_match_locked.status = 'completed' and v_match_locked.winner_participant_id = p_participant_id then
    match_status := v_match_locked.status;
    return next;
    return;
  end if;

  if v_match_locked.status <> 'in_progress' then
    raise exception 'Match is not in progress: %', v_match_locked.status;
  end if;

  update public.matches
  set
    status = 'winner_claimed',
    winner_claimed_by_participant_id = p_participant_id,
    winner_claimed_at = v_now
  where id = v_match_locked.id
  returning *
  into v_match_locked;

  update public.participants
  set
    status = case
      when id = p_participant_id then 'claiming_win'
      else 'awaiting_result_approval'
    end,
    last_non_disconnect_status = case
      when id = p_participant_id then 'claiming_win'
      else 'awaiting_result_approval'
    end
  where id in (v_match_locked.player1_participant_id, v_match_locked.player2_participant_id);

  match_status := v_match_locked.status;
  return next;
end;
$$;

create or replace function public.approve_match_result(
  p_participant_id uuid,
  p_match_id uuid,
  p_approve boolean
)
returns table (
  match_status text,
  dispute_count integer
)
language plpgsql
set search_path = public
as $$
declare
  v_now timestamptz := timezone('utc', now());
  v_event_id uuid;
  v_event public.events%rowtype;
  v_match public.matches%rowtype;
  v_match_locked public.matches%rowtype;
  v_table public.tables%rowtype;
  v_actor public.participants%rowtype;
  v_player1 public.participants%rowtype;
  v_player2 public.participants%rowtype;
  v_locked_participant public.participants%rowtype;
  v_winner_id uuid;
  v_payout integer;
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
  into v_match
  from public.matches
  where id = p_match_id;

  if not found then
    raise exception 'Match not found: %', p_match_id;
  end if;

  if v_match.event_id <> v_event.id then
    raise exception 'Match % does not belong to participant event %', p_match_id, v_event.id;
  end if;

  for v_locked_participant in
    select *
    from public.participants
    where id in (v_match.player1_participant_id, coalesce(v_match.player2_participant_id, p_participant_id))
    order by id
    for update
  loop
    if v_locked_participant.id = p_participant_id then
      v_actor := v_locked_participant;
    end if;

    if v_locked_participant.id = v_match.player1_participant_id then
      v_player1 := v_locked_participant;
    end if;

    if v_match.player2_participant_id is not null and v_locked_participant.id = v_match.player2_participant_id then
      v_player2 := v_locked_participant;
    end if;
  end loop;

  if v_actor.id is null then
    raise exception 'Participant not found while locking: %', p_participant_id;
  end if;

  select *
  into v_match_locked
  from public.matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match not found while locking: %', p_match_id;
  end if;

  if p_participant_id not in (v_match_locked.player1_participant_id, coalesce(v_match_locked.player2_participant_id, p_participant_id)) then
    raise exception 'Participant % is not part of match %', p_participant_id, p_match_id;
  end if;

  select *
  into v_table
  from public.tables
  where id = v_match_locked.table_id
  for update;

  if not found then
    raise exception 'Table not found for match: %', v_match_locked.table_id;
  end if;

  if v_match_locked.is_staff_match then
    raise exception 'Staff matches are not approved by participants: %', p_match_id;
  end if;

  if v_match_locked.status <> 'winner_claimed' then
    match_status := v_match_locked.status;
    dispute_count := v_match_locked.dispute_count;
    return next;
    return;
  end if;

  if v_match_locked.winner_claimed_by_participant_id is null then
    raise exception 'Winner-claimed match is missing claimant: %', p_match_id;
  end if;

  if v_match_locked.winner_claimed_by_participant_id = p_participant_id then
    raise exception 'Claiming participant cannot approve their own result: %', p_participant_id;
  end if;

  if p_approve then
    v_winner_id := v_match_locked.winner_claimed_by_participant_id;
    v_payout := v_match_locked.agreed_bet_amount * 2;

    update public.matches
    set
      status = 'completed',
      winner_participant_id = v_winner_id,
      completed_at = v_now
    where id = v_match_locked.id
    returning *
    into v_match_locked;

    if v_player1.id = v_winner_id then
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
      balance_after
    )
    values (
      v_event.id,
      v_winner_id,
      v_match_locked.id,
      v_payout,
      'match_payout',
      case
        when v_player1.id = v_winner_id then v_player1.chip_balance
        else v_player2.chip_balance
      end
    );

    update public.tables
    set
      status = 'available',
      current_match_id = null
    where id = v_table.id
    returning *
    into v_table;

    update public.participants
    set
      status = 'result_confirmed',
      last_non_disconnect_status = 'result_confirmed',
      last_opponent_participant_id = case
        when v_match_locked.is_staff_match then last_opponent_participant_id
        when id = v_player1.id then v_player2.id
        else v_player1.id
      end
    where id in (v_player1.id, v_player2.id);
  else
    update public.matches
    set
      status = 'in_progress',
      winner_claimed_by_participant_id = null,
      winner_claimed_at = null,
      dispute_count = dispute_count + 1,
      last_disputed_at = v_now
    where id = v_match_locked.id
    returning *
    into v_match_locked;

    update public.participants
    set
      status = 'playing',
      last_non_disconnect_status = 'playing'
    where id in (v_player1.id, v_player2.id);
  end if;

  match_status := v_match_locked.status;
  dispute_count := v_match_locked.dispute_count;
  return next;
end;
$$;
