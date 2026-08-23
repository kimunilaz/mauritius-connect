import { createApp } from '../../src/app.js';
import { createApplicationSubmissionService } from '../../src/services/applicationSubmissionService.js';
import {
  createApplicationAnswerTestContext,
  makeAnswer,
} from './createApplicationAnswerTestContext.js';
import {
  APPLICATION_IDS,
  makeApplication,
} from './createApplicationTestContext.js';
import { makeQuestion } from './createApplicationQuestionTestContext.js';

export const SUBMISSION_QUESTION_ID = '94000000-0000-4000-8000-000000000001';

export function makeSubmissionApplication(overrides = {}) {
  return makeApplication({
    move_in_date: '2026-10-01',
    requested_lease_duration_months: 12,
    number_of_occupants: 2,
    introductory_message: 'We would be responsible long-term tenants.',
    ...overrides,
  });
}

export function makeSubmissionQuestion(overrides = {}) {
  return makeQuestion({
    id: SUBMISSION_QUESTION_ID,
    question_text: 'Why is this home suitable?',
    question_type: 'TEXT',
    is_required: true,
    options: [],
    ...overrides,
  });
}

export function makeSubmissionAnswer(overrides = {}) {
  return makeAnswer({
    question_id: SUBMISSION_QUESTION_ID,
    answer_text: 'It is close to work and suits our household.',
    ...overrides,
  });
}

export function createApplicationSubmissionTestContext({
  applicationRecords = [makeSubmissionApplication()],
  questionRecords = [makeSubmissionQuestion()],
  answerRecords = [makeSubmissionAnswer()],
  listingRecords,
  propertyRecords,
  applicationProfiles,
  transactionOutcomeOnce,
} = {}) {
  const base = createApplicationAnswerTestContext({
    applicationRecords,
    questionRecords,
    answerRecords,
    listingRecords,
    propertyRecords,
    applicationProfiles,
  });
  const historyRecords = [];
  let nextOutcome = transactionOutcomeOnce;
  let queue = Promise.resolve();

  const submissions = {
    async submit({ applicationId, tenantId, actorUserId }) {
      const previous = queue;
      let release;
      queue = new Promise((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        if (nextOutcome) {
          const result = nextOutcome;
          nextOutcome = null;
          return {
            application_id: applicationId,
            submitted_at: null,
            missing_fields: [],
            missing_question_ids: [],
            invalid_question_ids: [],
            ...result,
          };
        }
        const application = base.applicationRecords.find(
          (candidate) =>
            candidate.id === applicationId && candidate.tenant_id === tenantId,
        );
        if (!application) return { outcome: 'NOT_FOUND' };
        if (application.status === 'SUBMITTED') {
          return {
            outcome: 'ALREADY_SUBMITTED',
            application_id: applicationId,
            submitted_at: application.submitted_at,
          };
        }
        if (application.status !== 'DRAFT' || application.submitted_at) {
          return { outcome: 'NOT_SUBMITTABLE' };
        }
        const submittedAt = '2026-08-22T12:30:00.000Z';
        Object.assign(application, {
          status: 'SUBMITTED',
          submitted_at: submittedAt,
          updated_at: submittedAt,
        });
        historyRecords.push({
          application_id: applicationId,
          from_status: 'DRAFT',
          to_status: 'SUBMITTED',
          changed_by_user_id: actorUserId,
        });
        return {
          outcome: 'SUBMITTED',
          application_id: applicationId,
          submitted_at: submittedAt,
        };
      } finally {
        release();
      }
    },
  };

  const applicationSubmissionService = createApplicationSubmissionService({
    applications: base.applications,
    answers: base.answers,
    questions: {
      async listForListing(listingId) {
        return base.questionRecords.filter(
          (question) => question.listing_id === listingId,
        );
      },
    },
    submissions,
    profiles: base.profileService,
    publicListings: base.publicListingService,
  });

  return {
    ...base,
    app: createApp({
      authService: base.authService,
      profileService: base.profileService,
      publicListingService: base.publicListingService,
      applicationService: base.applicationService,
      applicationAnswerService: base.applicationAnswerService,
      applicationSubmissionService,
    }),
    applicationSubmissionService,
    historyRecords,
    submissions,
    applicationId: APPLICATION_IDS.a,
  };
}
