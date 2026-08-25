import { getPrivilegedSupabaseClient } from '../config/supabase.js';
const db = () => getPrivilegedSupabaseClient();
export const verificationRepository = {
  async create({ userId, type, propertyId }) {
    const { data, error } = await db().rpc('create_verification_transaction', {
      p_landlord_user_id: userId,
      p_type: type,
      p_property_id: propertyId ?? null,
    });
    if (error) throw new Error('verification create failed');
    return data?.[0];
  },
  async list({ userId, admin = false, page, limit, status, type }) {
    let q = db()
      .from('verification_records')
      .select(
        'id,subject_type,subject_id,verification_type,status,rejection_reason,created_at,updated_at,reviewed_at,evidence_count',
        { count: 'exact' },
      )
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range((page - 1) * limit, page * limit - 1);
    if (!admin) {
      const { data: p } = await db()
        .from('landlord_profiles')
        .select('id')
        .eq('user_id', userId)
        .single();
      q = q.or(
        `and(subject_type.eq.USER,subject_id.eq.${userId}),and(subject_type.eq.PROPERTY,subject_id.in.(${
          (
            await db()
              .from('properties')
              .select('id')
              .eq(
                'landlord_id',
                p?.id ?? '00000000-0000-0000-0000-000000000000',
              )
          ).data
            ?.map((x) => x.id)
            .join(',') || '00000000-0000-0000-0000-000000000000'
        }))`,
      );
    }
    if (status) q = q.eq('status', status);
    if (type) q = q.eq('verification_type', type);
    const { data, count, error } = await q;
    if (error) throw new Error('verification list failed');
    return { data: data ?? [], count: count ?? 0 };
  },
  async get(id) {
    const { data, error } = await db()
      .from('verification_records')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error('verification get failed');
    return data;
  },
  async moderate(id, adminId, status, reason) {
    const { data, error } = await db().rpc(
      'moderate_verification_transaction',
      {
        p_admin_user_id: adminId,
        p_verification_id: id,
        p_status: status,
        p_reason: reason ?? null,
      },
    );
    if (error) throw new Error('verification moderation failed');
    return data?.[0];
  },
  async addEvidence(id, fields) {
    const { data, error } = await db()
      .from('verification_records')
      .update(fields)
      .eq('id', id)
      .select('id,evidence_count')
      .single();
    if (error) throw new Error('verification evidence failed');
    return data;
  },
  async ownsProperty(userId, propertyId) {
    const { data } = await db()
      .from('properties')
      .select('id,landlord:landlord_profiles!inner(user_id)')
      .eq('id', propertyId)
      .eq('landlord.user_id', userId)
      .maybeSingle();
    return Boolean(data);
  },
};
