-- TASK-020: report targets, active duplicate protection, and atomic triage.

alter table public.reports
  add column if not exists target_type text,
  add column if not exists target_id uuid,
  add column if not exists message_id uuid,
  add column if not exists moderator_user_id uuid,
  add column if not exists updated_at timestamptz not null default now();

alter table public.reports
  drop constraint if exists reports_reason_check,
  drop constraint if exists reports_target_check;

alter table public.reports
  add constraint reports_target_type_check
    check (target_type is null or target_type in ('LISTING', 'MESSAGE')),
  add constraint reports_target_id_check
    check (target_type is null or target_id is not null),
  add constraint reports_reason_check
    check (reason in (
      'FRAUD_OR_SCAM', 'MISLEADING_INFORMATION', 'INAPPROPRIATE_CONTENT',
      'DUPLICATE', 'HARASSMENT', 'SPAM', 'OTHER',
      'FAKE_LISTING', 'INCORRECT_INFORMATION', 'PROPERTY_UNAVAILABLE',
      'SUSPICIOUS_LANDLORD', 'SUSPICIOUS_TENANT'
    )),
  add constraint reports_target_check
    check (reported_user_id is not null or listing_id is not null or message_id is not null),
  add constraint reports_message_fk
    foreign key (message_id) references public.messages (id) on delete restrict,
  add constraint reports_moderator_user_fk
    foreign key (moderator_user_id) references public.profiles (id) on delete restrict;

create index reports_status_created_at_id_idx
  on public.reports (status, created_at desc, id desc);
create index reports_target_type_created_at_id_idx
  on public.reports (target_type, created_at desc, id desc);
create unique index reports_one_active_per_reporter_target_idx
  on public.reports (reporter_user_id, target_type, target_id)
  where status in ('OPEN', 'UNDER_REVIEW');
create unique index admin_audit_logs_report_action_idx
  on public.admin_audit_logs (target_id, action)
  where target_type = 'REPORT' and action in (
    'REPORT_REVIEWED', 'REPORT_RESOLVED', 'REPORT_DISMISSED'
  );

create trigger reports_set_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

create or replace function public.create_report_transaction(
  p_reporter_user_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_details text
)
returns table (outcome text, report_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reporter public.profiles%rowtype;
  v_existing uuid;
  v_listing_id uuid;
  v_message_id uuid;
  v_conversation_id uuid;
begin
  select profiles.* into v_reporter
  from public.profiles
  where profiles.id = p_reporter_user_id
  for share;
  if not found or v_reporter.account_status <> 'ACTIVE'
     or v_reporter.role not in ('TENANT', 'LANDLORD') then
    return query select 'NOT_FOUND'::text, null::uuid;
    return;
  end if;

  if p_target_type = 'LISTING' then
    if p_reason not in (
      'FRAUD_OR_SCAM', 'MISLEADING_INFORMATION', 'INAPPROPRIATE_CONTENT',
      'DUPLICATE', 'OTHER'
    ) then
      return query select 'INVALID_REASON'::text, null::uuid;
      return;
    end if;
    select listings.id into v_listing_id
    from public.listings
    join public.properties on properties.id = listings.property_id
    join public.landlord_profiles on landlord_profiles.id = properties.landlord_id
    where listings.id = p_target_id
      and properties.archived_at is null
      and (
        listings.status = 'ACTIVE'
        or (v_reporter.role = 'LANDLORD' and landlord_profiles.user_id = p_reporter_user_id)
      );
    if v_listing_id is null then
      return query select 'NOT_FOUND'::text, null::uuid;
      return;
    end if;
  elsif p_target_type = 'MESSAGE' then
    if p_reason not in ('HARASSMENT', 'SPAM', 'FRAUD_OR_SCAM', 'INAPPROPRIATE_CONTENT', 'OTHER') then
      return query select 'INVALID_REASON'::text, null::uuid;
      return;
    end if;
    select messages.id, messages.conversation_id
      into v_message_id, v_conversation_id
    from public.messages
    where messages.id = p_target_id
      and exists (
        select 1 from public.conversation_participants
        where conversation_participants.conversation_id = messages.conversation_id
          and conversation_participants.user_id = p_reporter_user_id
      );
    if v_message_id is null then
      return query select 'NOT_FOUND'::text, null::uuid;
      return;
    end if;
  else
    return query select 'INVALID_TARGET'::text, null::uuid;
    return;
  end if;

  select reports.id into v_existing
  from public.reports
  where reports.reporter_user_id = p_reporter_user_id
    and reports.target_type = p_target_type
    and reports.target_id = p_target_id
    and reports.status in ('OPEN', 'UNDER_REVIEW')
  order by reports.created_at desc, reports.id desc
  limit 1
  for update;
  if v_existing is not null then
    return query select 'EXISTING'::text, v_existing;
    return;
  end if;

  begin
    insert into public.reports (
      reporter_user_id, target_type, target_id, listing_id, message_id,
      reason, description, status
    ) values (
      p_reporter_user_id, p_target_type, p_target_id,
      case when p_target_type = 'LISTING' then p_target_id else null end,
      case when p_target_type = 'MESSAGE' then p_target_id else null end,
      p_reason, nullif(trim(p_details), ''), 'OPEN'
    ) returning reports.id into v_existing;
  exception when unique_violation then
    select reports.id into v_existing
    from public.reports
    where reports.reporter_user_id = p_reporter_user_id
      and reports.target_type = p_target_type
      and reports.target_id = p_target_id
      and reports.status in ('OPEN', 'UNDER_REVIEW')
    order by reports.created_at desc, reports.id desc
    limit 1;
    if v_existing is null then raise; end if;
    return query select 'EXISTING'::text, v_existing;
    return;
  end;

  return query select 'CREATED'::text, v_existing;
end;
$$;

create or replace function public.moderate_report_transaction(
  p_report_id uuid,
  p_admin_user_id uuid,
  p_target_status text,
  p_reason text
)
returns table (outcome text, report_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_report public.reports%rowtype;
  v_now timestamptz;
  v_action text;
begin
  if not exists (
    select 1 from public.profiles
    where profiles.id = p_admin_user_id
      and profiles.role = 'ADMIN'
      and profiles.account_status = 'ACTIVE'
  ) then
    return query select 'NOT_FOUND'::text, null::text;
    return;
  end if;

  select reports.* into v_report
  from public.reports
  where reports.id = p_report_id
  for update;
  if not found then
    return query select 'NOT_FOUND'::text, null::text;
    return;
  end if;

  if p_target_status not in ('UNDER_REVIEW', 'RESOLVED', 'DISMISSED') then
    return query select 'INVALID_TRANSITION'::text, v_report.status;
    return;
  end if;
  if v_report.status = p_target_status then
    return query select 'ALREADY_TARGET'::text, v_report.status;
    return;
  end if;
  if v_report.status not in ('OPEN', 'UNDER_REVIEW')
     or (p_target_status = 'UNDER_REVIEW' and v_report.status <> 'OPEN') then
    return query select 'INVALID_TRANSITION'::text, v_report.status;
    return;
  end if;

  v_now := clock_timestamp();
  v_action := case p_target_status
    when 'UNDER_REVIEW' then 'REPORT_REVIEWED'
    when 'RESOLVED' then 'REPORT_RESOLVED'
    else 'REPORT_DISMISSED'
  end;

  update public.reports
  set status = p_target_status,
      moderator_user_id = p_admin_user_id,
      resolved_by_user_id = case
        when p_target_status in ('RESOLVED', 'DISMISSED') then p_admin_user_id
        else resolved_by_user_id
      end,
      resolved_at = case
        when p_target_status in ('RESOLVED', 'DISMISSED') then v_now
        else resolved_at
      end,
      description = case
        when nullif(trim(p_reason), '') is not null
          then coalesce(description, '') || case when description is null or description = '' then '' else E'\n' end || '[moderator] ' || trim(p_reason)
        else description
      end
  where reports.id = p_report_id;

  insert into public.admin_audit_logs (
    admin_user_id, action, target_type, target_id, reason, metadata
  ) values (
    p_admin_user_id, v_action, 'REPORT', p_report_id, nullif(trim(p_reason), ''),
    jsonb_build_object('from_status', v_report.status, 'to_status', p_target_status)
  );

  return query select 'TRANSITIONED'::text, p_target_status;
end;
$$;

revoke all on function public.create_report_transaction(uuid, text, uuid, text, text)
  from public, anon, authenticated;
revoke all on function public.moderate_report_transaction(uuid, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.create_report_transaction(uuid, text, uuid, text, text)
  to service_role;
grant execute on function public.moderate_report_transaction(uuid, uuid, text, text)
  to service_role;
