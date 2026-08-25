-- TASK-025 regression: qualify profile columns that otherwise conflict with
-- the table-returning function's account_status output parameter.
create or replace function public.admin_account_state_transaction(
  p_admin uuid,
  p_user uuid,
  p_action text
)
returns table (outcome text, account_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_role text;
begin
  if not exists (
    select 1
    from public.profiles
    where profiles.id = p_admin
      and profiles.role = 'ADMIN'
      and profiles.account_status = 'ACTIVE'
  ) then
    return query select 'FORBIDDEN'::text, null::text;
    return;
  end if;

  select profiles.account_status, profiles.role
    into v_status, v_role
  from public.profiles
  where profiles.id = p_user
  for update;

  if v_status is null then
    return query select 'NOT_FOUND'::text, null::text;
    return;
  end if;
  if p_user = p_admin and p_action = 'SUSPEND' then
    return query select 'PROTECTED'::text, v_status;
    return;
  end if;
  if v_role = 'ADMIN' and p_action = 'SUSPEND' and (
    select count(*)
    from public.profiles
    where profiles.role = 'ADMIN'
      and profiles.account_status = 'ACTIVE'
  ) <= 1 then
    return query select 'PROTECTED'::text, v_status;
    return;
  end if;
  if p_action = 'SUSPEND' and v_status = 'SUSPENDED' then
    return query select 'ALREADY_TARGET'::text, v_status;
    return;
  end if;
  if p_action = 'REACTIVATE' and v_status = 'ACTIVE' then
    return query select 'ALREADY_TARGET'::text, v_status;
    return;
  end if;
  if p_action = 'SUSPEND' and v_status <> 'ACTIVE' then
    return query select 'INVALID_TRANSITION'::text, v_status;
    return;
  end if;
  if p_action = 'REACTIVATE' and v_status <> 'SUSPENDED' then
    return query select 'INVALID_TRANSITION'::text, v_status;
    return;
  end if;

  update public.profiles
  set account_status = case
    when p_action = 'SUSPEND' then 'SUSPENDED'
    else 'ACTIVE'
  end
  where profiles.id = p_user;

  if p_action = 'SUSPEND' and v_role = 'LANDLORD' then
    update public.listings
    set status = 'PAUSED'
    where listings.status = 'ACTIVE'
      and exists (
        select 1
        from public.properties
        join public.landlord_profiles
          on landlord_profiles.id = properties.landlord_id
        where properties.id = listings.property_id
          and landlord_profiles.user_id = p_user
      );
  end if;

  insert into public.admin_audit_logs (
    admin_user_id,
    action,
    target_type,
    target_id,
    metadata
  )
  values (
    p_admin,
    case
      when p_action = 'SUSPEND' then 'ACCOUNT_SUSPENDED'
      else 'ACCOUNT_REACTIVATED'
    end,
    'USER',
    p_user,
    jsonb_build_object(
      'from', v_status,
      'to', case
        when p_action = 'SUSPEND' then 'SUSPENDED'
        else 'ACTIVE'
      end
    )
  );

  return query
  select
    'TRANSITIONED'::text,
    case
      when p_action = 'SUSPEND' then 'SUSPENDED'
      else 'ACTIVE'
    end;
end;
$$;

revoke all on function public.admin_account_state_transaction(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.admin_account_state_transaction(uuid, uuid, text)
  to service_role;
