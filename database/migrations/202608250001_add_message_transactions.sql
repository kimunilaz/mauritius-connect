-- TASK-018: atomic message creation/activity and participant-owned read state.

create index messages_conversation_id_created_at_id_idx
  on public.messages (conversation_id, created_at, id);

create or replace function public.send_message_transaction(
  p_conversation_id uuid,
  p_sender_user_id uuid,
  p_content text
)
returns table (
  outcome text,
  message_id uuid,
  conversation_updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_message_id uuid;
  v_updated_at timestamptz;
begin
  if not exists (
    select 1
    from public.conversation_participants
    join public.profiles on profiles.id = conversation_participants.user_id
    where conversation_participants.conversation_id = p_conversation_id
      and conversation_participants.user_id = p_sender_user_id
      and profiles.account_status = 'ACTIVE'
  ) then
    return query select 'NOT_FOUND'::text, null::uuid, null::timestamptz;
    return;
  end if;

  insert into public.messages (conversation_id, sender_user_id, content)
  values (p_conversation_id, p_sender_user_id, p_content)
  returning id into v_message_id;

  update public.conversations
  set updated_at = clock_timestamp()
  where conversations.id = p_conversation_id
  returning conversations.updated_at into v_updated_at;

  if v_updated_at is null then
    raise exception 'MESSAGE_CONVERSATION_INTEGRITY_ERROR';
  end if;

  return query select 'CREATED'::text, v_message_id, v_updated_at;
end;
$$;

create or replace function public.mark_conversation_read_transaction(
  p_conversation_id uuid,
  p_user_id uuid
)
returns table (
  outcome text,
  last_read_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_last_read_at timestamptz;
begin
  if not exists (
    select 1
    from public.conversation_participants
    join public.profiles on profiles.id = conversation_participants.user_id
    where conversation_participants.conversation_id = p_conversation_id
      and conversation_participants.user_id = p_user_id
      and profiles.account_status = 'ACTIVE'
  ) then
    return query select 'NOT_FOUND'::text, null::timestamptz;
    return;
  end if;

  v_last_read_at := clock_timestamp();
  update public.conversation_participants
  set last_read_at = v_last_read_at
  where conversation_participants.conversation_id = p_conversation_id
    and conversation_participants.user_id = p_user_id;

  return query select 'UPDATED'::text, v_last_read_at;
end;
$$;

revoke all on function public.send_message_transaction(uuid, uuid, text)
from public, anon, authenticated;
revoke all on function public.mark_conversation_read_transaction(uuid, uuid)
from public, anon, authenticated;

grant execute on function public.send_message_transaction(uuid, uuid, text)
to service_role;
grant execute on function public.mark_conversation_read_transaction(uuid, uuid)
to service_role;
