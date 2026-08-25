import { getPrivilegedSupabaseClient } from '../config/supabase.js';

const LIST_COLUMNS =
  'id,target_type,target_id,reason,status,description,created_at,updated_at,reporter:profiles!reports_reporter_user_fk(first_name,last_name)';

function failure() {
  return new Error('Report repository operation failed.');
}

const client = () => getPrivilegedSupabaseClient();

export const reportRepository = {
  async create({ reporterUserId, targetType, targetId, reason, details }) {
    const { data, error } = await client().rpc('create_report_transaction', {
      p_reporter_user_id: reporterUserId,
      p_target_type: targetType,
      p_target_id: targetId,
      p_reason: reason,
      p_details: details,
    });
    if (error) throw failure();
    return Array.isArray(data) ? data[0] : data;
  },

  async list({ page, limit, status, targetType }) {
    let query = client()
      .from('reports')
      .select(LIST_COLUMNS, { count: 'exact' })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range((page - 1) * limit, page * limit - 1);
    if (status) query = query.eq('status', status);
    if (targetType) query = query.eq('target_type', targetType);
    const { data, count, error } = await query;
    if (error) throw failure();
    return { reports: data ?? [], total: count ?? 0 };
  },

  async findById(reportId) {
    const { data, error } = await client()
      .from('reports')
      .select(LIST_COLUMNS)
      .eq('id', reportId)
      .maybeSingle();
    if (error) throw failure();
    if (!data) return null;
    const target = await this.findTarget(data);
    return { ...data, target };
  },

  async findTarget(report) {
    if (report.target_type === 'LISTING') {
      const { data, error } = await client()
        .from('listings')
        .select(
          'id,title,status,description,monthly_rent,available_from,property:properties!inner(property_type,district,locality,neighbourhood,bedrooms,bathrooms,furnished,parking_spaces)',
        )
        .eq('id', report.target_id)
        .maybeSingle();
      if (error) throw failure();
      return data ? { type: 'LISTING', listing: data } : null;
    }
    if (report.target_type === 'MESSAGE') {
      const { data, error } = await client()
        .from('messages')
        .select(
          'id,content,created_at,sender:profiles!messages_sender_user_fk(first_name,last_name),conversation:conversations!messages_conversation_fk(id,listing:listings(title))',
        )
        .eq('id', report.target_id)
        .maybeSingle();
      if (error) throw failure();
      return data ? { type: 'MESSAGE', message: data } : null;
    }
    return null;
  },

  async moderate(reportId, adminUserId, status, reason) {
    const { data, error } = await client().rpc('moderate_report_transaction', {
      p_report_id: reportId,
      p_admin_user_id: adminUserId,
      p_target_status: status,
      p_reason: reason ?? null,
    });
    if (error) throw failure();
    return Array.isArray(data) ? data[0] : data;
  },
};
