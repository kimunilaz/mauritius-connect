-- DEVELOPMENT / TEST ONLY
--
-- This seed deliberately does not insert into auth.users. Create the five test
-- identities through Supabase Auth first, using the exact .test emails below.
-- The seed fails before writing application data when any identity is missing.

begin;

do $seed$
declare
  tenant_a_user_id uuid;
  tenant_b_user_id uuid;
  landlord_a_user_id uuid;
  landlord_b_user_id uuid;
  admin_a_user_id uuid;
begin
  select id into tenant_a_user_id
  from auth.users
  where lower(email) = 'tenant.a@example.test';

  select id into tenant_b_user_id
  from auth.users
  where lower(email) = 'tenant.b@example.test';

  select id into landlord_a_user_id
  from auth.users
  where lower(email) = 'landlord.a@example.test';

  select id into landlord_b_user_id
  from auth.users
  where lower(email) = 'landlord.b@example.test';

  select id into admin_a_user_id
  from auth.users
  where lower(email) = 'admin.a@example.test';

  if tenant_a_user_id is null
    or tenant_b_user_id is null
    or landlord_a_user_id is null
    or landlord_b_user_id is null
    or admin_a_user_id is null
  then
    raise exception
      'Development seed requires all five example.test users to be created through Supabase Auth first.';
  end if;

  insert into public.profiles (id, role, first_name, last_name, phone_verified)
  values
    (tenant_a_user_id, 'TENANT', 'Tenant', 'A', true),
    (tenant_b_user_id, 'TENANT', 'Tenant', 'B', false),
    (landlord_a_user_id, 'LANDLORD', 'Landlord', 'A', true),
    (landlord_b_user_id, 'LANDLORD', 'Landlord', 'B', true),
    (admin_a_user_id, 'ADMIN', 'Admin', 'A', true)
  on conflict (id) do update set
    role = excluded.role,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    phone_verified = excluded.phone_verified;

  insert into public.tenant_profiles (
    id,
    user_id,
    occupation_type,
    employer_or_school,
    income_range,
    preferred_move_date,
    preferred_lease_duration_months,
    number_of_occupants,
    has_pets,
    bio
  )
  values
    (
      '10000000-0000-0000-0000-000000000001',
      tenant_a_user_id,
      'EMPLOYED',
      'Mauritius Test Company',
      'MUR_30000_50000',
      current_date + 30,
      12,
      2,
      false,
      'Development tenant persona A.'
    ),
    (
      '10000000-0000-0000-0000-000000000002',
      tenant_b_user_id,
      'STUDENT',
      'Development University',
      'MUR_15000_30000',
      current_date + 45,
      10,
      1,
      true,
      'Development tenant persona B.'
    )
  on conflict (id) do update set
    user_id = excluded.user_id,
    occupation_type = excluded.occupation_type,
    employer_or_school = excluded.employer_or_school,
    income_range = excluded.income_range,
    preferred_move_date = excluded.preferred_move_date,
    preferred_lease_duration_months = excluded.preferred_lease_duration_months,
    number_of_occupants = excluded.number_of_occupants,
    has_pets = excluded.has_pets,
    bio = excluded.bio;

  insert into public.tenant_preferred_locations (
    id,
    tenant_profile_id,
    district,
    locality,
    neighbourhood
  )
  values
    (
      '11000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      'Plaines Wilhems',
      'Quatre Bornes',
      null
    ),
    (
      '11000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000002',
      'Moka',
      'Moka',
      null
    )
  on conflict (id) do update set
    tenant_profile_id = excluded.tenant_profile_id,
    district = excluded.district,
    locality = excluded.locality,
    neighbourhood = excluded.neighbourhood;

  insert into public.landlord_profiles (id, user_id, verification_status)
  values
    (
      '20000000-0000-0000-0000-000000000001',
      landlord_a_user_id,
      'VERIFIED'
    ),
    (
      '20000000-0000-0000-0000-000000000002',
      landlord_b_user_id,
      'PENDING'
    )
  on conflict (id) do update set
    user_id = excluded.user_id,
    verification_status = excluded.verification_status;

  insert into public.properties (
    id,
    landlord_id,
    property_type,
    address_line_1,
    district,
    locality,
    neighbourhood,
    latitude,
    longitude,
    bedrooms,
    bathrooms,
    furnished,
    parking_spaces,
    verification_status
  )
  values
    (
      '30000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001',
      'APARTMENT',
      'Development Address 1',
      'Plaines Wilhems',
      'Quatre Bornes',
      'Sodnac',
      -20.265400,
      57.479100,
      2,
      1.5,
      true,
      1,
      'VERIFIED'
    ),
    (
      '30000000-0000-0000-0000-000000000002',
      '20000000-0000-0000-0000-000000000002',
      'HOUSE',
      'Development Address 2',
      'Moka',
      'Moka',
      null,
      -20.219700,
      57.495000,
      3,
      2.0,
      false,
      2,
      'PENDING'
    )
  on conflict (id) do update set
    landlord_id = excluded.landlord_id,
    property_type = excluded.property_type,
    address_line_1 = excluded.address_line_1,
    district = excluded.district,
    locality = excluded.locality,
    neighbourhood = excluded.neighbourhood,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    bedrooms = excluded.bedrooms,
    bathrooms = excluded.bathrooms,
    furnished = excluded.furnished,
    parking_spaces = excluded.parking_spaces,
    verification_status = excluded.verification_status;

  insert into public.listings (
    id,
    property_id,
    title,
    description,
    monthly_rent,
    deposit_amount,
    available_from,
    minimum_lease_months,
    maximum_occupants,
    pets_allowed,
    status,
    published_at,
    closed_at
  )
  values
    (
      '40000000-0000-0000-0000-000000000001',
      '30000000-0000-0000-0000-000000000001',
      'Development apartment in Quatre Bornes',
      'Sample active listing for local development and tests.',
      28000.00,
      28000.00,
      current_date + 30,
      12,
      3,
      false,
      'ACTIVE',
      now(),
      null
    ),
    (
      '40000000-0000-0000-0000-000000000002',
      '30000000-0000-0000-0000-000000000002',
      'Historical development house in Moka',
      'Sample closed listing that preserves a prior rental cycle.',
      42000.00,
      84000.00,
      current_date - 90,
      12,
      5,
      true,
      'CLOSED',
      now() - interval '120 days',
      now() - interval '30 days'
    )
  on conflict (id) do update set
    property_id = excluded.property_id,
    title = excluded.title,
    description = excluded.description,
    monthly_rent = excluded.monthly_rent,
    deposit_amount = excluded.deposit_amount,
    available_from = excluded.available_from,
    minimum_lease_months = excluded.minimum_lease_months,
    maximum_occupants = excluded.maximum_occupants,
    pets_allowed = excluded.pets_allowed,
    status = excluded.status,
    published_at = excluded.published_at,
    closed_at = excluded.closed_at;

  insert into public.application_questions (
    id,
    listing_id,
    question_text,
    question_type,
    is_required,
    display_order
  )
  values (
    '60000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    'Why is this location suitable for you?',
    'TEXT',
    true,
    0
  )
  on conflict (id) do update set
    listing_id = excluded.listing_id,
    question_text = excluded.question_text,
    question_type = excluded.question_type,
    is_required = excluded.is_required,
    display_order = excluded.display_order;

  insert into public.applications (
    id,
    listing_id,
    tenant_id,
    move_in_date,
    requested_lease_duration_months,
    number_of_occupants,
    introductory_message,
    status,
    submitted_at
  )
  values
    (
      '50000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      current_date + 30,
      12,
      2,
      'Development draft application.',
      'DRAFT',
      null
    ),
    (
      '50000000-0000-0000-0000-000000000002',
      '40000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000002',
      current_date + 45,
      10,
      1,
      'Development submitted application.',
      'SUBMITTED',
      now()
    ),
    (
      '50000000-0000-0000-0000-000000000003',
      '40000000-0000-0000-0000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      current_date - 60,
      12,
      2,
      'Development shortlisted historical application.',
      'SHORTLISTED',
      now() - interval '80 days'
    )
  on conflict (id) do update set
    listing_id = excluded.listing_id,
    tenant_id = excluded.tenant_id,
    move_in_date = excluded.move_in_date,
    requested_lease_duration_months = excluded.requested_lease_duration_months,
    number_of_occupants = excluded.number_of_occupants,
    introductory_message = excluded.introductory_message,
    status = excluded.status,
    submitted_at = excluded.submitted_at;

  insert into public.application_answers (
    id,
    application_id,
    question_id,
    answer_text
  )
  values (
    '61000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000002',
    '60000000-0000-0000-0000-000000000001',
    'It is close to my school and public transport.'
  )
  on conflict (id) do update set
    application_id = excluded.application_id,
    question_id = excluded.question_id,
    answer_text = excluded.answer_text;

  insert into public.application_status_history (
    id,
    application_id,
    from_status,
    to_status,
    changed_by_user_id
  )
  values
    (
      '62000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000002',
      'DRAFT',
      'SUBMITTED',
      tenant_b_user_id
    ),
    (
      '62000000-0000-0000-0000-000000000002',
      '50000000-0000-0000-0000-000000000003',
      'UNDER_REVIEW',
      'SHORTLISTED',
      landlord_b_user_id
    )
  on conflict (id) do update set
    application_id = excluded.application_id,
    from_status = excluded.from_status,
    to_status = excluded.to_status,
    changed_by_user_id = excluded.changed_by_user_id;

  insert into public.viewings (
    id,
    application_id,
    proposed_by_user_id,
    start_time,
    end_time,
    status,
    notes
  )
  values (
    '70000000-0000-0000-0000-000000000001',
    '50000000-0000-0000-0000-000000000003',
    landlord_b_user_id,
    now() + interval '2 days',
    now() + interval '2 days 1 hour',
    'CONFIRMED',
    'Development viewing.'
  )
  on conflict (id) do update set
    application_id = excluded.application_id,
    proposed_by_user_id = excluded.proposed_by_user_id,
    start_time = excluded.start_time,
    end_time = excluded.end_time,
    status = excluded.status,
    notes = excluded.notes;

  insert into public.conversations (
    id,
    listing_id,
    tenant_user_id,
    landlord_user_id
  )
  values (
    '80000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    tenant_a_user_id,
    landlord_a_user_id
  )
  on conflict (id) do update set
    listing_id = excluded.listing_id,
    tenant_user_id = excluded.tenant_user_id,
    landlord_user_id = excluded.landlord_user_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values
    ('80000000-0000-0000-0000-000000000001', tenant_a_user_id),
    ('80000000-0000-0000-0000-000000000001', landlord_a_user_id)
  on conflict (conversation_id, user_id) do nothing;

  insert into public.messages (id, conversation_id, sender_user_id, content)
  values
    (
      '81000000-0000-0000-0000-000000000001',
      '80000000-0000-0000-0000-000000000001',
      tenant_a_user_id,
      'Hello, is the development apartment still available?'
    ),
    (
      '81000000-0000-0000-0000-000000000002',
      '80000000-0000-0000-0000-000000000001',
      landlord_a_user_id,
      'Yes, it is available for the sample workflow.'
    )
  on conflict (id) do update set
    conversation_id = excluded.conversation_id,
    sender_user_id = excluded.sender_user_id,
    content = excluded.content;

  insert into public.notifications (
    id,
    user_id,
    type,
    title,
    message,
    entity_type,
    entity_id,
    read_at
  )
  values
    (
      '90000000-0000-0000-0000-000000000001',
      tenant_a_user_id,
      'NEW_MESSAGE',
      'New message',
      'Landlord A replied to your development conversation.',
      'CONVERSATION',
      '80000000-0000-0000-0000-000000000001',
      null
    ),
    (
      '90000000-0000-0000-0000-000000000002',
      landlord_a_user_id,
      'APPLICATION_DRAFTED',
      'Development activity',
      'Sample notification for the landlord persona.',
      'LISTING',
      '40000000-0000-0000-0000-000000000001',
      now()
    )
  on conflict (id) do update set
    user_id = excluded.user_id,
    type = excluded.type,
    title = excluded.title,
    message = excluded.message,
    entity_type = excluded.entity_type,
    entity_id = excluded.entity_id,
    read_at = excluded.read_at;
end;
$seed$;

commit;
