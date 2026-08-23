-- TASK-016: viewing concurrency and application-state integration.

create unique index viewings_one_open_per_application_idx
on public.viewings (application_id)
where status in ('PROPOSED', 'CONFIRMED');

create or replace function public.propose_viewing_transaction(
  p_application_id uuid,
  p_actor_user_id uuid,
  p_expected_application_status text,
  p_start_time timestamptz,
  p_end_time timestamptz,
  p_notes text
)
returns table (
  outcome text,
  viewing_id uuid,
  viewing_status text,
  application_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.applications%rowtype;
  v_viewing_id uuid;
begin
  select applications.* into v_application
  from public.applications
  where applications.id = p_application_id
  for update;

  if not found or not exists (
    select 1
    from public.listings
    join public.properties on properties.id = listings.property_id
    join public.landlord_profiles
      on landlord_profiles.id = properties.landlord_id
    join public.profiles on profiles.id = landlord_profiles.user_id
    where listings.id = v_application.listing_id
      and landlord_profiles.user_id = p_actor_user_id
      and profiles.role = 'LANDLORD'
      and profiles.account_status = 'ACTIVE'
  ) then
    return query select 'NOT_FOUND'::text, null::uuid, null::text, null::text;
    return;
  end if;

  if v_application.status <> p_expected_application_status
     or v_application.status not in ('SHORTLISTED', 'VIEWING_INVITED') then
    return query select
      'INVALID_APPLICATION_TRANSITION'::text,
      null::uuid,
      null::text,
      v_application.status;
    return;
  end if;

  if p_start_time <= clock_timestamp()
     or (p_end_time is not null and p_end_time <= p_start_time) then
    return query select
      'INVALID_SCHEDULE'::text, null::uuid, null::text, v_application.status;
    return;
  end if;

  if exists (
    select 1 from public.viewings
    where viewings.application_id = p_application_id
      and viewings.status in ('PROPOSED', 'CONFIRMED')
  ) then
    return query select
      'OPEN_VIEWING_EXISTS'::text,
      null::uuid,
      null::text,
      v_application.status;
    return;
  end if;

  insert into public.viewings (
    application_id, proposed_by_user_id, start_time, end_time, notes
  ) values (
    p_application_id, p_actor_user_id, p_start_time, p_end_time, p_notes
  ) returning id into v_viewing_id;

  if v_application.status = 'SHORTLISTED' then
    update public.applications
    set status = 'VIEWING_INVITED'
    where applications.id = p_application_id;

    insert into public.application_status_history (
      application_id, from_status, to_status, changed_by_user_id
    ) values (
      p_application_id, 'SHORTLISTED', 'VIEWING_INVITED', p_actor_user_id
    );
  end if;

  return query select
    'CREATED'::text,
    v_viewing_id,
    'PROPOSED'::text,
    'VIEWING_INVITED'::text;
end;
$$;

create or replace function public.transition_viewing_transaction(
  p_viewing_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
  p_expected_viewing_status text,
  p_action text
)
returns table (
  outcome text,
  viewing_status text,
  application_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_viewing public.viewings%rowtype;
  v_application public.applications%rowtype;
  v_target_status text;
  v_authorized boolean := false;
  v_allowed boolean := false;
begin
  select viewings.* into v_viewing
  from public.viewings
  where viewings.id = p_viewing_id
  for update;

  if not found then
    return query select 'NOT_FOUND'::text, null::text, null::text;
    return;
  end if;

  select applications.* into v_application
  from public.applications
  where applications.id = v_viewing.application_id
  for update;

  if p_actor_role = 'TENANT' then
    select exists (
      select 1
      from public.tenant_profiles
      join public.profiles on profiles.id = tenant_profiles.user_id
      where tenant_profiles.id = v_application.tenant_id
        and tenant_profiles.user_id = p_actor_user_id
        and profiles.role = 'TENANT'
        and profiles.account_status = 'ACTIVE'
    ) into v_authorized;
  elsif p_actor_role = 'LANDLORD' then
    select exists (
      select 1
      from public.listings
      join public.properties on properties.id = listings.property_id
      join public.landlord_profiles
        on landlord_profiles.id = properties.landlord_id
      join public.profiles on profiles.id = landlord_profiles.user_id
      where listings.id = v_application.listing_id
        and landlord_profiles.user_id = p_actor_user_id
        and profiles.role = 'LANDLORD'
        and profiles.account_status = 'ACTIVE'
    ) into v_authorized;
  end if;

  if not v_authorized then
    return query select 'NOT_FOUND'::text, null::text, null::text;
    return;
  end if;

  v_target_status := case p_action
    when 'CONFIRM' then 'CONFIRMED'
    when 'DECLINE' then 'DECLINED'
    when 'CANCEL' then 'CANCELLED'
    when 'COMPLETE' then 'COMPLETED'
    when 'NO_SHOW' then 'NO_SHOW'
    else null
  end;

  if v_target_status is null then
    return query select
      'INVALID_TRANSITION'::text, v_viewing.status, v_application.status;
    return;
  end if;

  if v_viewing.status = v_target_status then
    if p_action = 'COMPLETE' and not exists (
      select 1 from public.application_status_history
      where application_status_history.application_id = v_application.id
        and application_status_history.from_status = 'VIEWING_INVITED'
        and application_status_history.to_status = 'VIEWING_COMPLETED'
    ) then
      return query select
        'INTEGRITY_ERROR'::text, v_viewing.status, v_application.status;
      return;
    end if;
    return query select
      'ALREADY_TARGET'::text, v_viewing.status, v_application.status;
    return;
  end if;

  if v_viewing.status <> p_expected_viewing_status then
    return query select
      'INVALID_TRANSITION'::text, v_viewing.status, v_application.status;
    return;
  end if;

  v_allowed := case
    when p_actor_role = 'TENANT' and p_action = 'CONFIRM'
      then v_viewing.status = 'PROPOSED'
    when p_actor_role = 'TENANT' and p_action = 'DECLINE'
      then v_viewing.status = 'PROPOSED'
    when p_action = 'CANCEL' and p_actor_role in ('TENANT', 'LANDLORD')
      then v_viewing.status in ('PROPOSED', 'CONFIRMED')
    when p_actor_role = 'LANDLORD' and p_action = 'COMPLETE'
      then v_viewing.status = 'CONFIRMED'
        and v_viewing.start_time <= clock_timestamp()
        and v_application.status = 'VIEWING_INVITED'
    when p_actor_role = 'LANDLORD' and p_action = 'NO_SHOW'
      then v_viewing.status = 'CONFIRMED'
        and v_viewing.start_time <= clock_timestamp()
    else false
  end;

  if not v_allowed then
    return query select
      case
        when p_action in ('COMPLETE', 'NO_SHOW')
          and v_viewing.status = 'CONFIRMED'
          and v_viewing.start_time > clock_timestamp()
          then 'TOO_EARLY'
        else 'INVALID_TRANSITION'
      end,
      v_viewing.status,
      v_application.status;
    return;
  end if;

  update public.viewings
  set status = v_target_status
  where viewings.id = p_viewing_id;

  if p_action = 'COMPLETE' then
    update public.applications
    set status = 'VIEWING_COMPLETED'
    where applications.id = v_application.id;

    insert into public.application_status_history (
      application_id, from_status, to_status, changed_by_user_id
    ) values (
      v_application.id,
      'VIEWING_INVITED',
      'VIEWING_COMPLETED',
      p_actor_user_id
    );
  end if;

  return query select
    'TRANSITIONED'::text,
    v_target_status,
    case when p_action = 'COMPLETE'
      then 'VIEWING_COMPLETED' else v_application.status end;
end;
$$;

revoke all on function public.propose_viewing_transaction(
  uuid, uuid, text, timestamptz, timestamptz, text
) from public, anon, authenticated;
revoke all on function public.transition_viewing_transaction(
  uuid, uuid, text, text, text
) from public, anon, authenticated;

grant execute on function public.propose_viewing_transaction(
  uuid, uuid, text, timestamptz, timestamptz, text
) to service_role;
grant execute on function public.transition_viewing_transaction(
  uuid, uuid, text, text, text
) to service_role;
