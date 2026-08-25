alter table public.listings add column if not exists admin_review_feedback text;
create index if not exists listings_admin_queue_idx on public.listings(status,updated_at,id);

create or replace function public.admin_review_listing_transaction(p_admin uuid,p_listing uuid,p_action text,p_reason text default null)
returns table(outcome text,listing_status text) language plpgsql security definer set search_path = '' as $$
declare v_status text; v_property uuid; v_ready boolean; v_reason text;
begin
 if not exists(select 1 from public.profiles where id=p_admin and role='ADMIN' and account_status='ACTIVE') then return query select 'FORBIDDEN',null::text; return; end if;
 select status,property_id into v_status,v_property from public.listings where id=p_listing for update;
 if v_status is null then return query select 'NOT_FOUND',null::text; return; end if;
 if p_action='APPROVE' and v_status='ACTIVE' then return query select 'ALREADY_TARGET','ACTIVE'; return; end if;
 if p_action='RETURN' and v_status='DRAFT' then return query select 'ALREADY_TARGET','DRAFT'; return; end if;
 if v_status <> 'PENDING_REVIEW' then return query select 'INVALID_TRANSITION',v_status; return; end if;
 v_reason:=nullif(left(trim(coalesce(p_reason,'')),1000),'');
 select (p.archived_at is null and l.title<>'' and l.description<>'' and l.monthly_rent>=0 and l.available_from is not null and exists(select 1 from public.property_images i where i.property_id=p.id) and exists(select 1 from public.property_images i where i.property_id=p.id and i.is_cover) and not exists(select 1 from public.listings x where x.property_id=l.property_id and x.id<>l.id and x.status in ('ACTIVE','PAUSED'))) into v_ready from public.listings l join public.properties p on p.id=l.property_id where l.id=p_listing;
 if p_action='APPROVE' then if not coalesce(v_ready,false) then return query select 'NOT_READY',v_status; return; end if; update public.listings set status='ACTIVE',published_at=coalesce(published_at,now()),admin_review_feedback=null where id=p_listing; else update public.listings set status='DRAFT',admin_review_feedback=v_reason where id=p_listing; end if;
 insert into public.admin_audit_logs(admin_user_id,action,target_type,target_id,reason,metadata) values(p_admin,case when p_action='APPROVE' then 'LISTING_APPROVED' else 'LISTING_RETURNED_TO_DRAFT' end,'LISTING',p_listing,v_reason,jsonb_build_object('from','PENDING_REVIEW','to',case when p_action='APPROVE' then 'ACTIVE' else 'DRAFT' end));
 return query select 'TRANSITIONED',case when p_action='APPROVE' then 'ACTIVE' else 'DRAFT' end;
end; $$;

create or replace function public.admin_account_state_transaction(p_admin uuid,p_user uuid,p_action text)
returns table(outcome text,account_status text) language plpgsql security definer set search_path = '' as $$
declare v_status text; v_role text;
begin
 if not exists(select 1 from public.profiles where id=p_admin and role='ADMIN' and account_status='ACTIVE') then return query select 'FORBIDDEN',null::text; return; end if;
 select account_status,role into v_status,v_role from public.profiles where id=p_user for update;
 if v_status is null then return query select 'NOT_FOUND',null::text; return; end if;
 if p_user=p_admin and p_action='SUSPEND' then return query select 'PROTECTED',v_status; return; end if;
 if v_role='ADMIN' and p_action='SUSPEND' and (select count(*) from public.profiles where role='ADMIN' and account_status='ACTIVE')<=1 then return query select 'PROTECTED',v_status; return; end if;
 if p_action='SUSPEND' and v_status='SUSPENDED' then return query select 'ALREADY_TARGET',v_status; return; end if;
 if p_action='REACTIVATE' and v_status='ACTIVE' then return query select 'ALREADY_TARGET',v_status; return; end if;
 if p_action='SUSPEND' and v_status<>'ACTIVE' then return query select 'INVALID_TRANSITION',v_status; return; end if;
 if p_action='REACTIVATE' and v_status<>'SUSPENDED' then return query select 'INVALID_TRANSITION',v_status; return; end if;
 update public.profiles set account_status=case when p_action='SUSPEND' then 'SUSPENDED' else 'ACTIVE' end where id=p_user;
 if p_action='SUSPEND' and v_role='LANDLORD' then update public.listings l set status='PAUSED' where status='ACTIVE' and exists(select 1 from public.properties p join public.landlord_profiles lp on lp.id=p.landlord_id where p.id=l.property_id and lp.user_id=p_user); end if;
 insert into public.admin_audit_logs(admin_user_id,action,target_type,target_id,metadata) values(p_admin,case when p_action='SUSPEND' then 'ACCOUNT_SUSPENDED' else 'ACCOUNT_REACTIVATED' end,'USER',p_user,jsonb_build_object('from',v_status,'to',case when p_action='SUSPEND' then 'SUSPENDED' else 'ACTIVE' end));
 return query select 'TRANSITIONED',case when p_action='SUSPEND' then 'SUSPENDED' else 'ACTIVE' end;
end; $$;
revoke all on function public.admin_review_listing_transaction(uuid,uuid,text,text) from public,anon,authenticated;
revoke all on function public.admin_account_state_transaction(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.admin_review_listing_transaction(uuid,uuid,text,text) to service_role;
grant execute on function public.admin_account_state_transaction(uuid,uuid,text) to service_role;
