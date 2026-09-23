-- Bounded owner summary, portfolio and record-based reports.
create function public.owner_operations_summary(p_actor uuid,p_property uuid default null,p_from date default current_date,p_to date default current_date,p_page integer default 1,p_limit integer default 20,p_occupancy text default null,p_location text default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not exists(select 1 from public.profiles where id=p_actor and role='LANDLORD' and account_status='ACTIVE') then raise exception 'OPERATION_NOT_FOUND'; end if;
 if p_limit<1 or p_limit>100 or p_page<1 or p_from>p_to then raise exception 'INVALID_FILTER'; end if;
 with owned as materialized (
 select p.*,d.reference_name,d.floor_area from public.properties p join public.landlord_profiles lp on lp.id=p.landlord_id
 left join public.property_operational_details d on d.property_id=p.id where lp.user_id=p_actor and (p_property is null or p.id=p_property)
 ), tenancies as materialized (select t.* from public.tenancies t join owned p on p.id=t.property_id),
 ledger as materialized (
 select e.*,coalesce((select sum(r.amount) from public.rent_receipts r where r.ledger_id=e.id),0) paid
 from public.rent_ledger_entries e join owned p on p.id=e.property_id
 ), maintenance as materialized(select m.* from public.maintenance_requests m join owned p on p.id=m.property_id),
 financial as materialized(select f.* from public.property_financial_records f join owned p on p.id=f.property_id where not f.voided and f.record_date between p_from and p_to),
 receipts as materialized(select r.* from public.rent_receipts r join owned p on p.id=r.property_id where r.received_on between p_from and p_to),
 portfolio as materialized (
 select p.id,coalesce(p.reference_name,p.address_line_1,p.property_type||' in '||p.locality) name,p.locality,p.property_type,p.archived_at,
 (select storage_path from public.property_images i where i.property_id=p.id and i.is_cover limit 1) cover_path,
 case when p.archived_at is not null then 'INACTIVE' when t.id is not null then case when t.status='ENDING' then 'NOTICE_GIVEN' else 'OCCUPIED' end else 'VACANT' end occupancy,
 t.id tenancy_id,t.tenant_name,t.monthly_rent,t.start_date,t.expected_end_date,t.deposit_amount,
 (select l.status from public.listings l where l.property_id=p.id order by case when l.status in ('ACTIVE','PENDING_REVIEW','PAUSED') then 0 else 1 end,l.created_at desc limit 1) listing_status,
 (select count(*) from maintenance m where m.property_id=p.id and m.status not in ('COMPLETED','CANCELLED')) open_maintenance
 from owned p left join lateral(select * from tenancies t where t.property_id=p.id and t.status in ('ACTIVE','ENDING') and t.start_date<=current_date and (t.end_date is null or t.end_date>=current_date) and (t.expected_end_date is null or t.expected_end_date>=current_date) order by t.start_date desc limit 1)t on true
 ), attention as (
 select e.id,e.property_id,'Rent overdue' title,e.due_date date,'rent' domain,1 urgency from ledger e where not e.waived and e.paid<e.amount_due and e.due_date<current_date
 union all select m.id,m.property_id,m.title,coalesce(m.scheduled_date,m.created_at::date),'maintenance',case when m.priority='URGENT' then 0 else 2 end from maintenance m where m.status not in ('COMPLETED','CANCELLED')
 union all select t.id,t.property_id,t.title,t.due_date,'tasks',3 from public.property_tasks t join owned p on p.id=t.property_id where t.status='OPEN'
 union all select i.id,i.property_id,'Inspection: '||lower(replace(i.type,'_',' ')),i.inspection_date,'inspections',3 from public.property_inspections i join owned p on p.id=i.property_id where i.status='SCHEDULED'
 union all select t.id,t.property_id,'Tenancy ending',t.expected_end_date,'tenancies',2 from tenancies t where t.status in ('ACTIVE','ENDING','UPCOMING') and t.expected_end_date<=current_date+30
 union all select a.id,l.property_id,'Application awaiting review',a.submitted_at::date,'applications',3 from public.applications a join public.listings l on l.id=a.listing_id join owned p on p.id=l.property_id where a.status in ('SUBMITTED','UNDER_REVIEW')
 union all select v.id,l.property_id,'Upcoming viewing',v.start_time::date,'viewings',3 from public.viewings v join public.applications a on a.id=v.application_id join public.listings l on l.id=a.listing_id join owned p on p.id=l.property_id where v.status in ('PROPOSED','CONFIRMED') and v.start_time>=now()
 ), activity as (
 select p.id,p.id property_id,'Property added' title,p.created_at occurred_at from owned p
 union all select t.id,t.property_id,'Tenancy: '||lower(t.status),t.updated_at from tenancies t
 union all select r.id,r.property_id,'Offline rent recorded',r.created_at from public.rent_receipts r join owned p on p.id=r.property_id
 union all select u.id,m.property_id,'Maintenance '||lower(u.status)||': '||m.title,u.created_at from public.maintenance_updates u join maintenance m on m.id=u.maintenance_id
 union all select i.id,i.property_id,'Inspection: '||lower(i.status),i.updated_at from public.property_inspections i join owned p on p.id=i.property_id
 union all select d.id,d.property_id,'Document: '||d.filename,d.created_at from public.property_documents d join owned p on p.id=d.property_id
 union all select f.id,f.property_id,'Financial record: '||lower(f.kind),f.updated_at from public.property_financial_records f join owned p on p.id=f.property_id
 union all select l.id,l.property_id,'Listing: '||lower(l.status),l.updated_at from public.listings l join owned p on p.id=l.property_id
 union all select a.id,l.property_id,'Application: '||lower(a.status),a.updated_at from public.applications a join public.listings l on l.id=a.listing_id join owned p on p.id=l.property_id where a.status<>'DRAFT'
 union all select v.id,l.property_id,'Viewing: '||lower(v.status),v.updated_at from public.viewings v join public.applications a on a.id=v.application_id join public.listings l on l.id=a.listing_id join owned p on p.id=l.property_id
 ) select jsonb_build_object(
 'period',jsonb_build_object('from',p_from,'to',p_to),
 'totals',jsonb_build_object('properties',(select count(*) from portfolio where archived_at is null),'occupied',(select count(*) from portfolio where occupancy in ('OCCUPIED','NOTICE_GIVEN')),'vacant',(select count(*) from portfolio where occupancy='VACANT'),'advertised',(select count(distinct l.property_id) from public.listings l join owned p on p.id=l.property_id where l.status='ACTIVE'),'applications',(select count(*) from public.applications a join public.listings l on l.id=a.listing_id join owned p on p.id=l.property_id where a.status in ('SUBMITTED','UNDER_REVIEW')),'unread_messages',(select count(*) from public.messages m join public.conversation_participants cp on cp.conversation_id=m.conversation_id join public.conversations c on c.id=m.conversation_id left join public.tenancies ct on ct.id=c.tenancy_id left join public.listings cl on cl.id=c.listing_id where cp.user_id=p_actor and (p_property is null or coalesce(ct.property_id,cl.property_id)=p_property) and m.sender_user_id<>p_actor and m.created_at>coalesce(cp.last_read_at,'1970-01-01'::timestamptz)),'maintenance',(select count(*) from maintenance where status not in ('COMPLETED','CANCELLED')),'overdue',(select count(*) from ledger where not waived and due_date<current_date and paid<amount_due)),
 'finances',jsonb_build_object('expected',coalesce((select sum(amount_due) from ledger where not waived and due_date between p_from and p_to),0),'received',coalesce((select sum(amount) from receipts),0),'outstanding',coalesce((select sum(greatest(amount_due-paid,0)) from ledger where not waived and due_date between p_from and p_to),0),'overdue',coalesce((select sum(greatest(amount_due-paid,0)) from ledger where not waived and due_date<current_date and due_date between p_from and p_to),0),'income',coalesce((select sum(amount) from financial where kind='INCOME'),0)+coalesce((select sum(amount) from receipts),0),'expenses',coalesce((select sum(amount) from financial where kind='EXPENSE'),0),'maintenance_cost',coalesce((select sum(amount) from financial where kind='EXPENSE' and category='MAINTENANCE'),0)),
 'portfolio',coalesce((select jsonb_agg(x) from (select * from portfolio where (p_occupancy is null or occupancy=p_occupancy) and (p_location is null or locality ilike '%'||p_location||'%') order by name,id limit p_limit offset (p_page-1)*p_limit)x),'[]'::jsonb),
 'total_properties',(select count(*) from portfolio where (p_occupancy is null or occupancy=p_occupancy) and (p_location is null or locality ilike '%'||p_location||'%')),
 'attention',coalesce((select jsonb_agg(x) from (select a.*,p.name property_name from attention a join portfolio p on p.id=a.property_id where date<=current_date+30 order by urgency,date,id limit 12)x),'[]'::jsonb),
 'upcoming',coalesce((select jsonb_agg(x) from (select a.*,p.name property_name from attention a join portfolio p on p.id=a.property_id where date>=current_date order by date,id limit 12)x),'[]'::jsonb),
 'activity',coalesce((select jsonb_agg(x) from (select * from activity where occurred_at::date between p_from and p_to order by occurred_at desc,id limit 30)x),'[]'::jsonb),
 'total_tenancies',(select count(*) from tenancies where start_date<=p_to and coalesce(end_date,expected_end_date,'infinity'::date)>=p_from),
 'tenancy_history',coalesce((select jsonb_agg(x) from (select id,property_id,tenant_name,start_date,expected_end_date,end_date,status,monthly_rent from tenancies where start_date<=p_to and coalesce(end_date,expected_end_date,'infinity'::date)>=p_from order by start_date desc,id limit p_limit offset (p_page-1)*p_limit)x),'[]'::jsonb)
 ) into result;
 return result;
end; $$;
revoke all on function public.owner_operations_summary(uuid,uuid,date,date,integer,integer,text,text) from public,anon,authenticated;
grant execute on function public.owner_operations_summary(uuid,uuid,date,date,integer,integer,text,text) to service_role;
revoke all on function public.guard_operational_record() from public,anon,authenticated;
revoke all on function public.guard_occupied_archive() from public,anon,authenticated;
