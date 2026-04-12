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
    from public.participants as p
    where p.event_id = v_event.id
      and p.nickname = p_nickname
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

  update public.participant_sessions as ps
  set
    is_active = false,
    invalidated_at = v_now
  where ps.participant_id = v_participant.id
    and ps.is_active = true;

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
