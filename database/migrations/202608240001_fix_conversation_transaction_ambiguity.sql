-- TASK-017: qualify the participant conflict target so PL/pgSQL output names
-- cannot be confused with table columns on hosted PostgreSQL.

create or replace function public.create_conversation_transaction(
  p_listing_id uuid,
  p_tenant_user_id uuid
)
returns table (
  outcome text,
  conversation_id uuid,
  created_now boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_landlord_user_id uuid;
  v_conversation_id uuid;
  v_created_now boolean := false;
begin
  if not exists (
    select 1
    from public.profiles
    where profiles.id = p_tenant_user_id
      and profiles.role = 'TENANT'
      and profiles.account_status = 'ACTIVE'
  ) then
    return query select 'NOT_FOUND'::text, null::uuid, false;
    return;
  end if;

  select landlord_profiles.user_id into v_landlord_user_id
  from public.listings
  join public.properties on properties.id = listings.property_id
  join public.landlord_profiles on landlord_profiles.id = properties.landlord_id
  where listings.id = p_listing_id
    and listings.status = 'ACTIVE'
    and properties.archived_at is null;

  if v_landlord_user_id is null then
    return query select 'LISTING_NOT_FOUND'::text, null::uuid, false;
    return;
  end if;

  insert into public.conversations (listing_id, tenant_user_id, landlord_user_id)
  values (p_listing_id, p_tenant_user_id, v_landlord_user_id)
  on conflict (listing_id, tenant_user_id, landlord_user_id) do nothing
  returning id into v_conversation_id;

  if v_conversation_id is not null then
    v_created_now := true;
  else
    select conversations.id into v_conversation_id
    from public.conversations
    where conversations.listing_id = p_listing_id
      and conversations.tenant_user_id = p_tenant_user_id
      and conversations.landlord_user_id = v_landlord_user_id;
  end if;

  if v_conversation_id is null then
    raise exception 'CONVERSATION_CREATION_INTEGRITY_ERROR';
  end if;

  delete from public.conversation_participants
  where conversation_participants.conversation_id = v_conversation_id
    and conversation_participants.user_id not in (p_tenant_user_id, v_landlord_user_id);

  insert into public.conversation_participants (conversation_id, user_id)
  values (v_conversation_id, p_tenant_user_id), (v_conversation_id, v_landlord_user_id)
  on conflict on constraint conversation_participants_pkey do nothing;

  if (select count(*) from public.conversation_participants
      where conversation_participants.conversation_id = v_conversation_id) <> 2 then
    raise exception 'CONVERSATION_MEMBERSHIP_INTEGRITY_ERROR';
  end if;

  return query select 'READY'::text, v_conversation_id, v_created_now;
end;
$$;

revoke all on function public.create_conversation_transaction(uuid, uuid)
from public, anon, authenticated;

grant execute on function public.create_conversation_transaction(uuid, uuid)
to service_role;
