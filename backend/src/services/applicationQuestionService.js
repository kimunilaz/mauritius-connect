import { AppError } from '../middleware/AppError.js';
import { applicationQuestionRepository } from '../repositories/applicationQuestionRepository.js';
import {
  serializeApplicationQuestion,
  serializeApplicationQuestions,
} from '../serializers/applicationQuestionSerializer.js';
import { listingService as defaultListingService } from './listingService.js';
import { publicListingService as defaultPublicListingService } from './publicListingService.js';

const MUTABLE_LISTING_STATUSES = new Set([
  'DRAFT',
  'PENDING_REVIEW',
  'ACTIVE',
  'PAUSED',
]);
const QUESTION_FIELDS = [
  'question_text',
  'question_type',
  'is_required',
  'display_order',
];

function questionNotFound() {
  return new AppError({
    statusCode: 404,
    code: 'APPLICATION_QUESTION_NOT_FOUND',
    message: 'Application question not found.',
  });
}

function questionsLocked() {
  return new AppError({
    statusCode: 409,
    code: 'APPLICATION_QUESTIONS_LOCKED',
    message:
      'Application questions are locked because applications have already been submitted.',
  });
}

function listingNotEditable() {
  return new AppError({
    statusCode: 409,
    code: 'LISTING_NOT_EDITABLE',
    message: 'Application questions cannot be changed for this listing.',
  });
}

function optionsValidation(message) {
  return new AppError({
    statusCode: 422,
    code: 'VALIDATION_ERROR',
    message: 'Some fields are invalid.',
    fields: { options: message },
  });
}

function questionFields(input) {
  return Object.fromEntries(
    QUESTION_FIELDS.filter((field) => Object.hasOwn(input, field)).map(
      (field) => [field, input[field]],
    ),
  );
}

function optionFields(options = []) {
  return options.map(({ option_text, display_order }) => ({
    option_text,
    display_order,
  }));
}

export function createApplicationQuestionService({
  questions = applicationQuestionRepository,
  listings = defaultListingService,
  publicListings = defaultPublicListingService,
} = {}) {
  async function ownedListing(userId, listingId) {
    return listings.getOwnedRecord(userId, listingId);
  }

  async function mutationContext(userId, listingId, questionId) {
    const listing = await ownedListing(userId, listingId);
    const question = questionId
      ? await questions.findForListing(listing.id, questionId)
      : null;
    if (questionId && !question) throw questionNotFound();
    if (await questions.hasSubmittedApplication(listing.id)) {
      throw questionsLocked();
    }
    if (!MUTABLE_LISTING_STATUSES.has(listing.status)) {
      throw listingNotEditable();
    }
    return { listing, question };
  }

  function mutationPayload(input) {
    const payload = questionFields(input);
    if (Object.hasOwn(input, 'options')) {
      payload.options = optionFields(input.options);
    }
    return payload;
  }

  function requireMutation(result) {
    if (result.outcome === 'OK') return result;
    if (result.outcome === 'LOCKED') throw questionsLocked();
    if (result.outcome === 'LISTING_NOT_EDITABLE') throw listingNotEditable();
    if (result.outcome === 'QUESTION_NOT_FOUND') throw questionNotFound();
    if (result.outcome === 'NOT_FOUND') {
      throw new AppError({
        statusCode: 404,
        code: 'LISTING_NOT_FOUND',
        message: 'Listing not found.',
      });
    }
    throw new Error('Unexpected application question mutation outcome.');
  }

  return Object.freeze({
    async listOwned(userId, listingId) {
      const listing = await ownedListing(userId, listingId);
      const [records, locked] = await Promise.all([
        questions.listForListing(listing.id),
        questions.hasSubmittedApplication(listing.id),
      ]);
      return {
        questions: serializeApplicationQuestions(records),
        locked,
        editable: MUTABLE_LISTING_STATUSES.has(listing.status) && !locked,
        listingStatus: listing.status,
      };
    },

    async listPublic(listingId) {
      if (!(await publicListings.isEligible(listingId))) {
        throw new AppError({
          statusCode: 404,
          code: 'LISTING_NOT_FOUND',
          message: 'Listing not found.',
        });
      }
      return serializeApplicationQuestions(
        await questions.listForListing(listingId),
      );
    },

    async create(userId, listingId, input) {
      const { listing } = await mutationContext(userId, listingId);
      const result = requireMutation(
        await questions.mutateQuestion({
          operation: 'CREATE',
          listingId: listing.id,
          actorUserId: userId,
          payload: mutationPayload(input),
        }),
      );
      return serializeApplicationQuestion(
        await questions.findForListing(listing.id, result.question_id),
      );
    },

    async update(userId, listingId, questionId, input) {
      const { question } = await mutationContext(userId, listingId, questionId);
      const targetType = input.question_type ?? question.question_type;
      const replacingOptions = Object.hasOwn(input, 'options');
      if (
        targetType === 'SELECT' &&
        question.question_type !== 'SELECT' &&
        !input.options?.length
      ) {
        throw optionsValidation(
          'Changing to SELECT requires at least one valid option.',
        );
      }
      if (
        targetType === 'SELECT' &&
        replacingOptions &&
        !input.options.length
      ) {
        throw optionsValidation(
          'SELECT questions require at least one option.',
        );
      }
      if (targetType !== 'SELECT' && input.options?.length) {
        throw optionsValidation(
          'Options are allowed only for SELECT questions.',
        );
      }

      requireMutation(
        await questions.mutateQuestion({
          operation: 'UPDATE',
          listingId,
          questionId,
          actorUserId: userId,
          payload: mutationPayload(input),
        }),
      );
      return serializeApplicationQuestion(
        await questions.findForListing(listingId, questionId),
      );
    },

    async remove(userId, listingId, questionId) {
      await mutationContext(userId, listingId, questionId);
      requireMutation(
        await questions.mutateQuestion({
          operation: 'DELETE',
          listingId,
          questionId,
          actorUserId: userId,
        }),
      );
    },
  });
}

export const applicationQuestionService = createApplicationQuestionService();
