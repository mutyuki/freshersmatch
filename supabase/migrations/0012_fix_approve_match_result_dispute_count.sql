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
    update public.matches as m
    set
      status = 'in_progress',
      winner_claimed_by_participant_id = null,
      winner_claimed_at = null,
      dispute_count = m.dispute_count + 1,
      last_disputed_at = v_now
    where m.id = v_match_locked.id
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
