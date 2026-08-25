import { getPrivilegedSupabaseClient } from '../config/supabase.js';

const COUNTERPARTY_COLUMNS = 'first_name,last_name,profile_photo_url';
const LISTING_CONTEXT =
  'id,title,status,property:properties!inner(archived_at)';
const CONVERSATION_PROJECTION = [
  'id',
  'listing_id',
  'tenant_user_id',
  'landlord_user_id',
  'created_at',
  'updated_at',
  `tenant:profiles!conversations_tenant_user_fk(${COUNTERPARTY_COLUMNS})`,
  `landlord:profiles!conversations_landlord_user_fk(${COUNTERPARTY_COLUMNS})`,
  `listing:listings!inner(${LISTING_CONTEXT})`,
  'membership:conversation_participants!inner(user_id,last_read_at)',
].join(',');

export class ConversationRepositoryError extends Error {
  constructor() {
    super('The conversation repository operation failed.');
    this.name = 'ConversationRepositoryError';
  }
}

function failure() {
  return new ConversationRepositoryError();
}

const client = () => getPrivilegedSupabaseClient();

export const conversationRepository = {
  async createForListing(listingId, tenantUserId) {
    const { data, error } = await getPrivilegedSupabaseClient().rpc(
      'create_conversation_transaction',
      {
        p_listing_id: listingId,
        p_tenant_user_id: tenantUserId,
      },
    );
    if (error) throw failure();
    return Array.isArray(data) ? data[0] : data;
  },

  async listForParticipant(userId, { page, limit }) {
    const first = (page - 1) * limit;
    const { data, error, count } = await getPrivilegedSupabaseClient()
      .from('conversations')
      .select(CONVERSATION_PROJECTION, { count: 'exact' })
      .eq('membership.user_id', userId)
      .order('updated_at', { ascending: false })
      .order('id', { ascending: false })
      .range(first, first + limit - 1);
    if (error) throw failure();
    const conversations = await Promise.all(
      (data ?? []).map(async (record) => {
        const membership = Array.isArray(record.membership)
          ? record.membership.find(({ user_id }) => user_id === userId)
          : record.membership;
        const [latest, unread] = await Promise.all([
          client()
            .from('messages')
            .select('id,sender_user_id,content,created_at')
            .eq('conversation_id', record.id)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false })
            .limit(1)
            .maybeSingle(),
          client()
            .from('messages')
            .select('id', { count: 'exact', head: true })
            .eq('conversation_id', record.id)
            .neq('sender_user_id', userId)
            .gt(
              'created_at',
              membership?.last_read_at ?? '1970-01-01T00:00:00.000Z',
            ),
        ]);
        if (latest.error || unread.error) throw failure();
        return {
          ...record,
          unread_count: unread.count ?? 0,
          last_message: latest.data ?? null,
        };
      }),
    );
    return { conversations, total: count ?? 0 };
  },

  async findByIdForParticipant(conversationId, userId) {
    const { data, error } = await getPrivilegedSupabaseClient()
      .from('conversations')
      .select(CONVERSATION_PROJECTION)
      .eq('id', conversationId)
      .eq('membership.user_id', userId)
      .maybeSingle();
    if (error) throw failure();
    if (!data) return data;
    const membership = Array.isArray(data.membership)
      ? data.membership.find(({ user_id }) => user_id === userId)
      : data.membership;
    return {
      ...data,
      membership,
      last_read_at: membership?.last_read_at ?? null,
    };
  },
};
