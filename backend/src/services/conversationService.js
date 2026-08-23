import { AppError } from '../middleware/AppError.js';
import { conversationRepository } from '../repositories/conversationRepository.js';
import { serializeConversation } from '../serializers/conversationSerializer.js';
import { publicListingService as defaultPublicListingService } from './publicListingService.js';

function notFound() {
  return new AppError({
    statusCode: 404,
    code: 'CONVERSATION_NOT_FOUND',
    message: 'Conversation not found.',
  });
}

function listingNotFound() {
  return new AppError({
    statusCode: 404,
    code: 'LISTING_NOT_FOUND',
    message: 'Listing not found.',
  });
}

export function createConversationService({
  conversations = conversationRepository,
  publicListings = defaultPublicListingService,
} = {}) {
  async function present(record, userId, role) {
    let counterpartyProfile;
    if (role === 'TENANT' && record.tenant_user_id === userId) {
      counterpartyProfile = record.landlord;
    } else if (role === 'LANDLORD' && record.landlord_user_id === userId) {
      counterpartyProfile = record.tenant;
    } else {
      throw notFound();
    }

    const publicListing = await publicListings.presentCardForId(
      record.listing_id,
    );
    const available = Boolean(publicListing);
    const listing =
      role === 'TENANT'
        ? publicListing
        : {
            id: record.listing.id,
            title: record.listing.title,
            status: record.listing.status,
          };

    return serializeConversation(record, {
      counterpartyProfile,
      availability: available ? 'AVAILABLE' : 'UNAVAILABLE',
      listing: role === 'TENANT' && !available ? null : listing,
    });
  }

  async function getRecord(userId, role, conversationId) {
    const record = await conversations.findByIdForParticipant(
      conversationId,
      userId,
    );
    if (!record) throw notFound();
    return present(record, userId, role);
  }

  return Object.freeze({
    async create(userId, listingId) {
      const result = await conversations.createForListing(listingId, userId);
      if (!result || result.outcome === 'LISTING_NOT_FOUND') {
        throw listingNotFound();
      }
      if (result.outcome !== 'READY' || !result.conversation_id) {
        throw new Error('Conversation creation integrity failed.');
      }
      return {
        conversation: await getRecord(userId, 'TENANT', result.conversation_id),
        created: result.created_now,
      };
    },

    async list(userId, role, query) {
      const result = await conversations.listForParticipant(userId, query);
      return {
        total: result.total,
        conversations: await Promise.all(
          result.conversations.map((record) => present(record, userId, role)),
        ),
      };
    },

    get(userId, role, conversationId) {
      return getRecord(userId, role, conversationId);
    },
  });
}

export const conversationService = createConversationService();
