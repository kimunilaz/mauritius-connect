create table public.properties (
  id uuid primary key default gen_random_uuid(),
  landlord_id uuid not null,
  property_type text not null,
  address_line_1 text,
  address_line_2 text,
  district text not null,
  locality text not null,
  neighbourhood text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  bedrooms integer not null,
  bathrooms numeric(3, 1) not null,
  furnished boolean not null default false,
  parking_spaces integer not null default 0,
  verification_status text not null default 'UNVERIFIED',
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint properties_landlord_fk
    foreign key (landlord_id)
    references public.landlord_profiles (id)
    on delete restrict,
  constraint properties_property_type_check
    check (
      property_type in (
        'APARTMENT',
        'HOUSE',
        'STUDIO',
        'ROOM',
        'TOWNHOUSE',
        'VILLA',
        'OTHER'
      )
    ),
  constraint properties_verification_status_check
    check (verification_status in ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED')),
  constraint properties_bedrooms_check check (bedrooms >= 0),
  constraint properties_bathrooms_check check (bathrooms >= 0),
  constraint properties_parking_spaces_check check (parking_spaces >= 0),
  constraint properties_latitude_check
    check (latitude is null or latitude between -90 and 90),
  constraint properties_longitude_check
    check (longitude is null or longitude between -180 and 180)
);

create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  storage_path text not null,
  display_order integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  constraint property_images_property_fk
    foreign key (property_id) references public.properties (id) on delete restrict,
  constraint property_images_display_order_check check (display_order >= 0),
  constraint property_images_property_storage_path_key
    unique (property_id, storage_path)
);

-- A property can expose at most one cover image, while retaining any number of
-- non-cover images.
create unique index property_images_one_cover_per_property_idx
  on public.property_images (property_id)
  where is_cover = true;

create table public.listings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null,
  title text not null,
  description text not null,
  monthly_rent numeric(12, 2) not null,
  deposit_amount numeric(12, 2),
  available_from date not null,
  minimum_lease_months integer,
  maximum_occupants integer,
  pets_allowed boolean not null default false,
  status text not null default 'DRAFT',
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint listings_property_fk
    foreign key (property_id) references public.properties (id) on delete restrict,
  constraint listings_status_check
    check (status in ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PAUSED', 'RENTED', 'CLOSED')),
  constraint listings_monthly_rent_check check (monthly_rent >= 0),
  constraint listings_deposit_amount_check
    check (deposit_amount is null or deposit_amount >= 0),
  constraint listings_minimum_lease_months_check
    check (minimum_lease_months is null or minimum_lease_months > 0),
  constraint listings_maximum_occupants_check
    check (maximum_occupants is null or maximum_occupants > 0)
);

-- Live listings compete for a property; historical rental cycles do not.
create unique index listings_one_live_per_property_idx
  on public.listings (property_id)
  where status in ('PENDING_REVIEW', 'ACTIVE', 'PAUSED');

create table public.saved_listings (
  tenant_id uuid not null,
  listing_id uuid not null,
  created_at timestamptz not null default now(),
  constraint saved_listings_pkey primary key (tenant_id, listing_id),
  constraint saved_listings_tenant_fk
    foreign key (tenant_id) references public.tenant_profiles (id) on delete restrict,
  constraint saved_listings_listing_fk
    foreign key (listing_id) references public.listings (id) on delete restrict
);
