import { AppError } from '../middleware/AppError.js';
import { applicationAnswerRepository } from '../repositories/applicationAnswerRepository.js';
import { applicationQuestionRepository } from '../repositories/applicationQuestionRepository.js';
import { applicationRepository } from '../repositories/applicationRepository.js';
import { serializeApplicationAnswers } from '../serializers/applicationAnswerSerializer.js';
import { profileService as defaultProfileService } from './profileService.js';
import { publicListingService as defaultPublicListingService } from './publicListingService.js';
import { validateApplicationAnswerValue } from './applicationAnswerValidation.js';

function applicationNotFound() {
  return new AppError({
    statusCode: 404,
    code: 'APPLICATION_NOT_FOUND',
    message: 'Application not found.',
  });
}

function applicationNotEditable() {
  return new AppError({
    statusCode: 409,
    code: 'APPLICATION_NOT_EDITABLE',
    message: 'This application can no longer be edited.',
  });
}

function listingNotAvailable() {
  return new AppError({
    statusCode: 409,
    code: 'LISTING_NOT_AVAILABLE',
    message: 'This rental is no longer accepting application changes.',
  });
}

function answerValidation(index, message) {
  return new AppError({
    statusCode: 422,
    code: 'VALIDATION_ERROR',
    message: 'Some fields are invalid.',
    fields: { [`answers.${index}.answer_text`]: message },
  });
}

function questionValidation(index) {
  return new AppError({
    statusCode: 422,
    code: 'VALIDATION_ERROR',
    message: 'Some fields are invalid.',
    fields: {
      [`answers.${index}.question_id`]:
        'Question does not belong to this application listing.',
    },
  });
}

function normalizedAnswer(question, rawValue, index) {
  const result = validateApplicationAnswerValue(question, rawValue);
  if (!result.valid) throw answerValidation(index, result.message);
  return result.value;
}

export function createApplicationAnswerService({
  answers = applicationAnswerRepository,
  applications = applicationRepository,
  questions = applicationQuestionRepository,
  profiles = defaultProfileService,
  publicListings = defaultPublicListingService,
} = {}) {
  async function ownedApplication(userId, applicationId) {
    const tenant = await profiles.ensureTenantProfile(userId);
    const application = await applications.findByIdAndTenant(
      applicationId,
      tenant.id,
    );
    if (!application) throw applicationNotFound();
    return application;
  }

  async function restoreSubset(applicationId, questionIds, previous) {
    await answers.deleteForApplicationQuestions(applicationId, questionIds);
    await answers.restore(previous);
  }

  return Object.freeze({
    async list(userId, applicationId) {
      const application = await ownedApplication(userId, applicationId);
      const records = await answers.listForApplication(application.id);
      return serializeApplicationAnswers(
        records.filter(
          (answer) => answer.question.listing_id === application.listing_id,
        ),
      );
    },

    async put(userId, applicationId, input) {
      const application = await ownedApplication(userId, applicationId);
      if (application.status !== 'DRAFT' || application.submitted_at) {
        throw applicationNotEditable();
      }
      if (!(await publicListings.isEligible(application.listing_id))) {
        throw listingNotAvailable();
      }

      const currentQuestions = await questions.listForListing(
        application.listing_id,
      );
      const questionById = new Map(
        currentQuestions.map((question) => [question.id, question]),
      );
      const normalized = input.answers.map((answer, index) => {
        const question = questionById.get(answer.question_id);
        if (!question) throw questionValidation(index);
        return {
          question_id: answer.question_id,
          answer_text: normalizedAnswer(question, answer.answer_text, index),
        };
      });
      const questionIds = normalized.map((answer) => answer.question_id);
      const previous = (
        await answers.listForApplication(application.id)
      ).filter((answer) => questionIds.includes(answer.question_id));
      const answered = normalized.filter(
        (answer) => answer.answer_text !== null,
      );
      const clearedIds = normalized
        .filter((answer) => answer.answer_text === null)
        .map((answer) => answer.question_id);

      try {
        await answers.upsertForApplication(application.id, answered);
        await answers.deleteForApplicationQuestions(application.id, clearedIds);
      } catch (error) {
        await restoreSubset(application.id, questionIds, previous);
        throw error;
      }

      const records = await answers.listForApplication(application.id);
      return serializeApplicationAnswers(
        records.filter(
          (answer) => answer.question.listing_id === application.listing_id,
        ),
      );
    },
  });
}

export const applicationAnswerService = createApplicationAnswerService();
