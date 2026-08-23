-- TASK-012 keeps application submission and landlord question mutations
-- consistent with one transaction-scoped lock per listing. The Node API remains
-- responsible for authentication, authorization, validation, and workflow
-- policy; these functions repeat critical checks at the commit boundary.

create unique index application_status_history_one_submission_idx
  on public.application_status_history (application_id)
  where from_status = 'DRAFT' and to_status = 'SUBMITTED';

create or replace function public.enforce_draft_application_answer_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application_id uuid;
  v_status text;
  v_submitted_at timestamptz;
begin
  v_application_id := case
    when tg_op = 'DELETE' then old.application_id
    else new.application_id
  end;

  if tg_op = 'UPDATE'
     and (new.application_id <> old.application_id
          or new.question_id <> old.question_id) then
    raise exception using
      errcode = 'P0001',
      message = 'APPLICATION_ANSWER_IDENTITY_IMMUTABLE';
  end if;

  select applications.status, applications.submitted_at
    into v_status, v_submitted_at
  from public.applications
  where applications.id = v_application_id
  for update;

  if found and (v_status <> 'DRAFT' or v_submitted_at is not null) then
    raise exception using
      errcode = 'P0001',
      message = 'APPLICATION_NOT_EDITABLE';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger application_answers_require_draft
before insert or update or delete on public.application_answers
for each row execute function public.enforce_draft_application_answer_mutation();

create or replace function public.mutate_application_question_transaction(
  p_operation text,
  p_listing_id uuid,
  p_question_id uuid,
  p_actor_user_id uuid,
  p_payload jsonb
)
returns table (
  outcome text,
  question_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_listing_status text;
  v_question public.application_questions%rowtype;
  v_question_id uuid;
  v_target_type text;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_listing_id::text, 0));

  select listings.status
    into v_listing_status
  from public.listings
  join public.properties
    on properties.id = listings.property_id
  join public.landlord_profiles
    on landlord_profiles.id = properties.landlord_id
  where listings.id = p_listing_id
    and landlord_profiles.user_id = p_actor_user_id
  for share of listings, properties;

  if not found then
    return query select 'NOT_FOUND'::text, null::uuid;
    return;
  end if;

  if exists (
    select 1
    from public.applications
    where applications.listing_id = p_listing_id
      and applications.submitted_at is not null
  ) then
    return query select 'LOCKED'::text, p_question_id;
    return;
  end if;

  if v_listing_status not in ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED') then
    return query select 'LISTING_NOT_EDITABLE'::text, p_question_id;
    return;
  end if;

  if p_operation = 'CREATE' then
    insert into public.application_questions (
      listing_id,
      question_text,
      question_type,
      is_required,
      display_order
    ) values (
      p_listing_id,
      p_payload ->> 'question_text',
      p_payload ->> 'question_type',
      (p_payload ->> 'is_required')::boolean,
      (p_payload ->> 'display_order')::integer
    )
    returning id into v_question_id;

    if p_payload ->> 'question_type' = 'SELECT' then
      insert into public.application_question_options (
        question_id,
        option_text,
        display_order
      )
      select
        v_question_id,
        option_record.option_text,
        option_record.display_order
      from jsonb_to_recordset(p_payload -> 'options')
        as option_record(option_text text, display_order integer);
    end if;

    return query select 'OK'::text, v_question_id;
    return;
  end if;

  select application_questions.*
    into v_question
  from public.application_questions
  where application_questions.id = p_question_id
    and application_questions.listing_id = p_listing_id
  for update;

  if not found then
    return query select 'QUESTION_NOT_FOUND'::text, p_question_id;
    return;
  end if;

  if p_operation = 'DELETE' then
    delete from public.application_answers
    using public.applications
    where application_answers.question_id = p_question_id
      and applications.id = application_answers.application_id
      and applications.status = 'DRAFT'
      and applications.submitted_at is null;

    delete from public.application_questions
    where application_questions.id = p_question_id
      and application_questions.listing_id = p_listing_id;

    return query select 'OK'::text, p_question_id;
    return;
  end if;

  if p_operation <> 'UPDATE' then
    return query select 'INVALID_OPERATION'::text, p_question_id;
    return;
  end if;

  v_target_type := case
    when p_payload ? 'question_type' then p_payload ->> 'question_type'
    else v_question.question_type
  end;

  if v_target_type <> v_question.question_type then
    delete from public.application_answers
    using public.applications
    where application_answers.question_id = p_question_id
      and applications.id = application_answers.application_id
      and applications.status = 'DRAFT'
      and applications.submitted_at is null;
  elsif p_payload ? 'options' then
    delete from public.application_answers
    using public.applications
    where application_answers.question_id = p_question_id
      and applications.id = application_answers.application_id
      and applications.status = 'DRAFT'
      and applications.submitted_at is null
      and not exists (
        select 1
        from jsonb_array_elements(p_payload -> 'options') as option_value
        where option_value ->> 'option_text' = application_answers.answer_text
      );
  end if;

  update public.application_questions
  set
    question_text = case
      when p_payload ? 'question_text' then p_payload ->> 'question_text'
      else application_questions.question_text
    end,
    question_type = v_target_type,
    is_required = case
      when p_payload ? 'is_required'
        then (p_payload ->> 'is_required')::boolean
      else application_questions.is_required
    end,
    display_order = case
      when p_payload ? 'display_order'
        then (p_payload ->> 'display_order')::integer
      else application_questions.display_order
    end
  where application_questions.id = p_question_id
    and application_questions.listing_id = p_listing_id;

  if v_target_type <> 'SELECT' or p_payload ? 'options' then
    delete from public.application_question_options
    where application_question_options.question_id = p_question_id;

    if v_target_type = 'SELECT' then
      insert into public.application_question_options (
        question_id,
        option_text,
        display_order
      )
      select
        p_question_id,
        option_record.option_text,
        option_record.display_order
      from jsonb_to_recordset(p_payload -> 'options')
        as option_record(option_text text, display_order integer);
    end if;
  end if;

  return query select 'OK'::text, p_question_id;
end;
$$;

create or replace function public.submit_application_transaction(
  p_application_id uuid,
  p_tenant_id uuid,
  p_actor_user_id uuid
)
returns table (
  outcome text,
  application_id uuid,
  submitted_at timestamptz,
  missing_fields text[],
  missing_question_ids uuid[],
  invalid_question_ids uuid[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.applications%rowtype;
  v_listing_id uuid;
  v_listing_status text;
  v_property_archived_at timestamptz;
  v_missing_fields text[];
  v_missing_question_ids uuid[];
  v_invalid_question_ids uuid[];
  v_submitted_at timestamptz;
begin
  select applications.listing_id
    into v_listing_id
  from public.applications
  join public.tenant_profiles
    on tenant_profiles.id = applications.tenant_id
  where applications.id = p_application_id
    and applications.tenant_id = p_tenant_id
    and tenant_profiles.user_id = p_actor_user_id;

  if not found then
    return query select
      'NOT_FOUND'::text,
      p_application_id,
      null::timestamptz,
      array[]::text[],
      array[]::uuid[],
      array[]::uuid[];
    return;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_listing_id::text, 0));

  select applications.*
    into v_application
  from public.applications
  join public.tenant_profiles
    on tenant_profiles.id = applications.tenant_id
  where applications.id = p_application_id
    and applications.tenant_id = p_tenant_id
    and tenant_profiles.user_id = p_actor_user_id
  for update of applications;

  if not found then
    return query select
      'NOT_FOUND'::text,
      p_application_id,
      null::timestamptz,
      array[]::text[],
      array[]::uuid[],
      array[]::uuid[];
    return;
  end if;

  if v_application.status = 'SUBMITTED' then
    if not exists (
      select 1
      from public.application_status_history
      where application_status_history.application_id = p_application_id
        and application_status_history.from_status = 'DRAFT'
        and application_status_history.to_status = 'SUBMITTED'
    ) then
      return query select
        'INTEGRITY_ERROR'::text,
        p_application_id,
        v_application.submitted_at,
        array[]::text[],
        array[]::uuid[],
        array[]::uuid[];
      return;
    end if;

    return query select
      'ALREADY_SUBMITTED'::text,
      p_application_id,
      v_application.submitted_at,
      array[]::text[],
      array[]::uuid[],
      array[]::uuid[];
    return;
  end if;

  if v_application.status <> 'DRAFT' or v_application.submitted_at is not null then
    return query select
      'NOT_SUBMITTABLE'::text,
      p_application_id,
      v_application.submitted_at,
      array[]::text[],
      array[]::uuid[],
      array[]::uuid[];
    return;
  end if;

  select listings.status, properties.archived_at
    into v_listing_status, v_property_archived_at
  from public.listings
  join public.properties
    on properties.id = listings.property_id
  where listings.id = v_application.listing_id
  for share of listings, properties;

  if not found
     or v_listing_status <> 'ACTIVE'
     or v_property_archived_at is not null then
    return query select
      'LISTING_NOT_AVAILABLE'::text,
      p_application_id,
      null::timestamptz,
      array[]::text[],
      array[]::uuid[],
      array[]::uuid[];
    return;
  end if;

  v_missing_fields := array_remove(array[
    case when v_application.move_in_date is null then 'move_in_date' end,
    case
      when v_application.requested_lease_duration_months is null
        then 'requested_lease_duration_months'
    end,
    case
      when v_application.number_of_occupants is null
        then 'number_of_occupants'
    end
  ], null);

  select coalesce(array_agg(application_questions.id order by
      application_questions.display_order,
      application_questions.created_at,
      application_questions.id), array[]::uuid[])
    into v_missing_question_ids
  from public.application_questions
  left join public.application_answers
    on application_answers.question_id = application_questions.id
   and application_answers.application_id = p_application_id
  where application_questions.listing_id = v_application.listing_id
    and application_questions.is_required
    and (
      application_answers.id is null
      or application_answers.answer_text is null
      or btrim(application_answers.answer_text) = ''
    );

  select coalesce(array_agg(application_answers.question_id order by
      application_answers.question_id), array[]::uuid[])
    into v_invalid_question_ids
  from public.application_answers
  join public.application_questions
    on application_questions.id = application_answers.question_id
  where application_answers.application_id = p_application_id
    and (
      application_questions.listing_id <> v_application.listing_id
      or application_answers.answer_text is null
      or btrim(application_answers.answer_text) = ''
      or case application_questions.question_type
        when 'TEXT' then length(btrim(application_answers.answer_text)) > 2000
        when 'NUMBER' then application_answers.answer_text !~
          '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$'
        when 'BOOLEAN' then application_answers.answer_text not in ('true', 'false')
        when 'DATE' then not case
          when application_answers.answer_text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
            then to_char(
              to_date(application_answers.answer_text, 'FXYYYY-MM-DD'),
              'YYYY-MM-DD'
            ) = application_answers.answer_text
          else false
        end
        when 'SELECT' then not exists (
          select 1
          from public.application_question_options
          where application_question_options.question_id = application_questions.id
            and application_question_options.option_text = application_answers.answer_text
        )
        else true
      end
    );

  if cardinality(v_missing_fields) > 0
     or cardinality(v_missing_question_ids) > 0
     or cardinality(v_invalid_question_ids) > 0 then
    return query select
      'INCOMPLETE'::text,
      p_application_id,
      null::timestamptz,
      v_missing_fields,
      v_missing_question_ids,
      v_invalid_question_ids;
    return;
  end if;

  v_submitted_at := clock_timestamp();

  update public.applications
  set status = 'SUBMITTED', submitted_at = v_submitted_at
  where applications.id = p_application_id
    and applications.tenant_id = p_tenant_id
    and applications.status = 'DRAFT'
    and applications.submitted_at is null;

  if not found then
    return query select
      'NOT_SUBMITTABLE'::text,
      p_application_id,
      null::timestamptz,
      array[]::text[],
      array[]::uuid[],
      array[]::uuid[];
    return;
  end if;

  insert into public.application_status_history (
    application_id,
    from_status,
    to_status,
    changed_by_user_id
  ) values (
    p_application_id,
    'DRAFT',
    'SUBMITTED',
    p_actor_user_id
  );

  return query select
    'SUBMITTED'::text,
    p_application_id,
    v_submitted_at,
    array[]::text[],
    array[]::uuid[],
    array[]::uuid[];
end;
$$;

revoke all on function public.enforce_draft_application_answer_mutation()
  from public, anon, authenticated;
revoke all on function public.mutate_application_question_transaction(
  text, uuid, uuid, uuid, jsonb
) from public, anon, authenticated;
revoke all on function public.submit_application_transaction(uuid, uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.mutate_application_question_transaction(
  text, uuid, uuid, uuid, jsonb
) to service_role;
grant execute on function public.submit_application_transaction(uuid, uuid, uuid)
  to service_role;
