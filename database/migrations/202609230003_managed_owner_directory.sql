-- Private owner directory with portfolio and record-based rent totals, before pagination.
create function public.managed_owner_directory(p_manager uuid,p_page integer default 1,p_limit integer default 20,p_search text default null,p_archived boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if p_page<1 or p_limit<1 or p_limit>100 then raise exception 'INVALID_FILTER'; end if;
 if not exists(select 1 from public.property_manager_profiles m join public.profiles u on u.id=m.user_id where m.id=p_manager and u.role='AGENT' and u.account_status='ACTIVE') then raise exception 'OWNER_NOT_FOUND'; end if;
 return (with owners as materialized(select o.* from public.managed_property_owners o where o.property_manager_id=p_manager and (o.archived_at is not null)=p_archived and (p_search is null or o.name ilike '%'||p_search||'%' or o.company ilike '%'||p_search||'%')),
 page as(select * from owners order by name,id limit p_limit offset (p_page-1)*p_limit),
 properties as materialized(select p.id,p.managed_owner_id,exists(select 1 from public.tenancies t where t.property_id=p.id and t.status in ('ACTIVE','ENDING') and t.start_date<=current_date and coalesce(t.end_date,t.expected_end_date,'infinity'::date)>=current_date) occupied from public.properties p join page o on o.id=p.managed_owner_id where p.archived_at is null and p.property_manager_id=p_manager)
 select jsonb_build_object('total',(select count(*) from owners),'items',coalesce((select jsonb_agg(to_jsonb(o)-'property_manager_id'||jsonb_build_object('property_count',(select count(*) from properties p where p.managed_owner_id=o.id),'occupied',(select count(*) from properties p where p.managed_owner_id=o.id and occupied),'vacant',(select count(*) from properties p where p.managed_owner_id=o.id and not occupied),'outstanding',coalesce((select sum(greatest(e.amount_due-coalesce((select sum(r.amount) from public.rent_receipts r where r.ledger_id=e.id),0),0)) from public.rent_ledger_entries e join properties p on p.id=e.property_id where p.managed_owner_id=o.id and not e.waived),0))) from page o),'[]'::jsonb)));
end; $$;
revoke all on function public.managed_owner_directory(uuid,integer,integer,text,boolean) from public,anon,authenticated;
grant execute on function public.managed_owner_directory(uuid,integer,integer,text,boolean) to service_role;
