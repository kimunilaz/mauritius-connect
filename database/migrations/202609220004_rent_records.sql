-- Aggregate before pagination: receipt counts never truncate financial totals.
create function public.operations_rent_records(p_actor uuid,p_property uuid default null,p_tenancy uuid default null,p_id uuid default null,p_status text default null,p_from date default null,p_to date default null,p_page integer default 1,p_limit integer default 20)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if p_page<1 or p_limit<1 or p_limit>100 then raise exception 'INVALID_FILTER'; end if;
 with scoped as materialized (
 select e.*,p.locality,coalesce((select sum(r.amount) from public.rent_receipts r where r.ledger_id=e.id),0) amount_paid
 from public.rent_ledger_entries e join public.properties p on p.id=e.property_id
 join public.landlord_profiles lp on lp.id=p.landlord_id join public.tenancies t on t.id=e.tenancy_id
 join public.profiles actor on actor.id=p_actor and actor.account_status='ACTIVE'
 where ((actor.role='LANDLORD' and lp.user_id=p_actor) or (actor.role='TENANT' and t.tenant_user_id=p_actor
 and t.status in ('ACTIVE','UPCOMING','ENDING') and (t.end_date is null or t.end_date>=current_date) and (t.expected_end_date is null or t.expected_end_date>=current_date)))
 and (p_property is null or e.property_id=p_property) and (p_tenancy is null or e.tenancy_id=p_tenancy) and (p_id is null or e.id=p_id)
 and (p_from is null or e.due_date>=p_from) and (p_to is null or e.due_date<=p_to)
 ), derived as (
 select s.*,case when waived then 0 else greatest(amount_due-amount_paid,0) end outstanding,
 case when waived then 'WAIVED' when amount_paid>=amount_due then 'PAID' when due_date<current_date then 'OVERDUE' when amount_paid>0 then 'PARTIALLY_PAID' when due_date=current_date then 'DUE' else 'UPCOMING' end rent_status from scoped s
 ), filtered as materialized(select * from derived where p_status is null or rent_status=p_status)
 select jsonb_build_object('total',(select count(*) from filtered),'items',coalesce((select jsonb_agg(to_jsonb(x)-'locality'||jsonb_build_object('property',jsonb_build_object('locality',x.locality),'receipts',coalesce((select jsonb_agg(r) from (select id,ledger_id,amount,received_on,created_at from public.rent_receipts where ledger_id=x.id order by received_on desc,id limit 100) r),'[]'::jsonb))) from (select * from filtered order by due_date desc,id limit p_limit offset (p_page-1)*p_limit)x),'[]'::jsonb)) into result;
 return result;
end; $$;
revoke all on function public.operations_rent_records(uuid,uuid,uuid,uuid,text,date,date,integer,integer) from public,anon,authenticated;
grant execute on function public.operations_rent_records(uuid,uuid,uuid,uuid,text,date,date,integer,integer) to service_role;
