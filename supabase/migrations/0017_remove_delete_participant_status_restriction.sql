create or replace function public.delete_participant_by_admin(
  p_admin_user_id uuid,
  p_participant_id uuid
)
returns table (
  participant_id uuid
)
language plpgsql
set search_path = public
as $$
declare
  v_event_id uuid;
  v_event public.events%rowtype;
  v_admin_id uuid;
  v_participant public.participants%rowtype;
  v_has_active_match_reference boolean := false;
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

  if v_participant.current_match_id is not null then
    raise exception 'Participant cannot be deleted while current_match_id is set: %', p_participant_id;
  end if;

  select exists (
    select 1
    from public.matches
    where (player1_participant_id = p_participant_id or player2_participant_id = p_participant_id)
      and status in ('reserved', 'awaiting_ready', 'in_progress', 'winner_claimed')
  )
  into v_has_active_match_reference;

  if v_has_active_match_reference then
    raise exception 'Participant cannot be deleted because active match references exist: %', p_participant_id;
  end if;

  delete from public.matches
  where player1_participant_id = p_participant_id
     or player2_participant_id = p_participant_id;

  delete from public.participants
  where id = p_participant_id
  returning id
  into participant_id;

  if participant_id is null then
    raise exception 'Participant not found while deleting: %', p_participant_id;
  end if;

  return next;
end;
$$;
