import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeProfile, TEST_USERS } from '../helpers/createAuthTestContext.js';
import {
  createApplicationSubmissionTestContext,
  makeSubmissionAnswer,
  makeSubmissionApplication,
  makeSubmissionQuestion,
  SUBMISSION_QUESTION_ID,
} from '../helpers/createApplicationSubmissionTestContext.js';
import { APPLICATION_IDS } from '../helpers/createApplicationTestContext.js';
import { makeOption } from '../helpers/createApplicationQuestionTestContext.js';
import { makeListing } from '../helpers/createListingTestContext.js';
import { makeProperty } from '../helpers/createPropertyTestContext.js';
import { TENANT_PROFILE_IDS } from '../helpers/createSavedListingTestContext.js';

const submitPath = (id = APPLICATION_IDS.a) =>
  `/api/v1/applications/${id}/submit`;
const auth = (builder, token = 'tenant-token') =>
  builder.set('Authorization', `Bearer ${token}`);

describe('application submission transition', () => {
  it('atomically submits a complete owned draft and attributes one history row', async () => {
    const context = createApplicationSubmissionTestContext();
    const response = await auth(request(context.app).post(submitPath())).send();

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.meta.submitted_now).toBe(true);
    expect(response.body.data).toMatchObject({
      id: APPLICATION_IDS.a,
      status: 'SUBMITTED',
      submitted_at: '2026-08-22T12:30:00.000Z',
    });
    expect(response.body.data).not.toHaveProperty('tenant_id');
    expect(context.applicationRecords[0]).toMatchObject({
      status: 'SUBMITTED',
      withdrawn_at: null,
    });
    expect(context.historyRecords).toEqual([
      {
        application_id: APPLICATION_IDS.a,
        from_status: 'DRAFT',
        to_status: 'SUBMITTED',
        changed_by_user_id: TEST_USERS.tenant,
      },
    ]);
  });

  it.each([
    'move_in_date',
    'requested_lease_duration_months',
    'number_of_occupants',
  ])('rejects a draft missing required core field %s', async (field) => {
    const context = createApplicationSubmissionTestContext({
      applicationRecords: [makeSubmissionApplication({ [field]: null })],
    });
    const response = await auth(request(context.app).post(submitPath())).send();
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('APPLICATION_INCOMPLETE');
    expect(response.body.error.fields.missing_fields).toContain(field);
    expect(context.historyRecords).toHaveLength(0);
  });

  it('rejects a missing current required question answer', async () => {
    const context = createApplicationSubmissionTestContext({
      answerRecords: [],
    });
    const response = await auth(request(context.app).post(submitPath())).send();
    expect(response.status).toBe(422);
    expect(response.body.error.fields.missing_question_ids).toEqual([
      SUBMISSION_QUESTION_ID,
    ]);
  });

  it('allows a current optional question to remain unanswered', async () => {
    const context = createApplicationSubmissionTestContext({
      questionRecords: [makeSubmissionQuestion({ is_required: false })],
      answerRecords: [],
    });
    const response = await auth(request(context.app).post(submitPath())).send();
    expect(response.status).toBe(200);
  });

  it.each([
    ['TEXT', 'x'.repeat(2001), []],
    ['NUMBER', 'not-a-number', []],
    ['BOOLEAN', 'yes', []],
    ['DATE', '2026-02-30', []],
    [
      'SELECT',
      'Removed option',
      [
        makeOption({
          question_id: SUBMISSION_QUESTION_ID,
          option_text: 'Current option',
        }),
      ],
    ],
  ])(
    'revalidates a stored %s answer',
    async (questionType, answerText, options) => {
      const context = createApplicationSubmissionTestContext({
        questionRecords: [
          makeSubmissionQuestion({ question_type: questionType, options }),
        ],
        answerRecords: [makeSubmissionAnswer({ answer_text: answerText })],
      });
      const response = await auth(
        request(context.app).post(submitPath()),
      ).send();
      expect(response.status).toBe(422);
      expect(response.body.error.fields.invalid_question_ids).toContain(
        SUBMISSION_QUESTION_ID,
      );
    },
  );

  it('rejects an answer whose question is not in the application listing', async () => {
    const context = createApplicationSubmissionTestContext({
      questionRecords: [],
      answerRecords: [makeSubmissionAnswer()],
    });
    const response = await auth(request(context.app).post(submitPath())).send();
    expect(response.status).toBe(422);
    expect(response.body.error.fields.invalid_question_ids).toContain(
      SUBMISSION_QUESTION_ID,
    );
  });

  it.each([
    ['PAUSED', null],
    ['CLOSED', null],
    ['ACTIVE', '2026-08-22T10:00:00.000Z'],
  ])(
    'blocks submission when listing is %s and archive is %s',
    async (status, archivedAt) => {
      const context = createApplicationSubmissionTestContext({
        listingRecords: [makeListing({ status })],
        propertyRecords: [makeProperty({ archived_at: archivedAt })],
      });
      const response = await auth(
        request(context.app).post(submitPath()),
      ).send();
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('LISTING_NOT_AVAILABLE');
    },
  );

  it('returns 404 when another tenant attempts to submit the draft', async () => {
    const context = createApplicationSubmissionTestContext();
    const response = await auth(
      request(context.app).post(submitPath()),
      'other-token',
    ).send();
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('APPLICATION_NOT_FOUND');
  });

  it('rejects landlord, suspended, and deleted accounts before submission', async () => {
    const landlordContext = createApplicationSubmissionTestContext();
    expect(
      (
        await auth(
          request(landlordContext.app).post(submitPath()),
          'landlord-token',
        ).send()
      ).status,
    ).toBe(403);

    for (const accountStatus of ['SUSPENDED', 'DELETED']) {
      const context = createApplicationSubmissionTestContext({
        applicationProfiles: [
          makeProfile({ account_status: accountStatus }),
          makeProfile({
            id: TEST_USERS.landlord,
            role: 'LANDLORD',
          }),
          makeProfile({ id: TEST_USERS.other }),
        ],
      });
      const response = await auth(
        request(context.app).post(submitPath()),
      ).send();
      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe(`ACCOUNT_${accountStatus}`);
    }
  });

  it('is idempotent for repeated and concurrent requests', async () => {
    const context = createApplicationSubmissionTestContext();
    const [first, second] = await Promise.all([
      auth(request(context.app).post(submitPath())).send(),
      auth(request(context.app).post(submitPath())).send(),
    ]);
    expect([first.status, second.status]).toEqual([200, 200]);
    expect(
      [first.body.meta.submitted_now, second.body.meta.submitted_now].sort(),
    ).toEqual([false, true]);
    const repeated = await auth(request(context.app).post(submitPath())).send();
    expect(repeated.status).toBe(200);
    expect(repeated.body.meta.submitted_now).toBe(false);
    expect(context.historyRecords).toHaveLength(1);
  });

  it('rejects a later application state with a stable conflict', async () => {
    const context = createApplicationSubmissionTestContext({
      applicationRecords: [
        makeSubmissionApplication({
          status: 'UNDER_REVIEW',
          submitted_at: '2026-08-22T12:00:00.000Z',
        }),
      ],
    });
    const response = await auth(request(context.app).post(submitPath())).send();
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('APPLICATION_NOT_SUBMITTABLE');
  });

  it('maps commit-boundary readiness races without partial writes', async () => {
    const context = createApplicationSubmissionTestContext({
      transactionOutcomeOnce: {
        outcome: 'INCOMPLETE',
        missing_question_ids: [SUBMISSION_QUESTION_ID],
      },
    });
    const response = await auth(request(context.app).post(submitPath())).send();
    expect(response.status).toBe(422);
    expect(response.body.error.fields.missing_question_ids).toEqual([
      SUBMISSION_QUESTION_ID,
    ]);
    expect(context.applicationRecords[0].status).toBe('DRAFT');
    expect(context.historyRecords).toHaveLength(0);
  });

  it('keeps draft and answer editing blocked after submission', async () => {
    const context = createApplicationSubmissionTestContext();
    await auth(request(context.app).post(submitPath())).send();
    const draftEdit = await auth(
      request(context.app).patch(`/api/v1/applications/${APPLICATION_IDS.a}`),
    ).send({ number_of_occupants: 3 });
    const answerEdit = await auth(
      request(context.app).put(
        `/api/v1/applications/${APPLICATION_IDS.a}/answers`,
      ),
    ).send({
      answers: [
        { question_id: SUBMISSION_QUESTION_ID, answer_text: 'Changed' },
      ],
    });
    expect(draftEdit.status).toBe(409);
    expect(draftEdit.body.error.code).toBe('APPLICATION_NOT_EDITABLE');
    expect(answerEdit.status).toBe(409);
    expect(answerEdit.body.error.code).toBe('APPLICATION_NOT_EDITABLE');
  });

  it('requires authentication and validates the application UUID', async () => {
    const context = createApplicationSubmissionTestContext();
    expect((await request(context.app).post(submitPath()).send()).status).toBe(
      401,
    );
    const invalid = await auth(
      request(context.app).post('/api/v1/applications/not-a-uuid/submit'),
    ).send();
    expect(invalid.status).toBe(422);
    expect(invalid.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('does not trust a tenant identifier in the request body', async () => {
    const context = createApplicationSubmissionTestContext();
    const response = await auth(request(context.app).post(submitPath())).send({
      tenant_id: TENANT_PROFILE_IDS.b,
      status: 'ACCEPTED',
      submitted_at: '2000-01-01T00:00:00.000Z',
    });
    expect(response.status).toBe(200);
    expect(context.historyRecords[0].changed_by_user_id).toBe(
      TEST_USERS.tenant,
    );
    expect(context.applicationRecords[0].tenant_id).toBe(TENANT_PROFILE_IDS.a);
    expect(context.applicationRecords[0].status).toBe('SUBMITTED');
  });
});
