create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null,
  tenant_user_id uuid not null,
  landlord_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_listing_fk
    foreign key (listing_id) references public.listings (id) on delete restrict,
  constraint conversations_tenant_user_fk
    foreign key (tenant_user_id) references public.profiles (id) on delete restrict,
  constraint conversations_landlord_user_fk
    foreign key (landlord_user_id) references public.profiles (id) on delete restrict,
  constraint conversations_listing_parties_key
    unique (listing_id, tenant_user_id, landlord_user_id)
);

create table public.conversation_participants (
  conversation_id uuid not null,
  user_id uuid not null,
  last_read_at timestamptz,
  joined_at timestamptz not null default now(),
  constraint conversation_participants_pkey primary key (conversation_id, user_id),
  constraint conversation_participants_conversation_fk
    foreign key (conversation_id)
    references public.conversations (id)
    on delete cascade,
  constraint conversation_participants_user_fk
    foreign key (user_id) references public.profiles (id) on delete restrict
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  sender_user_id uuid not null,
  content text not null,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  constraint messages_conversation_fk
    foreign key (conversation_id)
    references public.conversations (id)
    on delete restrict,
  constraint messages_sender_user_fk
    foreign key (sender_user_id) references public.profiles (id) on delete restrict
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  type text not null,
  title text not null,
  message text not null,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_user_fk
    foreign key (user_id) references public.profiles (id) on delete restrict
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null,
  reported_user_id uuid,
  listing_id uuid,
  reason text not null,
  description text,
  status text not null default 'OPEN',
  resolved_by_user_id uuid,
  resolution_notes text,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint reports_reporter_user_fk
    foreign key (reporter_user_id) references public.profiles (id) on delete restrict,
  constraint reports_reported_user_fk
    foreign key (reported_user_id) references public.profiles (id) on delete restrict,
  constraint reports_listing_fk
    foreign key (listing_id) references public.listings (id) on delete restrict,
  constraint reports_resolved_by_user_fk
    foreign key (resolved_by_user_id)
    references public.profiles (id)
    on delete restrict,
  constraint reports_status_check
    check (status in ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED')),
  constraint reports_reason_check
    check (
      reason in (
        'FAKE_LISTING',
        'INCORRECT_INFORMATION',
        'PROPERTY_UNAVAILABLE',
        'DUPLICATE_LISTING',
        'SUSPICIOUS_LANDLORD',
        'SUSPICIOUS_TENANT',
        'HARASSMENT',
        'OTHER'
      )
    ),
  constraint reports_target_check
    check (reported_user_id is not null or listing_id is not null)
);

create table public.verification_records (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null,
  subject_id uuid not null,
  verification_type text not null,
  status text not null default 'PENDING',
  reviewed_by_user_id uuid,
  notes text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint verification_records_reviewed_by_user_fk
    foreign key (reviewed_by_user_id)
    references public.profiles (id)
    on delete restrict,
  constraint verification_records_subject_type_check
    check (subject_type in ('USER', 'PROPERTY')),
  constraint verification_records_verification_type_check
    check (
      verification_type in (
        'EMAIL',
        'PHONE',
        'LANDLORD_IDENTITY',
        'PROPERTY_INFORMATION',
        'PROPERTY_AUTHORITY'
      )
    ),
  constraint verification_records_status_check
    check (status in ('PENDING', 'VERIFIED', 'REJECTED', 'EXPIRED'))
);

-- subject_id is intentionally polymorphic (USER or PROPERTY). A cross-table
-- foreign key would be invalid; later service logic validates the subject.

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null,
  action text not null,
  target_type text not null,
  target_id uuid,
  reason text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_logs_admin_user_fk
    foreign key (admin_user_id) references public.profiles (id) on delete restrict
);
