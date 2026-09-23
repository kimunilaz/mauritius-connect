-- Preserve self-owner identity while introducing an authenticated manager relationship.
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('TENANT','LANDLORD','AGENT','ADMIN'));
create table public.property_manager_profiles (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null unique references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now()
);
insert into public.property_manager_profiles(id,user_id) select id,user_id from public.landlord_profiles;
create function public.sync_landlord_manager() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.property_manager_profiles(id,user_id) values(new.id,new.user_id);
 return new;
end; $$;
create trigger landlord_manager_insert after insert on public.landlord_profiles for each row execute function public.sync_landlord_manager();
create table public.managed_property_owners (
 id uuid primary key default gen_random_uuid(),
 property_manager_id uuid not null references public.property_manager_profiles(id),
 name text not null check(length(trim(name)) between 1 and 200),
 company text check(length(company)<=200), email text check(length(email)<=254),
 phone text check(length(phone)<=50), address text check(length(address)<=1000), notes text check(length(notes)<=5000),
 archived_at timestamptz, version integer not null default 1 check(version>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,property_manager_id)
);
create index managed_owners_manager_idx on public.managed_property_owners(property_manager_id,archived_at,name);
alter table public.properties add column property_manager_id uuid references public.property_manager_profiles(id);
alter table public.properties add column managed_owner_id uuid;
update public.properties set property_manager_id=landlord_id;
alter table public.properties alter column property_manager_id set not null;
alter table public.properties alter column landlord_id drop not null;
alter table public.properties add constraint property_managed_owner_fk foreign key(managed_owner_id,property_manager_id) references public.managed_property_owners(id,property_manager_id);
alter table public.properties add constraint property_owner_context_check check ((landlord_id is not null and managed_owner_id is null) or (landlord_id is null and managed_owner_id is not null));
create index properties_manager_idx on public.properties(property_manager_id);
create index properties_managed_owner_idx on public.properties(managed_owner_id) where managed_owner_id is not null;
create function public.guard_managed_owner() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.property_manager_profiles m join public.profiles u on u.id=m.user_id where m.id=new.property_manager_id and u.role='AGENT' and u.account_status='ACTIVE') then raise exception 'OWNER_NOT_FOUND'; end if;
 if tg_op='UPDATE' then
  if new.property_manager_id is distinct from old.property_manager_id or new.id is distinct from old.id then raise exception 'OWNER_MANAGER_IMMUTABLE'; end if;
  if old.archived_at is not null then raise exception 'OWNER_ARCHIVED'; end if;
  new.version:=old.version+1; new.updated_at:=now();
 end if;
 return new;
end; $$;
create trigger managed_owner_guard before insert or update on public.managed_property_owners for each row execute function public.guard_managed_owner();
create function public.guard_property_manager() returns trigger language plpgsql security definer set search_path='' as $$
declare manager_user uuid; manager_role text; self_owner uuid; owner_archived timestamptz;
begin
 if tg_op='UPDATE' and (new.property_manager_id is distinct from old.property_manager_id or new.managed_owner_id is distinct from old.managed_owner_id or new.landlord_id is distinct from old.landlord_id) then raise exception 'PROPERTY_MANAGER_IMMUTABLE'; end if;
 if tg_op='UPDATE' then return new; end if;
 new.property_manager_id:=coalesce(new.property_manager_id,new.landlord_id);
 select u.id,u.role into manager_user,manager_role from public.property_manager_profiles m join public.profiles u on u.id=m.user_id where m.id=new.property_manager_id and u.account_status='ACTIVE';
 if manager_role='LANDLORD' then
  select id into self_owner from public.landlord_profiles where user_id=manager_user;
  if self_owner is null or new.managed_owner_id is not null or (new.landlord_id is not null and new.landlord_id<>self_owner) then raise exception 'INVALID_PROPERTY_OWNER'; end if;
  new.landlord_id:=self_owner;
 elsif manager_role='AGENT' then
  if new.landlord_id is not null or new.managed_owner_id is null then raise exception 'MANAGED_OWNER_REQUIRED'; end if;
  select archived_at into owner_archived from public.managed_property_owners where id=new.managed_owner_id and property_manager_id=new.property_manager_id for update;
  if not found or owner_archived is not null then raise exception 'OWNER_NOT_FOUND'; end if;
 else raise exception 'PROPERTY_MANAGER_FORBIDDEN'; end if;
 return new;
end; $$;
create trigger property_manager_guard before insert or update on public.properties for each row execute function public.guard_property_manager();
alter table public.property_manager_profiles enable row level security;
alter table public.managed_property_owners enable row level security;
revoke all on public.property_manager_profiles,public.managed_property_owners from public,anon,authenticated;
grant all on public.property_manager_profiles,public.managed_property_owners to service_role;
revoke all on function public.sync_landlord_manager(),public.guard_managed_owner(),public.guard_property_manager() from public,anon,authenticated;
