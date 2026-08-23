-- TASK-015: atomic, actor-scoped application workflow transitions.

create or replace function public.transition_application_status_transaction(
  p_application_id uuid,
  p_actor_user_id uuid,
  p_actor_role text,
  p_expected_status text,
  p_target_status text
)
returns table (
  outcome text,
  previous_status text,
  current_status text,
  transitioned_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.applications%rowtype;
  v_transitioned_at timestamptz;
  v_actor_authorized boolean := false;
  v_transition_allowed boolean := false;
  v_history_exists boolean := false;
begin
  select applications.*
    into v_application
  from public.applications
  where applications.id = p_application_id
  for update;

  if not found then
    return query select
      'NOT_FOUND'::text, null::text, null::text, null::timestamptz;
    return;
  end if;

  if p_actor_role = 'LANDLORD' then
    -- DRAFT existence must not be disclosed to a landlord action.
    if v_application.status = 'DRAFT' then
      return query select
        'NOT_FOUND'::text, null::text, null::text, null::timestamptz;
      return;
    end if;

    select exists (
      select 1
      from public.listings
      join public.properties
        on properties.id = listings.property_id
      join public.landlord_profiles
        on landlord_profiles.id = properties.landlord_id
      join public.profiles
        on profiles.id = landlord_profiles.user_id
      where listings.id = v_application.listing_id
        and landlord_profiles.user_id = p_actor_user_id
        and profiles.role = 'LANDLORD'
        and profiles.account_status = 'ACTIVE'
    ) into v_actor_authorized;
  elsif p_actor_role = 'TENANT' then
    select exists (
      select 1
      from public.tenant_profiles
      join public.profiles
        on profiles.id = tenant_profiles.user_id
      where tenant_profiles.id = v_application.tenant_id
        and tenant_profiles.user_id = p_actor_user_id
        and profiles.role = 'TENANT'
        and profiles.account_status = 'ACTIVE'
    ) into v_actor_authorized;
  end if;

  if not v_actor_authorized then
    return query select
      'NOT_FOUND'::text, null::text, null::text, null::timestamptz;
    return;
  end if;

  if v_application.status = p_target_status then
    select exists (
      select 1
      from public.application_status_history
      where application_status_history.application_id = p_application_id
        and application_status_history.to_status = p_target_status
    ) into v_history_exists;

    if not v_history_exists then
      return query select
        'INTEGRITY_ERROR'::text,
        v_application.status,
        v_application.status,
        null::timestamptz;
      return;
    end if;

    return query select
      'ALREADY_TARGET'::text,
      v_application.status,
      v_application.status,
      null::timestamptz;
    return;
  end if;

  if v_application.status <> p_expected_status then
    return query select
      'INVALID_TRANSITION'::text,
      v_application.status,
      v_application.status,
      null::timestamptz;
    return;
  end if;

  v_transition_allowed := case
    when p_actor_role = 'LANDLORD'
      and p_target_status = 'UNDER_REVIEW'
      then v_application.status = 'SUBMITTED'
    when p_actor_role = 'LANDLORD'
      and p_target_status = 'SHORTLISTED'
      then v_application.status = 'UNDER_REVIEW'
    when p_actor_role = 'LANDLORD'
      and p_target_status = 'REJECTED'
      then v_application.status in ('SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED')
    when p_actor_role = 'TENANT'
      and p_target_status = 'WITHDRAWN'
      then v_application.status in ('SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED')
    else false
  end;

  if not v_transition_allowed then
    return query select
      'INVALID_TRANSITION'::text,
      v_application.status,
      v_application.status,
      null::timestamptz;
    return;
  end if;

  v_transitioned_at := clock_timestamp();

  update public.applications
  set
    status = p_target_status,
    withdrawn_at = case
      when p_target_status = 'WITHDRAWN' then v_transitioned_at
      else applications.withdrawn_at
    end
  where applications.id = p_application_id;

  insert into public.application_status_history (
    application_id,
    from_status,
    to_status,
    changed_by_user_id,
    created_at
  ) values (
    p_application_id,
    v_application.status,
    p_target_status,
    p_actor_user_id,
    v_transitioned_at
  );

  return query select
    'TRANSITIONED'::text,
    v_application.status,
    p_target_status,
    v_transitioned_at;
end;
$$;

revoke all on function public.transition_application_status_transaction(
  uuid, uuid, text, text, text
) from public, anon, authenticated;

grant execute on function public.transition_application_status_transaction(
  uuid, uuid, text, text, text
) to service_role;
