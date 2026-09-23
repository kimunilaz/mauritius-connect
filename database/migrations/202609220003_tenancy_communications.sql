-- Reuse the existing conversation/message engine for ongoing tenancies.
alter table public.conversations alter column listing_id drop not null;
alter table public.conversations add column tenancy_id uuid references public.tenancies(id);
alter table public.conversations add constraint conversations_context_check check(num_nonnulls(listing_id,tenancy_id)=1);
create unique index conversations_tenancy_idx on public.conversations(tenancy_id) where tenancy_id is not null;
create function public.tenancy_conversation(p_actor uuid,p_tenancy uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare v_t public.tenancies; v_owner uuid; v_id uuid;
begin
 select * into v_t from public.tenancies where id=p_tenancy and status in ('ACTIVE','UPCOMING','ENDING') and (end_date is null or end_date>=current_date) and (expected_end_date is null or expected_end_date>=current_date) for update;
 if not found or v_t.tenant_user_id is null then raise exception 'OPERATION_NOT_FOUND'; end if;
 select lp.user_id into v_owner from public.properties p join public.landlord_profiles lp on lp.id=p.landlord_id where p.id=v_t.property_id;
 if p_actor not in(v_owner,v_t.tenant_user_id) or not exists(select 1 from public.profiles where id=p_actor and account_status='ACTIVE') then raise exception 'OPERATION_NOT_FOUND'; end if;
 insert into public.conversations(tenancy_id,tenant_user_id,landlord_user_id) values(v_t.id,v_t.tenant_user_id,v_owner)
 on conflict(tenancy_id) where tenancy_id is not null do update set tenancy_id=excluded.tenancy_id returning id into v_id;
 insert into public.conversation_participants(conversation_id,user_id) values(v_id,v_owner),(v_id,v_t.tenant_user_id) on conflict do nothing;
 return v_id;
end; $$;
revoke all on function public.tenancy_conversation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.tenancy_conversation(uuid,uuid) to service_role;
-- Recheck tenancy authorization at commit, not just before file processing/API writes.
create function public.guard_tenant_maintenance() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.properties p join public.landlord_profiles lp on lp.id=p.landlord_id where p.id=new.property_id and lp.user_id=new.submitted_by) then
 perform 1 from public.tenancies t join public.profiles actor on actor.id=t.tenant_user_id
 where t.id=new.tenancy_id and t.property_id=new.property_id and t.tenant_user_id=new.submitted_by
 and t.status in ('ACTIVE','ENDING') and t.start_date<=current_date and (t.end_date is null or t.end_date>=current_date) and (t.expected_end_date is null or t.expected_end_date>=current_date) and actor.account_status='ACTIVE' for share of t;
 if not found then raise exception 'OPERATION_NOT_FOUND'; end if;
 end if;return new;
end; $$;
create trigger tenant_maintenance_access before insert on public.maintenance_requests for each row execute function public.guard_tenant_maintenance();
create function public.guard_tenant_document() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.properties p join public.landlord_profiles lp on lp.id=p.landlord_id where p.id=new.property_id and lp.user_id=new.uploaded_by) then
 perform 1 from public.tenancies t join public.maintenance_requests m on m.tenancy_id=t.id join public.profiles actor on actor.id=t.tenant_user_id
 where t.id=new.tenancy_id and t.property_id=new.property_id and t.tenant_user_id=new.uploaded_by and m.id=new.maintenance_id
 and t.status in ('ACTIVE','ENDING') and t.start_date<=current_date and (t.end_date is null or t.end_date>=current_date) and (t.expected_end_date is null or t.expected_end_date>=current_date)
 and actor.account_status='ACTIVE' and new.shared_tenancy_id=t.id and new.category='MAINTENANCE' and new.mime_type in ('image/jpeg','image/png','image/webp') for share of t;
 if not found then raise exception 'OPERATION_NOT_FOUND'; end if;
 end if;return new;
end; $$;
create trigger tenant_document_access before insert on public.property_documents for each row execute function public.guard_tenant_document();
revoke all on function public.guard_tenant_maintenance() from public,anon,authenticated;
revoke all on function public.guard_tenant_document() from public,anon,authenticated;

-- Lock the tenancy through message insertion so ending a tenancy revokes sending.
create function public.guard_tenancy_message() returns trigger language plpgsql set search_path='' as $$
declare v_tenancy uuid;
begin
 select tenancy_id into v_tenancy from public.conversations where id=new.conversation_id;
 if v_tenancy is not null then
  perform 1 from public.tenancies t join public.conversations c on c.tenancy_id=t.id
  join public.profiles actor on actor.id=new.sender_user_id
  where t.id=v_tenancy and c.id=new.conversation_id and new.sender_user_id in(c.landlord_user_id,t.tenant_user_id)
  and actor.account_status='ACTIVE' and t.status in ('ACTIVE','UPCOMING','ENDING')
  and (t.end_date is null or t.end_date>=current_date) and (t.expected_end_date is null or t.expected_end_date>=current_date) for share of t;
  if not found then raise exception 'OPERATION_NOT_FOUND'; end if;
 end if;
 return new;
end; $$;
create trigger tenancy_message_access before insert on public.messages for each row execute function public.guard_tenancy_message();
revoke all on function public.guard_tenancy_message() from public,anon,authenticated;
