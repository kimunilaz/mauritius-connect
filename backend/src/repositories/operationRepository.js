import { getPrivilegedSupabaseClient } from '../config/supabase.js';
import {
  operationTables,
  operationFields,
} from '../validators/operationValidators.js';
import { AppError } from '../middleware/AppError.js';
const owner =
  'property:properties!inner(id,locality,property_type,address_line_1,archived_at,landlord:property_manager_profiles!inner(user_id))';
function failure(error) {
  const message = error?.message ?? '';
  const conflict =
    /INVALID_TENANT|APPLICATION_NOT_ACCEPTED|OVERLAPPING|TERMINAL|FUTURE_TENANCY|PAST_UPCOMING|OUTSIDE_TENANCY|RENT_ALREADY|INVALID_RECEIPT|SCHEDULE_REQUIRED|TENANCY_NOT_ACTIVE|IDEMPOTENCY|PROPERTY_ARCHIVED/.test(
      message,
    ) || error?.code === '23505';
  throw new AppError({
    statusCode: conflict
      ? 409
      : /NOT_FOUND/.test(message)
        ? 404
        : ['23503', '23514', '22000', '22007'].includes(error?.code)
          ? 422
          : 500,
    code: conflict
      ? 'OPERATION_CONFLICT'
      : /NOT_FOUND/.test(message)
        ? 'OPERATION_NOT_FOUND'
        : 'OPERATION_FAILED',
    message: conflict
      ? 'This conflicts with the current property record. Refresh and check dates, amounts and status.'
      : /NOT_FOUND/.test(message)
        ? 'Record not found.'
        : 'Unable to load or save the property record.',
  });
}
export function createOperationRepository(
  client = getPrivilegedSupabaseClient,
) {
  const columns = (domain) =>
    [
      'id',
      'property_id',
      ...Object.keys(operationFields[domain]),
      'created_at',
      'updated_at',
      'version',
      ...(domain === 'tenancies' ? ['tenant_user_id'] : []),
      ...(domain === 'maintenance' ? ['submitted_by', 'completed_at'] : []),
      ...(domain === 'documents'
        ? ['filename', 'mime_type', 'size_bytes', 'uploaded_by', 'archived_at']
        : []),
    ].join(',');
  const scoped = (domain, user) =>
    client()
      .from(operationTables[domain])
      .select(`${columns(domain)},${owner}`, { count: 'exact' })
      .eq('property.landlord.user_id', user);
  const result = async (q) => {
    const r = await q;
    if (r.error) failure(r.error);
    return r;
  };
  const rentRecords = async (user, query = {}, id = null) =>
    (
      await result(
        client().rpc('operations_rent_records', {
          p_actor: user,
          p_owner: query.owner_id ?? null,
          p_property: query.property_id ?? null,
          p_tenancy: query.tenancy_id ?? null,
          p_id: id,
          p_status: query.status || null,
          p_from: query.from ?? null,
          p_to: query.to ?? null,
          p_page: query.page ?? 1,
          p_limit: query.limit ?? 20,
        }),
      )
    ).data;
  return {
    async owns(user, id) {
      const r = await result(
        client()
          .from('properties')
          .select(
            'id,archived_at,landlord:property_manager_profiles!inner(user_id)',
          )
          .eq('id', id)
          .eq('landlord.user_id', user)
          .maybeSingle(),
      );
      return r.data;
    },
    async list(user, domain, query) {
      if (domain === 'rent') return rentRecords(user, query);
      let q = scoped(domain, user);
      if (query.owner_id) q = q.eq('property.managed_owner_id', query.owner_id);
      if (query.property_id) q = q.eq('property_id', query.property_id);
      if (query.tenancy_id) q = q.eq('tenancy_id', query.tenancy_id);
      if (
        query.status &&
        ['tenancies', 'maintenance', 'inspections', 'tasks'].includes(domain)
      )
        q = q.eq('status', query.status);
      if (query.priority && domain === 'maintenance')
        q = q.eq('priority', query.priority);
      const dateField =
        {
          rent: 'due_date',
          finances: 'record_date',
          inspections: 'inspection_date',
          tasks: 'due_date',
          tenancies: 'start_date',
        }[domain] ?? 'created_at';
      if (query.from) q = q.gte(dateField, query.from);
      if (query.to) q = q.lte(dateField, query.to);
      if (domain === 'documents') q = q.is('archived_at', null);
      const r = await result(
        q
          .order(dateField, { ascending: false })
          .order('id')
          .range((query.page - 1) * query.limit, query.page * query.limit - 1),
      );
      return { items: r.data, total: r.count };
    },
    async get(user, domain, id) {
      if (domain === 'rent')
        return (await rentRecords(user, {}, id)).items[0] ?? null;
      return (await result(scoped(domain, user).eq('id', id).maybeSingle()))
        .data;
    },
    async create(domain, fields) {
      return (
        await result(
          client()
            .from(operationTables[domain])
            .insert(fields)
            .select(columns(domain))
            .single(),
        )
      ).data;
    },
    async update(domain, id, propertyId, version, fields) {
      return (
        await result(
          client()
            .from(operationTables[domain])
            .update(fields)
            .eq('id', id)
            .eq('property_id', propertyId)
            .eq('version', version)
            .select(columns(domain))
            .maybeSingle(),
        )
      ).data;
    },
    async related(domain, id, propertyId) {
      return (
        await result(
          client()
            .from(operationTables[domain])
            .select(columns(domain))
            .eq('id', id)
            .eq('property_id', propertyId)
            .maybeSingle(),
        )
      ).data;
    },
    async tenantHomes(user) {
      return (
        await result(
          client()
            .from('tenancies')
            .select(
              'id,property_id,start_date,expected_end_date,end_date,monthly_rent,deposit_amount,status,property:properties(id,locality,address_line_1,property_type)',
            )
            .eq('tenant_user_id', user)
            .in('status', ['UPCOMING', 'ACTIVE', 'ENDING'])
            .order('start_date')
            .limit(100),
        )
      ).data;
    },
    async tenantTenancy(user, id) {
      return (
        await result(
          client()
            .from('tenancies')
            .select(
              'id,property_id,status,start_date,end_date,expected_end_date',
            )
            .eq('id', id)
            .eq('tenant_user_id', user)
            .in('status', ['UPCOMING', 'ACTIVE', 'ENDING'])
            .maybeSingle(),
        )
      ).data;
    },
    async tenantList(domain, tenancyId, query, user) {
      if (domain === 'rent')
        return rentRecords(user, { ...query, tenancy_id: tenancyId });
      let q = client()
        .from(operationTables[domain])
        .select(columns(domain), { count: 'exact' })
        .eq(
          domain === 'documents' ? 'shared_tenancy_id' : 'tenancy_id',
          tenancyId,
        );
      if (domain === 'documents') q = q.is('archived_at', null);
      const r = await result(
        q
          .order('created_at', { ascending: false })
          .order('id')
          .range((query.page - 1) * query.limit, query.page * query.limit - 1),
      );
      return { items: r.data, total: r.count };
    },
    async history(id) {
      return (
        await result(
          client()
            .from('maintenance_updates')
            .select('id,status,message,created_at')
            .eq('maintenance_id', id)
            .order('created_at', { ascending: false })
            .limit(100),
        )
      ).data;
    },
    async storagePath(id, propertyId) {
      return (
        await result(
          client()
            .from('property_documents')
            .select('storage_path')
            .eq('id', id)
            .eq('property_id', propertyId)
            .is('archived_at', null)
            .maybeSingle(),
        )
      ).data?.storage_path;
    },
    async rpc(name, args) {
      return (await result(client().rpc(name, args))).data;
    },
    async leasing(user, propertyId, query = {}) {
      const page = query.page ?? 1,
        limit = query.limit ?? 20;
      const scopedProperty = (q, field) => {
        if (propertyId) q = q.eq(field, propertyId);
        if (query.owner_id)
          q = q.eq(
            field.replace('property_id', 'property.managed_owner_id'),
            query.owner_id,
          );
        return q;
      };
      const [listings, applications, viewings] = await Promise.all([
        result(
          scopedProperty(
            client()
              .from('listings')
              .select(`id,title,status,monthly_rent,property_id,${owner}`, {
                count: 'exact',
              })
              .eq('property.landlord.user_id', user),
            'property_id',
          )
            .order('created_at', { ascending: false })
            .order('id')
            .range((page - 1) * limit, page * limit - 1),
        ),
        result(
          scopedProperty(
            client()
              .from('applications')
              .select(
                `id,status,submitted_at,listing:listings!inner(property_id,${owner}),tenant:tenant_profiles(profile:profiles(first_name,last_name))`,
                { count: 'exact' },
              )
              .eq('listing.property.landlord.user_id', user)
              .neq('status', 'DRAFT'),
            'listing.property_id',
          )
            .order('submitted_at', { ascending: false })
            .order('id')
            .range((page - 1) * limit, page * limit - 1),
        ),
        result(
          scopedProperty(
            client()
              .from('viewings')
              .select(
                `id,status,start_time,application_id,application:applications!inner(listing:listings!inner(property_id,${owner}))`,
                { count: 'exact' },
              )
              .eq('application.listing.property.landlord.user_id', user),
            'application.listing.property_id',
          )
            .order('start_time', { ascending: false })
            .order('id')
            .range((page - 1) * limit, page * limit - 1),
        ),
      ]);
      return {
        listings: listings.data,
        applications: applications.data,
        viewings: viewings.data,
        totals: {
          listings: listings.count,
          applications: applications.count,
          viewings: viewings.count,
        },
      };
    },
  };
}
export const operationRepository = createOperationRepository();
