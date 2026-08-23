import { AppError } from '../middleware/AppError.js';
import { applicationAnswerRepository } from '../repositories/applicationAnswerRepository.js';
import { applicationQuestionRepository } from '../repositories/applicationQuestionRepository.js';
import { applicationRepository } from '../repositories/applicationRepository.js';
import { applicationSubmissionRepository } from '../repositories/applicationSubmissionRepository.js';
import { serializeSubmittedApplication } from '../serializers/applicationSerializer.js';
import { validateApplicationAnswerValue } from './applicationAnswerValidation.js';
import { profileService as defaultProfileService } from './profileService.js';
import { publicListingService as defaultPublicListingService } from './publicListingService.js';

function applicationNotFound() {
  return new AppError({
    statusCode: 404,
    code: 'APPLICATION_NOT_FOUND',
    message: 'Application not found.',
  });
}

function applicationNotSubmittable() {
  return new AppError({
    statusCode: 409,
    code: 'APPLICATION_NOT_SUBMITTABLE',
    message: 'This application cannot be submitted from its current status.',
  });
}

function listingNotAvailable() {
  return new AppError({
    statusCode: 409,
    code: 'LISTING_NOT_AVAILABLE',
    message: 'This rental is no longer accepting applications.',
  });
}

function incomplete({
  missingFields = [],
  missingQuestionIds = [],
  invalidQuestionIds = [],
}) {
  return new AppError({
    statusCode: 422,
    code: 'APPLICATION_INCOMPLETE',
    message: 'Complete the required application information before submitting.',
    fields: {
      missing_fields: missingFields,
      missing_question_ids: missingQuestionIds,
      invalid_question_ids: invalidQuestionIds,
    },
  });
}

function coreMissing(application) {
  return [
    ['move_in_date', application.move_in_date],
    [
      'requested_lease_duration_months',
      application.requested_lease_duration_months,
    ],
    ['number_of_occupants', application.number_of_occupants],
  ]
    .filter(([, value]) => value === null || value === undefined)
    .map(([field]) => field);
}

function answerReadiness(application, questions, answers) {
  const questionById = new Map(
    questions.map((question) => [question.id, question]),
  );
  const answerByQuestion = new Map(
    answers.map((answer) => [answer.question_id, answer]),
  );
  const missingQuestionIds = questions
    .filter((question) => {
      const value = answerByQuestion.get(question.id)?.answer_text?.trim();
      return question.is_required && !value;
    })
    .map((question) => question.id);
  const invalidQuestionIds = answers
    .filter((answer) => {
      const question = questionById.get(answer.question_id);
      if (!question || question.listing_id !== application.listing_id) {
        return true;
      }
      const result = validateApplicationAnswerValue(
        question,
        answer.answer_text,
      );
      return !result.valid || result.value === null;
    })
    .map((answer) => answer.question_id);
  return { missingQuestionIds, invalidQuestionIds };
}

function mapTransactionOutcome(result) {
  if (result.outcome === 'NOT_FOUND') throw applicationNotFound();
  if (result.outcome === 'LISTING_NOT_AVAILABLE') {
    throw listingNotAvailable();
  }
  if (result.outcome === 'NOT_SUBMITTABLE') {
    throw applicationNotSubmittable();
  }
  if (result.outcome === 'INCOMPLETE') {
    throw incomplete({
      missingFields: result.missing_fields,
      missingQuestionIds: result.missing_question_ids,
      invalidQuestionIds: result.invalid_question_ids,
    });
  }
  if (result.outcome === 'INTEGRITY_ERROR') {
    throw new Error('Application submission history integrity failed.');
  }
  if (
    result.outcome !== 'SUBMITTED' &&
    result.outcome !== 'ALREADY_SUBMITTED'
  ) {
    throw new Error('Unexpected application submission outcome.');
  }
}

export function createApplicationSubmissionService({
  applications = applicationRepository,
  answers = applicationAnswerRepository,
  questions = applicationQuestionRepository,
  submissions = applicationSubmissionRepository,
  profiles = defaultProfileService,
  publicListings = defaultPublicListingService,
} = {}) {
  return Object.freeze({
    async submit(userId, applicationId) {
      const tenant = await profiles.ensureTenantProfile(userId);
      let application = await applications.findByIdAndTenant(
        applicationId,
        tenant.id,
      );
      if (!application) throw applicationNotFound();

      if (
        application.status !== 'DRAFT' &&
        application.status !== 'SUBMITTED'
      ) {
        throw applicationNotSubmittable();
      }

      if (application.status === 'DRAFT') {
        if (!(await publicListings.isEligible(application.listing_id))) {
          throw listingNotAvailable();
        }
        const [currentQuestions, storedAnswers] = await Promise.all([
          questions.listForListing(application.listing_id),
          answers.listForApplication(application.id),
        ]);
        const readiness = {
          missingFields: coreMissing(application),
          ...answerReadiness(application, currentQuestions, storedAnswers),
        };
        if (
          readiness.missingFields.length ||
          readiness.missingQuestionIds.length ||
          readiness.invalidQuestionIds.length
        ) {
          throw incomplete(readiness);
        }
      }

      const result = await submissions.submit({
        applicationId: application.id,
        tenantId: tenant.id,
        actorUserId: userId,
      });
      mapTransactionOutcome(result);

      application = await applications.findByIdAndTenant(
        application.id,
        tenant.id,
      );
      if (!application) throw applicationNotFound();
      return {
        application: serializeSubmittedApplication(application),
        submitted: result.outcome === 'SUBMITTED',
      };
    },
  });
}

export const applicationSubmissionService =
  createApplicationSubmissionService();
