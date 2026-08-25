import { getPrivilegedSupabaseClient } from '../config/supabase.js';

const COLUMNS =
  'id,type,title,message,entity_type,entity_id,read_at,created_at';

function failure() {
  return new Error('Notification repository operation failed.');
}

export const notificationRepository = {
  async createViewingCancel(viewingId, actorUserId) {
    const { data, error } = await getPrivilegedSupabaseClient().rpc(
      'create_viewing_cancel_notification',
      { p_viewing_id: viewingId, p_actor_user_id: actorUserId },
    );
    if (error) throw failure();
    return Array.isArray(data) ? data[0] : data;
  },

  async listForUser(userId, { page, limit, unreadOnly }) {
    const first = (page - 1) * limit;
    let query = getPrivilegedSupabaseClient()
      .from('notifications')
      .select(COLUMNS, { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(first, first + limit - 1);
    if (unreadOnly) query = query.is('read_at', null);
    const { data, count, error } = await query;
    if (error) throw failure();
    return { notifications: data ?? [], total: count ?? 0 };
  },

  async unreadCount(userId) {
    const { count, error } = await getPrivilegedSupabaseClient()
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);
    if (error) throw failure();
    return count ?? 0;
  },

  async markRead(notificationId, userId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId)
      .select('id,read_at')
      .maybeSingle();
    if (error) throw failure();
    return data;
  },

  async markAllRead(userId) {
    const { error } = await getPrivilegedSupabaseClient()
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .is('read_at', null);
    if (error) throw failure();
  },
};
