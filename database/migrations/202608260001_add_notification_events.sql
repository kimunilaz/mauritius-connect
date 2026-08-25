-- TASK-019: backend-derived, idempotent in-app notification events.

alter table public.notifications
  add column if not exists source_event_key text;

create unique index notifications_source_event_key_idx
  on public.notifications (source_event_key)
  where source_event_key is not null;

create index notifications_user_id_created_at_id_idx
  on public.notifications (user_id, created_at desc, id desc);

create or replace function public.emit_application_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient uuid;
  v_type text;
  v_title text;
  v_message text;
begin
  if new.to_status = 'SUBMITTED' then
    select landlord_profiles.user_id into v_recipient
    from public.applications
    join public.listings on listings.id = applications.listing_id
    join public.properties on properties.id = listings.property_id
    join public.landlord_profiles on landlord_profiles.id = properties.landlord_id
    where applications.id = new.application_id;
    v_type := 'APPLICATION_SUBMITTED';
    v_title := 'New rental application';
    v_message := 'A tenant submitted a rental application.';
  elsif new.to_status = 'UNDER_REVIEW' then
    select tenant_profiles.user_id into v_recipient
    from public.applications
    join public.tenant_profiles on tenant_profiles.id = applications.tenant_id
    where applications.id = new.application_id;
    v_type := 'APPLICATION_UNDER_REVIEW';
    v_title := 'Your application is under review';
    v_message := 'Your rental application is now under review.';
  elsif new.to_status = 'SHORTLISTED' then
    select tenant_profiles.user_id into v_recipient
    from public.applications
    join public.tenant_profiles on tenant_profiles.id = applications.tenant_id
    where applications.id = new.application_id;
    v_type := 'APPLICATION_SHORTLISTED';
    v_title := 'Your application was shortlisted';
    v_message := 'Your rental application was shortlisted.';
  elsif new.to_status = 'REJECTED' then
    select tenant_profiles.user_id into v_recipient
    from public.applications
    join public.tenant_profiles on tenant_profiles.id = applications.tenant_id
    where applications.id = new.application_id;
    v_type := 'APPLICATION_REJECTED';
    v_title := 'Your application was not selected';
    v_message := 'Your rental application was not selected.';
  elsif new.to_status = 'WITHDRAWN' then
    select landlord_profiles.user_id into v_recipient
    from public.applications
    join public.listings on listings.id = applications.listing_id
    join public.properties on properties.id = listings.property_id
    join public.landlord_profiles on landlord_profiles.id = properties.landlord_id
    where applications.id = new.application_id;
    v_type := 'APPLICATION_WITHDRAWN';
    v_title := 'Application withdrawn';
    v_message := 'A tenant withdrew a rental application.';
  else
    return new;
  end if;

  if v_recipient is not null then
    begin
      insert into public.notifications (
      user_id, type, title, message, entity_type, entity_id, source_event_key
    ) values (
      v_recipient, v_type, v_title, v_message,
      'APPLICATION', new.application_id,
      'application_status_history:' || new.id::text
      );
    exception when unique_violation then
      null;
    end;
  end if;
  return new;
end;
$$;

create or replace function public.emit_viewing_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_landlord uuid;
  v_recipient uuid;
  v_type text;
  v_title text;
  v_message text;
begin
  select tenant_profiles.user_id, landlord_profiles.user_id
    into v_tenant, v_landlord
  from public.applications
  join public.tenant_profiles on tenant_profiles.id = applications.tenant_id
  join public.listings on listings.id = applications.listing_id
  join public.properties on properties.id = listings.property_id
  join public.landlord_profiles on landlord_profiles.id = properties.landlord_id
  where applications.id = new.application_id;

  if tg_op = 'INSERT' and new.status = 'PROPOSED' then
    v_recipient := v_tenant;
    v_type := 'VIEWING_PROPOSED';
    v_title := 'New viewing proposed';
    v_message := 'A landlord proposed a viewing for your application.';
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status then
    if new.status = 'CONFIRMED' then
      v_recipient := v_landlord;
      v_type := 'VIEWING_CONFIRMED';
      v_title := 'Viewing confirmed';
      v_message := 'A tenant confirmed the proposed viewing.';
    elsif new.status = 'DECLINED' then
      v_recipient := v_landlord;
      v_type := 'VIEWING_DECLINED';
      v_title := 'Viewing declined';
      v_message := 'A tenant declined the proposed viewing.';
    elsif new.status = 'NO_SHOW' then
      v_recipient := v_tenant;
      v_type := 'VIEWING_NO_SHOW';
      v_title := 'Viewing marked as no-show';
      v_message := 'The viewing was marked as a no-show.';
    elsif new.status = 'COMPLETED' then
      v_recipient := v_tenant;
      v_type := 'VIEWING_COMPLETED';
      v_title := 'Viewing completed';
      v_message := 'The viewing was marked as completed.';
    else
      return new;
    end if;
  else
    return new;
  end if;

  if v_recipient is not null then
    begin
      insert into public.notifications (
      user_id, type, title, message, entity_type, entity_id, source_event_key
    ) values (
      v_recipient, v_type, v_title, v_message,
      'APPLICATION', new.application_id,
      'viewing:' || new.id::text || ':' || new.status
      );
    exception when unique_violation then
      null;
    end;
  end if;
  return new;
end;
$$;

create or replace function public.emit_message_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient uuid;
  v_first_name text;
begin
  select conversation_participants.user_id into v_recipient
  from public.conversation_participants
  where conversation_participants.conversation_id = new.conversation_id
    and conversation_participants.user_id <> new.sender_user_id
  order by conversation_participants.user_id
  limit 1;

  select profiles.first_name into v_first_name
  from public.profiles where profiles.id = new.sender_user_id;

  if v_recipient is not null then
    begin
      insert into public.notifications (
      user_id, type, title, message, entity_type, entity_id, source_event_key
    ) values (
      v_recipient,
      'MESSAGE_RECEIVED',
      'New message',
      'New message from ' || coalesce(nullif(v_first_name, ''), 'a participant'),
      'CONVERSATION', new.conversation_id,
      'message:' || new.id::text
      );
    exception when unique_violation then
      null;
    end;
  end if;
  return new;
end;
$$;

create or replace function public.create_viewing_cancel_notification(
  p_viewing_id uuid,
  p_actor_user_id uuid
)
returns table (outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tenant uuid;
  v_landlord uuid;
  v_application_id uuid;
  v_recipient uuid;
  v_key text;
begin
  select viewings.application_id into v_application_id
  from public.viewings where viewings.id = p_viewing_id
    and viewings.status = 'CANCELLED';
  if v_application_id is null then
    return query select 'NOT_FOUND'::text;
    return;
  end if;

  select tenant_profiles.user_id, landlord_profiles.user_id
    into v_tenant, v_landlord
  from public.applications
  join public.tenant_profiles on tenant_profiles.id = applications.tenant_id
  join public.listings on listings.id = applications.listing_id
  join public.properties on properties.id = listings.property_id
  join public.landlord_profiles on landlord_profiles.id = properties.landlord_id
  where applications.id = v_application_id;

  if p_actor_user_id = v_tenant then
    v_recipient := v_landlord;
  elsif p_actor_user_id = v_landlord then
    v_recipient := v_tenant;
  else
    return query select 'NOT_FOUND'::text;
    return;
  end if;

  v_key := 'viewing:' || p_viewing_id::text || ':CANCELLED:' || p_actor_user_id::text;
  begin
    insert into public.notifications (
    user_id, type, title, message, entity_type, entity_id, source_event_key
  ) values (
    v_recipient, 'VIEWING_CANCELLED', 'Viewing cancelled',
    'A viewing was cancelled.', 'APPLICATION', v_application_id, v_key
    );
  exception when unique_violation then
    null;
  end;
  return query select 'CREATED'::text;
end;
$$;

drop trigger if exists application_status_notification_trigger
  on public.application_status_history;
create trigger application_status_notification_trigger
after insert on public.application_status_history
for each row execute function public.emit_application_notification();

drop trigger if exists viewing_notification_trigger on public.viewings;
create trigger viewing_notification_trigger
after insert or update of status on public.viewings
for each row execute function public.emit_viewing_notification();

drop trigger if exists message_notification_trigger on public.messages;
create trigger message_notification_trigger
after insert on public.messages
for each row execute function public.emit_message_notification();

revoke all on function public.emit_application_notification() from public, anon, authenticated;
revoke all on function public.emit_viewing_notification() from public, anon, authenticated;
revoke all on function public.emit_message_notification() from public, anon, authenticated;
revoke all on function public.create_viewing_cancel_notification(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.create_viewing_cancel_notification(uuid, uuid)
  to service_role;
