create table public.application_questions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null,
  question_text text not null,
  question_type text not null,
  is_required boolean not null default false,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint application_questions_listing_fk
    foreign key (listing_id) references public.listings (id) on delete restrict,
  constraint application_questions_question_type_check
    check (question_type in ('TEXT', 'NUMBER', 'BOOLEAN', 'DATE', 'SELECT')),
  constraint application_questions_display_order_check check (display_order >= 0)
);

create table public.application_question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null,
  option_text text not null,
  display_order integer not null default 0,
  constraint application_question_options_question_fk
    foreign key (question_id)
    references public.application_questions (id)
    on delete cascade,
  constraint application_question_options_display_order_check
    check (display_order >= 0)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null,
  tenant_id uuid not null,
  move_in_date date,
  requested_lease_duration_months integer,
  number_of_occupants integer,
  introductory_message text,
  status text not null default 'DRAFT',
  submitted_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_listing_fk
    foreign key (listing_id) references public.listings (id) on delete restrict,
  constraint applications_tenant_fk
    foreign key (tenant_id) references public.tenant_profiles (id) on delete restrict,
  constraint applications_listing_tenant_key unique (listing_id, tenant_id),
  constraint applications_status_check
    check (
      status in (
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'SHORTLISTED',
        'VIEWING_INVITED',
        'VIEWING_COMPLETED',
        'ACCEPTED',
        'REJECTED',
        'WITHDRAWN'
      )
    ),
  constraint applications_requested_lease_duration_check
    check (
      requested_lease_duration_months is null
      or requested_lease_duration_months > 0
    ),
  constraint applications_number_of_occupants_check
    check (number_of_occupants is null or number_of_occupants > 0),
  constraint applications_submitted_at_check
    check (status = 'DRAFT' or submitted_at is not null)
);

-- This constraint is the concurrency backstop for later acceptance workflows.
create unique index applications_one_accepted_per_listing_idx
  on public.applications (listing_id)
  where status = 'ACCEPTED';

create table public.application_answers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null,
  question_id uuid not null,
  answer_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint application_answers_application_fk
    foreign key (application_id) references public.applications (id) on delete restrict,
  constraint application_answers_question_fk
    foreign key (question_id)
    references public.application_questions (id)
    on delete restrict,
  constraint application_answers_application_question_key
    unique (application_id, question_id)
);

create table public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null,
  from_status text,
  to_status text not null,
  changed_by_user_id uuid not null,
  created_at timestamptz not null default now(),
  constraint application_status_history_application_fk
    foreign key (application_id) references public.applications (id) on delete restrict,
  constraint application_status_history_changed_by_user_fk
    foreign key (changed_by_user_id)
    references public.profiles (id)
    on delete restrict,
  constraint application_status_history_from_status_check
    check (
      from_status is null
      or from_status in (
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'SHORTLISTED',
        'VIEWING_INVITED',
        'VIEWING_COMPLETED',
        'ACCEPTED',
        'REJECTED',
        'WITHDRAWN'
      )
    ),
  constraint application_status_history_to_status_check
    check (
      to_status in (
        'DRAFT',
        'SUBMITTED',
        'UNDER_REVIEW',
        'SHORTLISTED',
        'VIEWING_INVITED',
        'VIEWING_COMPLETED',
        'ACCEPTED',
        'REJECTED',
        'WITHDRAWN'
      )
    )
);

create table public.viewings (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null,
  proposed_by_user_id uuid not null,
  start_time timestamptz not null,
  end_time timestamptz,
  status text not null default 'PROPOSED',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint viewings_application_fk
    foreign key (application_id) references public.applications (id) on delete restrict,
  constraint viewings_proposed_by_user_fk
    foreign key (proposed_by_user_id)
    references public.profiles (id)
    on delete restrict,
  constraint viewings_status_check
    check (status in ('PROPOSED', 'CONFIRMED', 'DECLINED', 'COMPLETED', 'CANCELLED', 'NO_SHOW')),
  constraint viewings_time_order_check
    check (end_time is null or end_time > start_time)
);
