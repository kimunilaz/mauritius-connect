import { AppError } from '../middleware/AppError.js';
import { messageRepository as defaultRepository } from '../repositories/messageRepository.js';
import { conversationRepository as defaultConversations } from '../repositories/conversationRepository.js';
import { serializeMessage } from '../serializers/messageSerializer.js';

function notFound() {
  return new AppError({
    statusCode: 404,
    code: 'CONVERSATION_NOT_FOUND',
    message: 'Conversation not found.',
  });
}

export function createMessageService({
  messages = defaultRepository,
  conversations = defaultConversations,
} = {}) {
  async function requireParticipant(conversationId, userId) {
    const record = await conversations.findByIdForParticipant(
      conversationId,
      userId,
    );
    if (!record) throw notFound();
    return record;
  }

  return Object.freeze({
    async send(userId, conversationId, body) {
      await requireParticipant(conversationId, userId);
      const result = await messages.send(conversationId, userId, body);
      if (!result || result.outcome !== 'CREATED' || !result.message_id) {
        throw notFound();
      }
      const message = await messages.findById(
        result.message_id,
        conversationId,
      );
      if (!message) throw new Error('Message creation integrity failed.');
      return serializeMessage(message, userId);
    },

    async list(userId, conversationId, query) {
      await requireParticipant(conversationId, userId);
      const result = await messages.list(conversationId, query);
      return {
        messages: result.messages.map((message) =>
          serializeMessage(message, userId),
        ),
        total: result.total,
      };
    },

    async markRead(userId, conversationId) {
      await requireParticipant(conversationId, userId);
      const result = await messages.markRead(conversationId, userId);
      if (!result || result.outcome !== 'UPDATED') throw notFound();
      return { last_read_at: result.last_read_at };
    },
  });
}

export const messageService = createMessageService();
