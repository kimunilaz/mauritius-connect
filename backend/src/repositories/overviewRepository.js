import { getPrivilegedSupabaseClient } from '../config/supabase.js';

// Bounded previews deliberately omit answers, message bodies and evidence.
export function createOverviewRepository(client = getPrivilegedSupabaseClient) {
  async function result(query) {
    const { data, count, error } = await query;
    if (error) throw new Error('Overview query failed');
    return { items: data ?? [], total: count ?? 0 };
  }
  function preview(table, columns) {
    return client().from(table).select(columns, { count: 'exact' });
  }
  const owner =
    'property:properties!inner(landlord:property_manager_profiles!inner(user_id))';
  return {
    async landlord(userId) {
      const applications = () =>
        preview(
          'applications',
          `id,status,updated_at,listing:listings!inner(id,title,${owner})`,
        )
          .eq('listing.property.landlord.user_id', userId)
          .neq('status', 'DRAFT')
          .not('submitted_at', 'is', null);
      const [recent, waiting, viewings] = await Promise.all([
        result(
          applications()
            .order('updated_at', { ascending: false })
            .order('id')
            .limit(3),
        ),
        result(
          applications().in('status', ['SUBMITTED', 'UNDER_REVIEW']).limit(3),
        ),
        result(
          preview(
            'viewings',
            `id,application_id,status,start_time,application:applications!inner(status,submitted_at,listing:listings!inner(title,${owner}))`,
          )
            .eq('application.listing.property.landlord.user_id', userId)
            .neq('application.status', 'DRAFT')
            .not('application.submitted_at', 'is', null)
            .in('status', ['PROPOSED', 'CONFIRMED'])
            .gte('start_time', new Date().toISOString())
            .order('start_time')
            .order('id')
            .limit(3),
        ),
      ]);
      return {
        applications: {
          total: recent.total,
          waiting: waiting.total,
          items: recent.items.map(({ id, status, updated_at, listing }) => ({
            id,
            status,
            updated_at,
            title: listing.title,
          })),
        },
        viewings: {
          total: viewings.total,
          items: viewings.items.map(
            ({ id, application_id, status, start_time, application }) => ({
              id,
              application_id,
              status,
              start_time,
              title: application.listing.title,
            }),
          ),
        },
      };
    },
    async admin() {
      const [listings, reports, verifications, users] = await Promise.all([
        result(
          preview('listings', 'id,title,status,updated_at')
            .eq('status', 'PENDING_REVIEW')
            .order('updated_at')
            .order('id')
            .limit(3),
        ),
        result(
          preview('reports', 'id,reason,status,created_at')
            .in('status', ['OPEN', 'UNDER_REVIEW'])
            .order('created_at')
            .order('id')
            .limit(3),
        ),
        result(
          preview(
            'verification_records',
            'id,verification_type,status,created_at',
          )
            .in('status', ['PENDING', 'UNDER_REVIEW'])
            .order('created_at')
            .order('id')
            .limit(3),
        ),
        result(
          preview(
            'profiles',
            'id,first_name,last_name,account_status,updated_at',
          )
            .eq('account_status', 'SUSPENDED')
            .order('updated_at', { ascending: false })
            .order('id')
            .limit(3),
        ),
      ]);
      return { listings, reports, verifications, users };
    },
  };
}
export const overviewRepository = createOverviewRepository();
