create or replace function public.emit_application_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_recipient uuid; v_type text; v_title text; v_message text;
begin
  if new.to_status='ACCEPTED' then select tenant_profiles.user_id into v_recipient from public.applications join public.tenant_profiles on tenant_profiles.id=applications.tenant_id where applications.id=new.application_id; v_type:='APPLICATION_ACCEPTED'; v_title:='Application accepted'; v_message:='Your rental application was accepted.';
  elsif new.to_status='REJECTED' then select tenant_profiles.user_id into v_recipient from public.applications join public.tenant_profiles on tenant_profiles.id=applications.tenant_id where applications.id=new.application_id; v_type:='APPLICATION_REJECTED'; v_title:='Your application was not selected'; v_message:='Your rental application was not selected.';
  else return new; end if;
  if v_recipient is not null then begin insert into public.notifications(user_id,type,title,message,entity_type,entity_id,source_event_key) values(v_recipient,v_type,v_title,v_message,'APPLICATION',new.application_id,'application_status_history:'||new.id::text); exception when unique_violation then null; end; end if; return new;
end; $$;

create or replace function public.accept_application_transaction(p_landlord uuid,p_application uuid)
returns table(outcome text,current_status text,listing_status text) language plpgsql security definer set search_path = '' as $$
declare v_app public.applications%rowtype; v_listing public.listings%rowtype; v_landlord uuid; v_now timestamptz;
begin
 select l.* into v_listing from public.listings l where l.id=(select listing_id from public.applications where id=p_application) for update;
 if not found then return query select 'NOT_FOUND',null::text,null::text; return; end if;
 select landlord_profiles.user_id into v_landlord from public.properties join public.landlord_profiles on landlord_profiles.id=properties.landlord_id where properties.id=v_listing.property_id;
 if v_landlord<>p_landlord then return query select 'NOT_FOUND',null::text,v_listing.status; return; end if;
 select * into v_app from public.applications where id=p_application for update;
 if v_app.status='ACCEPTED' then return query select 'ALREADY_TARGET','ACCEPTED',v_listing.status; return; end if;
 if v_app.status<>'VIEWING_COMPLETED' or v_listing.status in ('RENTED','CLOSED') or exists(select 1 from public.properties where id=v_listing.property_id and archived_at is not null) then return query select 'INVALID_TRANSITION',v_app.status,v_listing.status; return; end if;
 if exists(select 1 from public.applications where listing_id=v_listing.id and status='ACCEPTED') then return query select 'INVALID_TRANSITION',v_app.status,v_listing.status; return; end if;
 v_now:=clock_timestamp();
 update public.applications set status='ACCEPTED' where id=v_app.id;
 insert into public.application_status_history(application_id,from_status,to_status,changed_by_user_id,created_at) values(v_app.id,'VIEWING_COMPLETED','ACCEPTED',p_landlord,v_now);
 update public.listings set status='RENTED' where id=v_listing.id;
 for v_app in select * from public.applications where listing_id=v_listing.id and status in ('SUBMITTED','UNDER_REVIEW','SHORTLISTED','VIEWING_INVITED','VIEWING_COMPLETED') and id<>p_application for update loop
   update public.applications set status='REJECTED' where id=v_app.id;
   insert into public.application_status_history(application_id,from_status,to_status,changed_by_user_id,created_at) values(v_app.id,v_app.status,'REJECTED',p_landlord,v_now);
 end loop;
 return query select 'TRANSITIONED','ACCEPTED','RENTED';
end; $$;
revoke all on function public.accept_application_transaction(uuid,uuid) from public,anon,authenticated;
grant execute on function public.accept_application_transaction(uuid,uuid) to service_role;
