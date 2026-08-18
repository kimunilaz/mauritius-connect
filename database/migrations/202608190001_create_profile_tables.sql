-- PostgreSQL 13+ and Supabase provide gen_random_uuid() in pg_catalog, so no
-- extension is required for application-generated UUIDs.

create function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key,
  role text not null,
  first_name text not null,
  last_name text not null,
  phone text,
  profile_photo_url text,
  phone_verified boolean not null default false,
  account_status text not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_auth_user_fk
    foreign key (id) references auth.users (id) on delete restrict,
  constraint profiles_role_check
    check (role in ('TENANT', 'LANDLORD', 'ADMIN')),
  constraint profiles_account_status_check
    check (account_status in ('ACTIVE', 'SUSPENDED', 'DELETED'))
);

create table public.tenant_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  occupation_type text,
  employer_or_school text,
  income_range text,
  preferred_move_date date,
  preferred_lease_duration_months integer,
  number_of_occupants integer,
  has_pets boolean not null default false,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_profiles_user_fk
    foreign key (user_id) references public.profiles (id) on delete restrict,
  constraint tenant_profiles_preferred_lease_duration_check
    check (
      preferred_lease_duration_months is null
      or preferred_lease_duration_months > 0
    ),
  constraint tenant_profiles_number_of_occupants_check
    check (number_of_occupants is null or number_of_occupants >= 1)
);

create table public.tenant_preferred_locations (
  id uuid primary key default gen_random_uuid(),
  tenant_profile_id uuid not null,
  district text,
  locality text,
  neighbourhood text,
  created_at timestamptz not null default now(),
  constraint tenant_preferred_locations_tenant_profile_fk
    foreign key (tenant_profile_id)
    references public.tenant_profiles (id)
    on delete restrict
);

create table public.landlord_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  verification_status text not null default 'UNVERIFIED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint landlord_profiles_user_fk
    foreign key (user_id) references public.profiles (id) on delete restrict,
  constraint landlord_profiles_verification_status_check
    check (verification_status in ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED'))
);
