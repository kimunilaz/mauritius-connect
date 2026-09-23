-- Forward replacements: retain each transaction and trigger; authorize the shared manager.

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
  join public.property_manager_profiles
    on property_manager_profiles.id = properties.property_manager_id
  where listings.id = p_listing_id
    and property_manager_profiles.user_id = p_actor_user_id
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

  if p_actor_role in ('LANDLORD','AGENT') then
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
      join public.property_manager_profiles
        on property_manager_profiles.id = properties.property_manager_id
      join public.profiles
        on profiles.id = property_manager_profiles.user_id
      where listings.id = v_application.listing_id
        and property_manager_profiles.user_id = p_actor_user_id
        and profiles.role=p_actor_role and profiles.role in ('LANDLORD','AGENT')
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
    when p_actor_role in ('LANDLORD','AGENT')
      and p_target_status = 'UNDER_REVIEW'
      then v_application.status = 'SUBMITTED'
    when p_actor_role in ('LANDLORD','AGENT')
      and p_target_status = 'SHORTLISTED'
      then v_application.status = 'UNDER_REVIEW'
    when p_actor_role in ('LANDLORD','AGENT')
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
    join public.property_manager_profiles
      on property_manager_profiles.id = properties.property_manager_id
    join public.profiles on profiles.id = property_manager_profiles.user_id
    where listings.id = v_application.listing_id
      and property_manager_profiles.user_id = p_actor_user_id
      and profiles.role in ('LANDLORD','AGENT')
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
  elsif p_actor_role in ('LANDLORD','AGENT') then
    select exists (
      select 1
      from public.listings
      join public.properties on properties.id = listings.property_id
      join public.property_manager_profiles
        on property_manager_profiles.id = properties.property_manager_id
      join public.profiles on profiles.id = property_manager_profiles.user_id
      where listings.id = v_application.listing_id
        and property_manager_profiles.user_id = p_actor_user_id
        and profiles.role=p_actor_role and profiles.role in ('LANDLORD','AGENT')
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
    when p_action = 'CANCEL' and p_actor_role in ('TENANT', 'LANDLORD', 'AGENT')
      then v_viewing.status in ('PROPOSED', 'CONFIRMED')
    when p_actor_role in ('LANDLORD','AGENT') and p_action = 'COMPLETE'
      then v_viewing.status = 'CONFIRMED'
        and v_viewing.start_time <= clock_timestamp()
        and v_application.status = 'VIEWING_INVITED'
    when p_actor_role in ('LANDLORD','AGENT') and p_action = 'NO_SHOW'
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

  select property_manager_profiles.user_id into v_landlord_user_id
  from public.listings
  join public.properties on properties.id = listings.property_id
  join public.property_manager_profiles on property_manager_profiles.id = properties.property_manager_id
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

create or replace function public.emit_application_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_recipient uuid; v_type text; v_title text; v_message text;
begin
 if new.to_status='SUBMITTED' then select property_manager_profiles.user_id into v_recipient from public.applications join public.listings on listings.id=applications.listing_id join public.properties on properties.id=listings.property_id join public.property_manager_profiles on property_manager_profiles.id=properties.property_manager_id where applications.id=new.application_id;v_type:='APPLICATION_SUBMITTED';v_title:='New rental application';v_message:='A tenant submitted a rental application.';
 elsif new.to_status='UNDER_REVIEW' then select tenant_profiles.user_id into v_recipient from public.applications join public.tenant_profiles on tenant_profiles.id=applications.tenant_id where applications.id=new.application_id;v_type:='APPLICATION_UNDER_REVIEW';v_title:='Your application is under review';v_message:='Your rental application is now under review.';
 elsif new.to_status='SHORTLISTED' then select tenant_profiles.user_id into v_recipient from public.applications join public.tenant_profiles on tenant_profiles.id=applications.tenant_id where applications.id=new.application_id;v_type:='APPLICATION_SHORTLISTED';v_title:='Your application was shortlisted';v_message:='Your rental application was shortlisted.';
 elsif new.to_status='REJECTED' then select tenant_profiles.user_id into v_recipient from public.applications join public.tenant_profiles on tenant_profiles.id=applications.tenant_id where applications.id=new.application_id;v_type:='APPLICATION_REJECTED';v_title:='Your application was not selected';v_message:='Your rental application was not selected.';
 elsif new.to_status='WITHDRAWN' then select property_manager_profiles.user_id into v_recipient from public.applications join public.listings on listings.id=applications.listing_id join public.properties on properties.id=listings.property_id join public.property_manager_profiles on property_manager_profiles.id=properties.property_manager_id where applications.id=new.application_id;v_type:='APPLICATION_WITHDRAWN';v_title:='Application withdrawn';v_message:='A tenant withdrew a rental application.';
 elsif new.to_status='ACCEPTED' then select tenant_profiles.user_id into v_recipient from public.applications join public.tenant_profiles on tenant_profiles.id=applications.tenant_id where applications.id=new.application_id;v_type:='APPLICATION_ACCEPTED';v_title:='Application accepted';v_message:='Your rental application was accepted.';
 else return new; end if;
 if v_recipient is not null then begin insert into public.notifications(user_id,type,title,message,entity_type,entity_id,source_event_key) values(v_recipient,v_type,v_title,v_message,'APPLICATION',new.application_id,'application_status_history:'||new.id::text);exception when unique_violation then null;end;end if;return new;
end; $$;

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
  select tenant_profiles.user_id, property_manager_profiles.user_id
    into v_tenant, v_landlord
  from public.applications
  join public.tenant_profiles on tenant_profiles.id = applications.tenant_id
  join public.listings on listings.id = applications.listing_id
  join public.properties on properties.id = listings.property_id
  join public.property_manager_profiles on property_manager_profiles.id = properties.property_manager_id
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

  select tenant_profiles.user_id, property_manager_profiles.user_id
    into v_tenant, v_landlord
  from public.applications
  join public.tenant_profiles on tenant_profiles.id = applications.tenant_id
  join public.listings on listings.id = applications.listing_id
  join public.properties on properties.id = listings.property_id
  join public.property_manager_profiles on property_manager_profiles.id = properties.property_manager_id
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
     or v_reporter.role not in ('TENANT', 'LANDLORD', 'AGENT') then
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
    join public.property_manager_profiles on property_manager_profiles.id = properties.property_manager_id
    where listings.id = p_target_id
      and properties.archived_at is null
      and (
        listings.status = 'ACTIVE'
        or (v_reporter.role in ('LANDLORD','AGENT') and property_manager_profiles.user_id = p_reporter_user_id)
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

create or replace function public.create_verification_transaction(p_landlord_user_id uuid,p_type text,p_property_id uuid default null)
returns table(outcome text,verification_id uuid) language plpgsql security definer set search_path = '' as $$
declare v_subject_type text; v_subject_id uuid; v_id uuid;
begin
 select role into strict v_subject_type from public.profiles where id=p_landlord_user_id and role in ('LANDLORD','AGENT') and account_status='ACTIVE';
 if p_type='LANDLORD_IDENTITY' then if v_subject_type<>'LANDLORD' then return query select 'INVALID',null::uuid; return; end if; v_subject_type:='USER'; v_subject_id:=p_landlord_user_id;
 elsif p_type='PROPERTY_AUTHORITY' then v_subject_type:='PROPERTY'; v_subject_id:=p_property_id; if not exists(select 1 from public.properties p join public.property_manager_profiles l on l.id=p.property_manager_id where p.id=p_property_id and l.user_id=p_landlord_user_id) then return query select 'NOT_FOUND',null::uuid; return; end if;
 else return query select 'INVALID',null::uuid; return; end if;
 select id into v_id from public.verification_records where subject_type=v_subject_type and subject_id=v_subject_id and verification_type=p_type and status='PENDING' for update;
 if v_id is not null then return query select 'EXISTING',v_id; return; end if;
 begin insert into public.verification_records(subject_type,subject_id,verification_type,status) values(v_subject_type,v_subject_id,p_type,'PENDING') returning id into v_id; exception when unique_violation then select id into v_id from public.verification_records where subject_type=v_subject_type and subject_id=v_subject_id and verification_type=p_type and status='PENDING'; return query select 'EXISTING',v_id; return; end;
 return query select 'CREATED',v_id;
end; $$;

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

  if p_action = 'SUSPEND' and v_role in ('LANDLORD','AGENT') then
    update public.listings
    set status = 'PAUSED'
    where listings.status = 'ACTIVE'
      and exists (
        select 1
        from public.properties
        join public.property_manager_profiles
          on property_manager_profiles.id = properties.property_manager_id
        where properties.id = listings.property_id
          and property_manager_profiles.user_id = p_user
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

create or replace function public.accept_application_transaction(
  p_landlord uuid,
  p_application uuid
)
returns table(outcome text, current_status text, listing_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_app public.applications%rowtype;
  v_listing public.listings%rowtype;
  v_landlord uuid;
  v_now timestamptz;
begin
  select l.*
  into v_listing
  from public.listings l
  where l.id = (
    select listing_id
    from public.applications
    where id = p_application
  )
  for update;

  if not found then
    return query select 'NOT_FOUND', null::text, null::text;
    return;
  end if;

  select property_manager_profiles.user_id
  into v_landlord
  from public.properties
  join public.property_manager_profiles
    on property_manager_profiles.id = properties.property_manager_id
  where properties.id = v_listing.property_id;

  if v_landlord <> p_landlord then
    return query select 'NOT_FOUND', null::text, v_listing.status;
    return;
  end if;

  select *
  into v_app
  from public.applications
  where id = p_application
  for update;

  if v_app.status = 'ACCEPTED' then
    return query select 'ALREADY_TARGET', 'ACCEPTED', v_listing.status;
    return;
  end if;

  if v_app.status <> 'VIEWING_COMPLETED'
    or v_listing.status <> 'ACTIVE'
    or exists (
      select 1
      from public.properties
      where id = v_listing.property_id
        and archived_at is not null
    ) then
    return query select 'INVALID_TRANSITION', v_app.status, v_listing.status;
    return;
  end if;

  if exists (
    select 1
    from public.applications
    where listing_id = v_listing.id
      and status = 'ACCEPTED'
  ) then
    return query select 'INVALID_TRANSITION', v_app.status, v_listing.status;
    return;
  end if;

  v_now := clock_timestamp();

  update public.applications
  set status = 'ACCEPTED'
  where id = v_app.id;

  insert into public.application_status_history (
    application_id,
    from_status,
    to_status,
    changed_by_user_id,
    created_at
  ) values (
    v_app.id,
    'VIEWING_COMPLETED',
    'ACCEPTED',
    p_landlord,
    v_now
  );

  update public.listings
  set status = 'RENTED'
  where id = v_listing.id;

  for v_app in
    select *
    from public.applications
    where listing_id = v_listing.id
      and status in (
        'SUBMITTED',
        'UNDER_REVIEW',
        'SHORTLISTED',
        'VIEWING_INVITED',
        'VIEWING_COMPLETED'
      )
      and id <> p_application
    for update
  loop
    update public.applications
    set status = 'REJECTED'
    where id = v_app.id;

    insert into public.application_status_history (
      application_id,
      from_status,
      to_status,
      changed_by_user_id,
      created_at
    ) values (
      v_app.id,
      v_app.status,
      'REJECTED',
      p_landlord,
      v_now
    );
  end loop;

  return query select 'TRANSITIONED', 'ACCEPTED', 'RENTED';
end;
$$;

create or replace function public.record_rent_receipt(p_actor uuid,p_ledger uuid,p_amount numeric,p_received date,p_reference text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_entry public.rent_ledger_entries; v_receipt public.rent_receipts; v_paid numeric;
begin
 select e.* into v_entry from public.rent_ledger_entries e join public.properties p on p.id=e.property_id
 join public.property_manager_profiles lp on lp.id=p.property_manager_id join public.profiles actor on actor.id=lp.user_id
 where e.id=p_ledger and p.archived_at is null and actor.id=p_actor and actor.role in ('LANDLORD','AGENT') and actor.account_status='ACTIVE' for update of e;
 if not found then raise exception 'OPERATION_NOT_FOUND'; end if;
 select * into v_receipt from public.rent_receipts where request_key=p_key;
 if found then
  if v_receipt.ledger_id<>p_ledger or v_receipt.amount<>p_amount or v_receipt.received_on<>p_received then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return to_jsonb(v_receipt);
 end if;
 select coalesce(sum(amount),0) into v_paid from public.rent_receipts where ledger_id=p_ledger;
 if v_entry.waived or p_amount<=0 or v_paid+p_amount>v_entry.amount_due or p_received>current_date then raise exception 'INVALID_RECEIPT'; end if;
 insert into public.rent_receipts(property_id,ledger_id,amount,received_on,reference,request_key,recorded_by)
 values(v_entry.property_id,p_ledger,p_amount,p_received,p_reference,p_key,p_actor) returning * into v_receipt;
 return to_jsonb(v_receipt);
end; $$;

create or replace function public.track_maintenance_update() returns trigger language plpgsql security definer set search_path='' as $$
declare v_owner uuid; v_tenant uuid; v_event uuid;
begin
 if TG_OP='INSERT' or new.status is distinct from old.status or new.owner_update is distinct from old.owner_update then
 insert into public.maintenance_updates(maintenance_id,status,message) values(new.id,new.status,new.owner_update) returning id into v_event;
 select lp.user_id into v_owner from public.properties p join public.property_manager_profiles lp on lp.id=p.property_manager_id where p.id=new.property_id;
 select tenant_user_id into v_tenant from public.tenancies where id=new.tenancy_id and status in ('UPCOMING','ACTIVE','ENDING') and (end_date is null or end_date>=current_date) and (expected_end_date is null or expected_end_date>=current_date);
 if TG_OP='INSERT' and new.submitted_by<>v_owner then
 insert into public.notifications(user_id,type,title,message,entity_type,entity_id,source_event_key) values
 (v_owner,'MAINTENANCE_NEW','New maintenance request','A tenant submitted a maintenance request.','PROPERTY',new.property_id,'maintenance:'||v_event::text||':owner') on conflict do nothing;
 elsif TG_OP='UPDATE' and v_tenant is not null then
 insert into public.notifications(user_id,type,title,message,entity_type,entity_id,source_event_key) values
 (v_tenant,'MAINTENANCE_UPDATED','Maintenance updated','Your maintenance request has an update.','TENANCY',new.tenancy_id,'maintenance:'||v_event::text||':tenant') on conflict do nothing;
 end if;
 end if;
 return new;
end; $$;

drop function public.owner_operations_summary(uuid,uuid,date,date,integer,integer,text,text);
create function public.owner_operations_summary(p_actor uuid,p_property uuid default null,p_from date default current_date,p_to date default current_date,p_page integer default 1,p_limit integer default 20,p_occupancy text default null,p_location text default null,p_owner uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.profiles where id=p_actor and role in ('LANDLORD','AGENT') and account_status='ACTIVE') then raise exception 'OPERATION_NOT_FOUND'; end if;
 if p_limit<1 or p_limit>100 or p_page<1 or p_from>p_to then raise exception 'INVALID_FILTER'; end if;
 with owned as materialized (
 select p.*,d.reference_name,d.floor_area from public.properties p join public.property_manager_profiles lp on lp.id=p.property_manager_id
 left join public.property_operational_details d on d.property_id=p.id where lp.user_id=p_actor and (p_owner is null or p.managed_owner_id=p_owner) and (p_property is null or p.id=p_property)
 ), tenancies as materialized (select t.* from public.tenancies t join owned p on p.id=t.property_id),
 ledger as materialized (
 select e.*,coalesce((select sum(r.amount) from public.rent_receipts r where r.ledger_id=e.id),0) paid
 from public.rent_ledger_entries e join owned p on p.id=e.property_id
 ), maintenance as materialized(select m.* from public.maintenance_requests m join owned p on p.id=m.property_id),
 financial as materialized(select f.* from public.property_financial_records f join owned p on p.id=f.property_id where not f.voided and f.record_date between p_from and p_to),
 receipts as materialized(select r.* from public.rent_receipts r join owned p on p.id=r.property_id where r.received_on between p_from and p_to),
 portfolio as materialized (
 select p.id,p.managed_owner_id,(select o.name from public.managed_property_owners o where o.id=p.managed_owner_id) owner_name,coalesce(p.reference_name,p.address_line_1,p.property_type||' in '||p.locality) name,p.locality,p.property_type,p.archived_at,
 (select storage_path from public.property_images i where i.property_id=p.id and i.is_cover limit 1) cover_path,
 case when p.archived_at is not null then 'INACTIVE' when t.id is not null then case when t.status='ENDING' then 'NOTICE_GIVEN' else 'OCCUPIED' end else 'VACANT' end occupancy,
 t.id tenancy_id,t.tenant_name,t.monthly_rent,t.start_date,t.expected_end_date,t.deposit_amount,
 (select l.status from public.listings l where l.property_id=p.id order by case when l.status in ('ACTIVE','PENDING_REVIEW','PAUSED') then 0 else 1 end,l.created_at desc limit 1) listing_status,
 (select count(*) from maintenance m where m.property_id=p.id and m.status not in ('COMPLETED','CANCELLED')) open_maintenance
 from owned p left join lateral(select * from tenancies t where t.property_id=p.id and t.status in ('ACTIVE','ENDING') and t.start_date<=current_date and (t.end_date is null or t.end_date>=current_date) and (t.expected_end_date is null or t.expected_end_date>=current_date) order by t.start_date desc limit 1)t on true
 ), attention as (
 select e.id,e.property_id,'Rent overdue' title,e.due_date date,'rent' domain,1 urgency from ledger e where not e.waived and e.paid<e.amount_due and e.due_date<current_date
 union all select m.id,m.property_id,m.title,coalesce(m.scheduled_date,m.created_at::date),'maintenance',case when m.priority='URGENT' then 0 else 2 end from maintenance m where m.status not in ('COMPLETED','CANCELLED')
 union all select t.id,t.property_id,t.title,t.due_date,'tasks',3 from public.property_tasks t join owned p on p.id=t.property_id where t.status='OPEN'
 union all select i.id,i.property_id,'Inspection: '||lower(replace(i.type,'_',' ')),i.inspection_date,'inspections',3 from public.property_inspections i join owned p on p.id=i.property_id where i.status='SCHEDULED'
 union all select t.id,t.property_id,'Tenancy ending',t.expected_end_date,'tenancies',2 from tenancies t where t.status in ('ACTIVE','ENDING','UPCOMING') and t.expected_end_date<=current_date+30
 union all select a.id,l.property_id,'Application awaiting review',a.submitted_at::date,'applications',3 from public.applications a join public.listings l on l.id=a.listing_id join owned p on p.id=l.property_id where a.status in ('SUBMITTED','UNDER_REVIEW')
 union all select v.id,l.property_id,'Upcoming viewing',v.start_time::date,'viewings',3 from public.viewings v join public.applications a on a.id=v.application_id join public.listings l on l.id=a.listing_id join owned p on p.id=l.property_id where v.status in ('PROPOSED','CONFIRMED') and v.start_time>=now()
 ), activity as (
 select p.id,p.id property_id,'Property added' title,p.created_at occurred_at from owned p
 union all select t.id,t.property_id,'Tenancy: '||lower(t.status),t.updated_at from tenancies t
 union all select r.id,r.property_id,'Offline rent recorded',r.created_at from public.rent_receipts r join owned p on p.id=r.property_id
 union all select u.id,m.property_id,'Maintenance '||lower(u.status)||': '||m.title,u.created_at from public.maintenance_updates u join maintenance m on m.id=u.maintenance_id
 union all select i.id,i.property_id,'Inspection: '||lower(i.status),i.updated_at from public.property_inspections i join owned p on p.id=i.property_id
 union all select d.id,d.property_id,'Document: '||d.filename,d.created_at from public.property_documents d join owned p on p.id=d.property_id
 union all select f.id,f.property_id,'Financial record: '||lower(f.kind),f.updated_at from public.property_financial_records f join owned p on p.id=f.property_id
 union all select l.id,l.property_id,'Listing: '||lower(l.status),l.updated_at from public.listings l join owned p on p.id=l.property_id
 union all select a.id,l.property_id,'Application: '||lower(a.status),a.updated_at from public.applications a join public.listings l on l.id=a.listing_id join owned p on p.id=l.property_id where a.status<>'DRAFT'
 union all select v.id,l.property_id,'Viewing: '||lower(v.status),v.updated_at from public.viewings v join public.applications a on a.id=v.application_id join public.listings l on l.id=a.listing_id join owned p on p.id=l.property_id
 ) select jsonb_build_object(
 'period',jsonb_build_object('from',p_from,'to',p_to),
 'totals',jsonb_build_object('properties',(select count(*) from portfolio where archived_at is null),'occupied',(select count(*) from portfolio where occupancy in ('OCCUPIED','NOTICE_GIVEN')),'vacant',(select count(*) from portfolio where occupancy='VACANT'),'advertised',(select count(distinct l.property_id) from public.listings l join owned p on p.id=l.property_id where l.status='ACTIVE'),'applications',(select count(*) from public.applications a join public.listings l on l.id=a.listing_id join owned p on p.id=l.property_id where a.status in ('SUBMITTED','UNDER_REVIEW')),'unread_messages',(select count(*) from public.messages m join public.conversation_participants cp on cp.conversation_id=m.conversation_id join public.conversations c on c.id=m.conversation_id left join public.tenancies ct on ct.id=c.tenancy_id left join public.listings cl on cl.id=c.listing_id where cp.user_id=p_actor and exists(select 1 from owned p where p.id=coalesce(ct.property_id,cl.property_id)) and m.sender_user_id<>p_actor and m.created_at>coalesce(cp.last_read_at,'1970-01-01'::timestamptz)),'maintenance',(select count(*) from maintenance where status not in ('COMPLETED','CANCELLED')),'overdue',(select count(*) from ledger where not waived and due_date<current_date and paid<amount_due)),
 'finances',jsonb_build_object('expected',coalesce((select sum(amount_due) from ledger where not waived and due_date between p_from and p_to),0),'received',coalesce((select sum(amount) from receipts),0),'outstanding',coalesce((select sum(greatest(amount_due-paid,0)) from ledger where not waived and due_date between p_from and p_to),0),'overdue',coalesce((select sum(greatest(amount_due-paid,0)) from ledger where not waived and due_date<current_date and due_date between p_from and p_to),0),'income',coalesce((select sum(amount) from financial where kind='INCOME'),0)+coalesce((select sum(amount) from receipts),0),'expenses',coalesce((select sum(amount) from financial where kind='EXPENSE'),0),'maintenance_cost',coalesce((select sum(amount) from financial where kind='EXPENSE' and category='MAINTENANCE'),0)),
 'portfolio',coalesce((select jsonb_agg(x) from (select * from portfolio where (p_occupancy is null or occupancy=p_occupancy) and (p_location is null or locality ilike '%'||p_location||'%') order by name,id limit p_limit offset (p_page-1)*p_limit)x),'[]'::jsonb),
 'owners',(select count(*) from public.managed_property_owners o join public.property_manager_profiles m on m.id=o.property_manager_id where m.user_id=p_actor and o.archived_at is null),
 'total_properties',(select count(*) from portfolio where (p_occupancy is null or occupancy=p_occupancy) and (p_location is null or locality ilike '%'||p_location||'%')),
 'attention',coalesce((select jsonb_agg(x) from (select a.*,p.name property_name,p.owner_name,p.managed_owner_id from attention a join portfolio p on p.id=a.property_id where date<=current_date+30 order by urgency,date,id limit 12)x),'[]'::jsonb),
 'upcoming',coalesce((select jsonb_agg(x) from (select a.*,p.name property_name,p.owner_name,p.managed_owner_id from attention a join portfolio p on p.id=a.property_id where date>=current_date order by date,id limit 12)x),'[]'::jsonb),
 'activity',coalesce((select jsonb_agg(x) from (select * from activity where occurred_at::date between p_from and p_to order by occurred_at desc,id limit 30)x),'[]'::jsonb),
 'total_tenancies',(select count(*) from tenancies where start_date<=p_to and coalesce(end_date,expected_end_date,'infinity'::date)>=p_from),
 'tenancy_history',coalesce((select jsonb_agg(x) from (select id,property_id,tenant_name,start_date,expected_end_date,end_date,status,monthly_rent from tenancies where start_date<=p_to and coalesce(end_date,expected_end_date,'infinity'::date)>=p_from order by start_date desc,id limit p_limit offset (p_page-1)*p_limit)x),'[]'::jsonb)
 ) into result;
 return result;
end; $$;

create or replace function public.tenancy_conversation(p_actor uuid,p_tenancy uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_t public.tenancies; v_owner uuid; v_id uuid;
begin
 select * into v_t from public.tenancies where id=p_tenancy and status in ('ACTIVE','UPCOMING','ENDING') and (end_date is null or end_date>=current_date) and (expected_end_date is null or expected_end_date>=current_date) for update;
 if not found or v_t.tenant_user_id is null then raise exception 'OPERATION_NOT_FOUND'; end if;
 select lp.user_id into v_owner from public.properties p join public.property_manager_profiles lp on lp.id=p.property_manager_id where p.id=v_t.property_id;
 if p_actor not in(v_owner,v_t.tenant_user_id) or not exists(select 1 from public.profiles where id=p_actor and account_status='ACTIVE') then raise exception 'OPERATION_NOT_FOUND'; end if;
 insert into public.conversations(tenancy_id,tenant_user_id,landlord_user_id) values(v_t.id,v_t.tenant_user_id,v_owner)
 on conflict(tenancy_id) where tenancy_id is not null do update set tenancy_id=excluded.tenancy_id returning id into v_id;
 insert into public.conversation_participants(conversation_id,user_id) values(v_id,v_owner),(v_id,v_t.tenant_user_id) on conflict do nothing;
 return v_id;
end; $$;

create or replace function public.guard_tenant_maintenance() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.properties p join public.property_manager_profiles lp on lp.id=p.property_manager_id where p.id=new.property_id and lp.user_id=new.submitted_by) then
 perform 1 from public.tenancies t join public.profiles actor on actor.id=t.tenant_user_id
 where t.id=new.tenancy_id and t.property_id=new.property_id and t.tenant_user_id=new.submitted_by
 and t.status in ('ACTIVE','ENDING') and t.start_date<=current_date and (t.end_date is null or t.end_date>=current_date) and (t.expected_end_date is null or t.expected_end_date>=current_date) and actor.account_status='ACTIVE' for share of t;
 if not found then raise exception 'OPERATION_NOT_FOUND'; end if;
 end if;return new;
end; $$;

create or replace function public.guard_tenant_document() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.properties p join public.property_manager_profiles lp on lp.id=p.property_manager_id where p.id=new.property_id and lp.user_id=new.uploaded_by) then
 perform 1 from public.tenancies t join public.maintenance_requests m on m.tenancy_id=t.id join public.profiles actor on actor.id=t.tenant_user_id
 where t.id=new.tenancy_id and t.property_id=new.property_id and t.tenant_user_id=new.uploaded_by and m.id=new.maintenance_id
 and t.status in ('ACTIVE','ENDING') and t.start_date<=current_date and (t.end_date is null or t.end_date>=current_date) and (t.expected_end_date is null or t.expected_end_date>=current_date)
 and actor.account_status='ACTIVE' and new.shared_tenancy_id=t.id and new.category='MAINTENANCE' and new.mime_type in ('image/jpeg','image/png','image/webp') for share of t;
 if not found then raise exception 'OPERATION_NOT_FOUND'; end if;
 end if;return new;
end; $$;

drop function public.operations_rent_records(uuid,uuid,uuid,uuid,text,date,date,integer,integer);
create function public.operations_rent_records(p_actor uuid,p_property uuid default null,p_tenancy uuid default null,p_id uuid default null,p_status text default null,p_from date default null,p_to date default null,p_page integer default 1,p_limit integer default 20,p_owner uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_page<1 or p_limit<1 or p_limit>100 then raise exception 'INVALID_FILTER'; end if;
 with scoped as materialized (
 select e.*,p.locality,coalesce((select sum(r.amount) from public.rent_receipts r where r.ledger_id=e.id),0) amount_paid
 from public.rent_ledger_entries e join public.properties p on p.id=e.property_id
 join public.property_manager_profiles lp on lp.id=p.property_manager_id join public.tenancies t on t.id=e.tenancy_id
 join public.profiles actor on actor.id=p_actor and actor.account_status='ACTIVE'
 where ((actor.role in ('LANDLORD','AGENT') and lp.user_id=p_actor) or (actor.role='TENANT' and t.tenant_user_id=p_actor
 and t.status in ('ACTIVE','UPCOMING','ENDING') and (t.end_date is null or t.end_date>=current_date) and (t.expected_end_date is null or t.expected_end_date>=current_date)))
 and (p_owner is null or p.managed_owner_id=p_owner) and (p_property is null or e.property_id=p_property) and (p_tenancy is null or e.tenancy_id=p_tenancy) and (p_id is null or e.id=p_id)
 and (p_from is null or e.due_date>=p_from) and (p_to is null or e.due_date<=p_to)
 ), derived as (
 select s.*,case when waived then 0 else greatest(amount_due-amount_paid,0) end outstanding,
 case when waived then 'WAIVED' when amount_paid>=amount_due then 'PAID' when due_date<current_date then 'OVERDUE' when amount_paid>0 then 'PARTIALLY_PAID' when due_date=current_date then 'DUE' else 'UPCOMING' end rent_status from scoped s
 ), filtered as materialized(select * from derived where p_status is null or rent_status=p_status)
 select jsonb_build_object('total',(select count(*) from filtered),'items',coalesce((select jsonb_agg(to_jsonb(x)-'locality'||jsonb_build_object('property',jsonb_build_object('locality',x.locality),'receipts',coalesce((select jsonb_agg(r) from (select id,ledger_id,amount,received_on,created_at from public.rent_receipts where ledger_id=x.id order by received_on desc,id limit 100) r),'[]'::jsonb))) from (select * from filtered order by due_date desc,id limit p_limit offset (p_page-1)*p_limit)x),'[]'::jsonb)) into result;
 return result;
end; $$;

revoke all on function public.owner_operations_summary(uuid,uuid,date,date,integer,integer,text,text,uuid),public.operations_rent_records(uuid,uuid,uuid,uuid,text,date,date,integer,integer,uuid) from public,anon,authenticated;
grant execute on function public.owner_operations_summary(uuid,uuid,date,date,integer,integer,text,text,uuid),public.operations_rent_records(uuid,uuid,uuid,uuid,text,date,date,integer,integer,uuid) to service_role;
