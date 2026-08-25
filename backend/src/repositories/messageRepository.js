import { getPrivilegedSupabaseClient } from '../config/supabase.js';

const MESSAGE_COLUMNS = 'id,conversation_id,sender_user_id,content,created_at';

export class MessageRepositoryError extends Error {
  constructor() {
    super('The message repository operation failed.');
    this.name = 'MessageRepositoryError';
  }
}

function failure() {
  return new MessageRepositoryError();
}

const client = () => getPrivilegedSupabaseClient();

export const messageRepository = {
  async send(conversationId, senderUserId, content) {
    const { data, error } = await client().rpc('send_message_transaction', {
      p_conversation_id: conversationId,
      p_sender_user_id: senderUserId,
      p_content: content,
    });
    if (error) throw failure();
    return Array.isArray(data) ? data[0] : data;
  },

  async list(conversationId, { page, limit }) {
    const first = (page - 1) * limit;
    const { data, error, count } = await client()
      .from('messages')
      .select(MESSAGE_COLUMNS, { count: 'exact' })
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(first, first + limit - 1);
    if (error) throw failure();
    return { messages: data ?? [], total: count ?? 0 };
  },

  async findById(messageId, conversationId) {
    const { data, error } = await client()
      .from('messages')
      .select(MESSAGE_COLUMNS)
      .eq('id', messageId)
      .eq('conversation_id', conversationId)
      .maybeSingle();
    if (error) throw failure();
    return data;
  },

  async latest(conversationId) {
    const { data, error } = await client()
      .from('messages')
      .select(MESSAGE_COLUMNS)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw failure();
    return data;
  },

  async unreadCount(conversationId, userId, lastReadAt) {
    let query = client()
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', conversationId)
      .neq('sender_user_id', userId);
    query = lastReadAt ? query.gt('created_at', lastReadAt) : query;
    const { count, error } = await query;
    if (error) throw failure();
    return count ?? 0;
  },

  async markRead(conversationId, userId) {
    const { data, error } = await client().rpc(
      'mark_conversation_read_transaction',
      { p_conversation_id: conversationId, p_user_id: userId },
    );
    if (error) throw failure();
    return Array.isArray(data) ? data[0] : data;
  },
};
