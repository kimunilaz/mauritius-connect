-- TASK-031: additive property operations. No hosted reset or data rewrite.
create table public.property_operational_details (
 id uuid primary key default gen_random_uuid(), property_id uuid not null unique references public.properties(id),
 reference_name text, floor_area numeric(12,2) check(floor_area >= 0), acquisition_notes text,
 utilities_notes text, access_notes text, owner_notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1
);
create table public.tenancies (
 id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties(id),
 tenant_name text not null, tenant_contact text, tenant_user_id uuid references public.profiles(id),
 application_id uuid unique references public.applications(id), invitation_hash text,
 start_date date not null, expected_end_date date, end_date date,
 monthly_rent numeric(12,2) not null check(monthly_rent >= 0), deposit_amount numeric(12,2) check(deposit_amount >= 0),
 status text not null default 'UPCOMING' check(status in ('UPCOMING','ACTIVE','ENDING','ENDED','CANCELLED')),
 move_in_date date, move_out_date date, move_in_notes text, move_out_notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 unique(id,property_id), check(expected_end_date is null or expected_end_date >= start_date),
 check(end_date is null or end_date >= start_date), check(status <> 'ENDED' or end_date is not null)
);
create index tenancies_property_status_idx on public.tenancies(property_id,status,start_date);
create index tenancies_tenant_idx on public.tenancies(tenant_user_id,status);
create unique index tenancies_invitation_idx on public.tenancies(invitation_hash) where invitation_hash is not null;
create table public.rent_ledger_entries (
 id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties(id), tenancy_id uuid not null,
 period date not null, due_date date not null, amount_due numeric(12,2) not null check(amount_due >= 0),
 waived boolean not null default false, notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 unique(id,property_id), unique(tenancy_id,period), foreign key(tenancy_id,property_id) references public.tenancies(id,property_id),
 check(extract(day from period)=1)
);
create table public.rent_receipts (
 id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties(id), ledger_id uuid not null,
 amount numeric(12,2) not null check(amount>0), received_on date not null, reference text, request_key uuid not null unique,
 recorded_by uuid not null references public.profiles(id), created_at timestamptz not null default now(),
 foreign key(ledger_id,property_id) references public.rent_ledger_entries(id,property_id)
);
create table public.maintenance_requests (
 id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties(id), tenancy_id uuid,
 submitted_by uuid not null references public.profiles(id), title text not null, description text not null,
 category text not null default 'OTHER', priority text not null default 'NORMAL' check(priority in ('LOW','NORMAL','HIGH','URGENT')),
 status text not null default 'NEW' check(status in ('NEW','ACKNOWLEDGED','SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED')),
 scheduled_date date, completed_at timestamptz, estimated_cost numeric(12,2) check(estimated_cost>=0), actual_cost numeric(12,2) check(actual_cost>=0),
 owner_notes text, vendor_name text, vendor_contact text, service_type text, owner_update text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 unique(id,property_id), foreign key(tenancy_id,property_id) references public.tenancies(id,property_id)
);
create table public.maintenance_updates (
 id uuid primary key default gen_random_uuid(), maintenance_id uuid not null references public.maintenance_requests(id),
 status text not null, message text, created_at timestamptz not null default now()
);
create table public.property_inspections (
 id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties(id), tenancy_id uuid,
 inspection_date date not null, type text not null check(type in ('MOVE_IN','MOVE_OUT','ROUTINE','OWNER','OTHER')),
 status text not null default 'SCHEDULED' check(status in ('SCHEDULED','COMPLETED','CANCELLED')),
 notes text, condition_notes text, meter_notes text, access_notes text, next_inspection_date date,
 checklist jsonb not null default '[]' check(jsonb_typeof(checklist)='array' and jsonb_array_length(checklist)<=30),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 unique(id,property_id), foreign key(tenancy_id,property_id) references public.tenancies(id,property_id)
);
create table public.property_documents (
 id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties(id), tenancy_id uuid,
 maintenance_id uuid, inspection_id uuid, shared_tenancy_id uuid,
 category text not null check(category in ('OWNERSHIP','LEASE','INSPECTION','MAINTENANCE','INSURANCE','RECEIPT','UTILITY','OTHER')),
 filename text not null, description text, storage_path text not null unique, mime_type text not null, size_bytes integer not null check(size_bytes>0 and size_bytes<=10485760),
 uploaded_by uuid not null references public.profiles(id), archived_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 unique(id,property_id), foreign key(tenancy_id,property_id) references public.tenancies(id,property_id),
 foreign key(shared_tenancy_id,property_id) references public.tenancies(id,property_id),
 foreign key(maintenance_id,property_id) references public.maintenance_requests(id,property_id),
 foreign key(inspection_id,property_id) references public.property_inspections(id,property_id)
);
create table public.property_financial_records (
 id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties(id), tenancy_id uuid,
 kind text not null check(kind in ('INCOME','EXPENSE')), category text not null,
 amount numeric(12,2) not null check(amount>0), record_date date not null, description text, vendor text,
 document_id uuid, maintenance_id uuid unique, voided boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 foreign key(tenancy_id,property_id) references public.tenancies(id,property_id),
 foreign key(document_id,property_id) references public.property_documents(id,property_id),
 foreign key(maintenance_id,property_id) references public.maintenance_requests(id,property_id)
);
create table public.property_tasks (
 id uuid primary key default gen_random_uuid(), property_id uuid not null references public.properties(id), tenancy_id uuid,
 title text not null, due_date date not null, status text not null default 'OPEN' check(status in ('OPEN','COMPLETED','CANCELLED')), notes text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), version integer not null default 1,
 foreign key(tenancy_id,property_id) references public.tenancies(id,property_id)
);
alter table public.property_operational_details enable row level security;
revoke all on public.property_operational_details from anon, authenticated;
grant all on public.property_operational_details to service_role;
create index property_operational_details_property_updated_idx on public.property_operational_details(property_id,updated_at desc,id);
alter table public.tenancies enable row level security;
revoke all on public.tenancies from anon, authenticated;
grant all on public.tenancies to service_role;
create index tenancies_property_updated_idx on public.tenancies(property_id,updated_at desc,id);
alter table public.rent_ledger_entries enable row level security;
revoke all on public.rent_ledger_entries from anon, authenticated;
grant all on public.rent_ledger_entries to service_role;
create index rent_ledger_entries_property_updated_idx on public.rent_ledger_entries(property_id,updated_at desc,id);
alter table public.rent_receipts enable row level security;
revoke all on public.rent_receipts from anon, authenticated;
grant all on public.rent_receipts to service_role;
alter table public.maintenance_requests enable row level security;
revoke all on public.maintenance_requests from anon, authenticated;
grant all on public.maintenance_requests to service_role;
create index maintenance_requests_property_updated_idx on public.maintenance_requests(property_id,updated_at desc,id);
alter table public.maintenance_updates enable row level security;
revoke all on public.maintenance_updates from anon, authenticated;
grant all on public.maintenance_updates to service_role;
alter table public.property_inspections enable row level security;
revoke all on public.property_inspections from anon, authenticated;
grant all on public.property_inspections to service_role;
create index property_inspections_property_updated_idx on public.property_inspections(property_id,updated_at desc,id);
alter table public.property_documents enable row level security;
revoke all on public.property_documents from anon, authenticated;
grant all on public.property_documents to service_role;
create index property_documents_property_updated_idx on public.property_documents(property_id,updated_at desc,id);
alter table public.property_financial_records enable row level security;
revoke all on public.property_financial_records from anon, authenticated;
grant all on public.property_financial_records to service_role;
create index property_financial_records_property_updated_idx on public.property_financial_records(property_id,updated_at desc,id);
alter table public.property_tasks enable row level security;
revoke all on public.property_tasks from anon, authenticated;
grant all on public.property_tasks to service_role;
create index property_tasks_property_updated_idx on public.property_tasks(property_id,updated_at desc,id);

-- Property lock serializes tenancy creation against occupancy changes and archive.
create function public.guard_operational_record() returns trigger language plpgsql set search_path='' as $$
declare v_other uuid; v_start date; v_end date; v_user uuid;
begin
 perform 1 from public.properties where id=new.property_id and archived_at is null for update;
 if not found then raise exception 'PROPERTY_ARCHIVED'; end if;
 if TG_OP='UPDATE' then
  if new.property_id<>old.property_id then raise exception 'IMMUTABLE_PROPERTY'; end if;
  new.version=old.version+1; new.updated_at=now();
 end if;
 if TG_TABLE_NAME='tenancies' then
  if new.status in ('ACTIVE','ENDING') and new.start_date > current_date then raise exception 'FUTURE_TENANCY'; end if;
  if new.status='UPCOMING' and new.start_date < current_date then raise exception 'PAST_UPCOMING_TENANCY'; end if;
  if TG_OP='UPDATE' and old.status in ('ENDED','CANCELLED') and new.status<>old.status then raise exception 'TERMINAL_TENANCY'; end if;
  if new.status not in ('ENDED','CANCELLED') and exists(
   select 1 from public.tenancies t where t.property_id=new.property_id and t.id<>new.id
    and t.status not in ('ENDED','CANCELLED')
    and daterange(t.start_date, coalesce(t.end_date,t.expected_end_date),'[]') && daterange(new.start_date,coalesce(new.end_date,new.expected_end_date),'[]')
  ) then raise exception 'OVERLAPPING_TENANCY'; end if;
  if new.application_id is not null then
   select tp.user_id into v_user from public.applications a join public.listings l on l.id=a.listing_id join public.tenant_profiles tp on tp.id=a.tenant_id
    where a.id=new.application_id and a.status='ACCEPTED' and l.property_id=new.property_id and l.status='RENTED';
   if v_user is null then raise exception 'APPLICATION_NOT_ACCEPTED'; end if;
   new.tenant_user_id=v_user;
  end if;
  if new.tenant_user_id is not null and (TG_OP='INSERT' or new.tenant_user_id is distinct from old.tenant_user_id) and not exists(select 1 from public.profiles where id=new.tenant_user_id and role='TENANT' and account_status='ACTIVE') then raise exception 'INVALID_TENANT'; end if;

 elsif TG_TABLE_NAME='rent_ledger_entries' then
  select start_date,coalesce(end_date,expected_end_date) into v_start,v_end from public.tenancies
    where id=new.tenancy_id and property_id=new.property_id and status in ('ACTIVE','ENDING','UPCOMING');
  if not found then raise exception 'TENANCY_NOT_ACTIVE'; end if;
  if new.due_date < v_start or (v_end is not null and new.due_date>v_end) then raise exception 'OUTSIDE_TENANCY'; end if;
  if TG_OP='UPDATE' and exists(select 1 from public.rent_receipts where ledger_id=new.id) and
    (new.amount_due<>old.amount_due or new.waived<>old.waived or new.tenancy_id<>old.tenancy_id or new.period<>old.period) then raise exception 'RENT_ALREADY_RECORDED'; end if;
 elsif TG_TABLE_NAME='maintenance_requests' then
  if TG_OP='UPDATE' and old.status in ('COMPLETED','CANCELLED') and new.status<>old.status then raise exception 'TERMINAL_MAINTENANCE'; end if;
  if new.status='SCHEDULED' and new.scheduled_date is null then raise exception 'SCHEDULE_REQUIRED'; end if;
  if new.status='COMPLETED' then new.completed_at=coalesce(new.completed_at,now()); end if;
 end if;
 return new;
end; $$;
create trigger property_operational_details_guard before insert or update on public.property_operational_details for each row execute function public.guard_operational_record();
create trigger tenancies_guard before insert or update on public.tenancies for each row execute function public.guard_operational_record();
create trigger rent_ledger_entries_guard before insert or update on public.rent_ledger_entries for each row execute function public.guard_operational_record();
create trigger maintenance_requests_guard before insert or update on public.maintenance_requests for each row execute function public.guard_operational_record();
create trigger property_inspections_guard before insert or update on public.property_inspections for each row execute function public.guard_operational_record();
create trigger property_documents_guard before insert or update on public.property_documents for each row execute function public.guard_operational_record();
create trigger property_financial_records_guard before insert or update on public.property_financial_records for each row execute function public.guard_operational_record();
create trigger property_tasks_guard before insert or update on public.property_tasks for each row execute function public.guard_operational_record();

create function public.guard_occupied_archive() returns trigger language plpgsql set search_path='' as $$
begin
 if new.archived_at is not null and old.archived_at is null and exists(select 1 from public.tenancies where property_id=new.id and status not in ('ENDED','CANCELLED')) then raise exception 'PROPERTY_HAS_TENANCY'; end if;
 return new;
end; $$;
create trigger properties_occupied_archive before update on public.properties for each row execute function public.guard_occupied_archive();

create function public.record_rent_receipt(p_actor uuid,p_ledger uuid,p_amount numeric,p_received date,p_reference text,p_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_entry public.rent_ledger_entries; v_receipt public.rent_receipts; v_paid numeric;
begin
 select e.* into v_entry from public.rent_ledger_entries e join public.properties p on p.id=e.property_id
 join public.landlord_profiles lp on lp.id=p.landlord_id join public.profiles actor on actor.id=lp.user_id
 where e.id=p_ledger and p.archived_at is null and actor.id=p_actor and actor.role='LANDLORD' and actor.account_status='ACTIVE' for update of e;
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
revoke all on function public.record_rent_receipt(uuid,uuid,numeric,date,text,uuid) from public,anon,authenticated;
grant execute on function public.record_rent_receipt(uuid,uuid,numeric,date,text,uuid) to service_role;

create function public.claim_tenancy(p_actor uuid,p_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
 if not exists(select 1 from public.profiles where id=p_actor and role='TENANT' and account_status='ACTIVE') then raise exception 'OPERATION_NOT_FOUND'; end if;
 select id into v_id from public.tenancies where invitation_hash=p_hash and tenant_user_id is null
 and status in ('UPCOMING','ACTIVE','ENDING') and (end_date is null or end_date>=current_date) and (expected_end_date is null or expected_end_date>=current_date) for update;
 if v_id is null then raise exception 'OPERATION_NOT_FOUND'; end if;
 update public.tenancies set tenant_user_id=p_actor,invitation_hash=null where id=v_id;
 return v_id;
end; $$;
revoke all on function public.claim_tenancy(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_tenancy(uuid,text) to service_role;

create function public.track_maintenance_update() returns trigger language plpgsql security definer set search_path='' as $$
declare v_owner uuid; v_tenant uuid; v_event uuid;
begin
 if TG_OP='INSERT' or new.status is distinct from old.status or new.owner_update is distinct from old.owner_update then
 insert into public.maintenance_updates(maintenance_id,status,message) values(new.id,new.status,new.owner_update) returning id into v_event;
 select lp.user_id into v_owner from public.properties p join public.landlord_profiles lp on lp.id=p.landlord_id where p.id=new.property_id;
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
create trigger maintenance_history after insert or update on public.maintenance_requests for each row execute function public.track_maintenance_update();
revoke all on function public.track_maintenance_update() from public,anon,authenticated;

create unique index one_current_tenancy_per_property on public.tenancies(property_id) where status in ('ACTIVE','ENDING');

create index rent_receipts_ledger_date_idx on public.rent_receipts(ledger_id,received_on,id);
create index rent_receipts_property_date_idx on public.rent_receipts(property_id,received_on);
create index maintenance_updates_request_date_idx on public.maintenance_updates(maintenance_id,created_at desc);
create index property_documents_shared_tenancy_idx on public.property_documents(shared_tenancy_id,created_at desc) where archived_at is null;
create index property_financial_records_date_idx on public.property_financial_records(property_id,record_date) where not voided;
