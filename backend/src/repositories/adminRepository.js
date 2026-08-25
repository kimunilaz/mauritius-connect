import { getPrivilegedSupabaseClient } from '../config/supabase.js';
const db = () => getPrivilegedSupabaseClient();
export const adminRepository = {
  async listings(o) {
    let q = db()
      .from('listings')
      .select(
        'id,title,description,monthly_rent,available_from,status,updated_at,property:properties!inner(id,property_type,district,locality,neighbourhood,bedrooms,bathrooms,archived_at)',
        { count: 'exact' },
      )
      .order('updated_at', { ascending: true })
      .order('id', { ascending: true })
      .range((o.page - 1) * o.limit, o.page * o.limit - 1);
    if (o.status) q = q.eq('status', o.status);
    const { data, count, error } = await q;
    if (error) throw Error('admin listing query failed');
    return { data: data ?? [], count: count ?? 0 };
  },
  async listing(id) {
    const { data, error } = await db()
      .from('listings')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw Error('admin listing query failed');
    return data;
  },
  async review(admin, id, action, reason) {
    const { data, error } = await db().rpc('admin_review_listing_transaction', {
      p_admin: admin,
      p_listing: id,
      p_action: action,
      p_reason: reason ?? null,
    });
    if (error) throw Error('admin listing review failed');
    return data?.[0];
  },
  async users(o) {
    let q = db()
      .from('profiles')
      .select(
        'id,role,first_name,last_name,profile_photo_url,account_status,created_at,updated_at',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range((o.page - 1) * o.limit, o.page * o.limit - 1);
    if (o.q) q = q.or(`first_name.ilike.%${o.q}%,last_name.ilike.%${o.q}%`);
    const { data, count, error } = await q;
    if (error) throw Error('admin user query failed');
    return { data: data ?? [], count: count ?? 0 };
  },
  async user(id) {
    const { data, error } = await db()
      .from('profiles')
      .select(
        'id,role,first_name,last_name,profile_photo_url,account_status,created_at,updated_at',
      )
      .eq('id', id)
      .maybeSingle();
    if (error) throw Error('admin user query failed');
    return data;
  },
  async account(admin, id, action) {
    const { data, error } = await db().rpc('admin_account_state_transaction', {
      p_admin: admin,
      p_user: id,
      p_action: action,
    });
    if (error) throw Error('admin account mutation failed');
    return data?.[0];
  },
};
