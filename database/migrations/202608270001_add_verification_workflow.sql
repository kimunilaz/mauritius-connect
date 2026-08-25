alter table public.verification_records
  add column if not exists evidence_count integer not null default 0,
  add column if not exists evidence_path text,
  add column if not exists evidence_filename text,
  add column if not exists evidence_mime_type text,
  add column if not exists evidence_size_bytes integer,
  add column if not exists rejection_reason text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.verification_records
  drop constraint if exists verification_records_verification_type_check;
alter table public.verification_records add constraint verification_records_verification_type_check
  check (verification_type in ('EMAIL','PHONE','LANDLORD_IDENTITY','PROPERTY_INFORMATION','PROPERTY_AUTHORITY'));
create index if not exists verification_records_status_created_at_idx on public.verification_records(status,created_at,id);
create unique index if not exists verification_records_one_active_idx on public.verification_records(subject_type,subject_id,verification_type) where status = 'PENDING';
create trigger verification_records_set_updated_at before update on public.verification_records for each row execute function public.set_updated_at();
create or replace function public.create_verification_transaction(p_landlord_user_id uuid,p_type text,p_property_id uuid default null)
returns table(outcome text,verification_id uuid) language plpgsql security definer set search_path = '' as $$
declare v_subject_type text; v_subject_id uuid; v_id uuid;
begin
 select role into strict v_subject_type from public.profiles where id=p_landlord_user_id and role='LANDLORD' and account_status='ACTIVE';
 if p_type='LANDLORD_IDENTITY' then v_subject_type:='USER'; v_subject_id:=p_landlord_user_id;
 elsif p_type='PROPERTY_AUTHORITY' then v_subject_type:='PROPERTY'; v_subject_id:=p_property_id; if not exists(select 1 from public.properties p join public.landlord_profiles l on l.id=p.landlord_id where p.id=p_property_id and l.user_id=p_landlord_user_id) then return query select 'NOT_FOUND',null::uuid; return; end if;
 else return query select 'INVALID',null::uuid; return; end if;
 select id into v_id from public.verification_records where subject_type=v_subject_type and subject_id=v_subject_id and verification_type=p_type and status='PENDING' for update;
 if v_id is not null then return query select 'EXISTING',v_id; return; end if;
 begin insert into public.verification_records(subject_type,subject_id,verification_type,status) values(v_subject_type,v_subject_id,p_type,'PENDING') returning id into v_id; exception when unique_violation then select id into v_id from public.verification_records where subject_type=v_subject_type and subject_id=v_subject_id and verification_type=p_type and status='PENDING'; return query select 'EXISTING',v_id; return; end;
 return query select 'CREATED',v_id;
end; $$;

create or replace function public.moderate_verification_transaction(p_admin_user_id uuid,p_verification_id uuid,p_status text,p_reason text default null)
returns table(outcome text,verification_status text) language plpgsql security definer set search_path = '' as $$
declare v_old text; v_reason text;
begin
 if not exists(select 1 from public.profiles where id=p_admin_user_id and role='ADMIN' and account_status='ACTIVE') then return query select 'FORBIDDEN',null::text; return; end if;
 select status into v_old from public.verification_records where id=p_verification_id for update;
 if v_old is null then return query select 'NOT_FOUND',null::text; return; end if;
 if v_old=p_status then return query select 'ALREADY_TARGET',v_old; return; end if;
 if v_old <> 'PENDING' or p_status not in ('VERIFIED','REJECTED') then return query select 'INVALID_TRANSITION',v_old; return; end if;
 v_reason:=nullif(left(trim(coalesce(p_reason,'')),1000),'');
 update public.verification_records set status=p_status,reviewed_by_user_id=p_admin_user_id,reviewed_at=now(),rejection_reason=case when p_status='REJECTED' then v_reason else null end where id=p_verification_id;
 insert into public.admin_audit_logs(admin_user_id,action,target_type,target_id,reason,metadata) values(p_admin_user_id,case when p_status='VERIFIED' then 'VERIFICATION_APPROVED' else 'VERIFICATION_REJECTED' end,'VERIFICATION',p_verification_id,v_reason,jsonb_build_object('from',v_old,'to',p_status));
 return query select 'TRANSITIONED',p_status;
end; $$;
revoke all on function public.create_verification_transaction(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.moderate_verification_transaction(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.create_verification_transaction(uuid,text,uuid) to service_role;
grant execute on function public.moderate_verification_transaction(uuid,uuid,text,text) to service_role;
