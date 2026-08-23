import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeProfile, TEST_USERS } from '../helpers/createAuthTestContext.js';
import {
  ANSWER_IDS,
  ANSWER_QUESTION_IDS,
  createApplicationAnswerTestContext,
  makeAnswer,
} from '../helpers/createApplicationAnswerTestContext.js';
import {
  APPLICATION_IDS,
  makeApplication,
} from '../helpers/createApplicationTestContext.js';
import { makeListing } from '../helpers/createListingTestContext.js';
import { TENANT_PROFILE_IDS } from '../helpers/createSavedListingTestContext.js';

const answersPath = (applicationId = APPLICATION_IDS.a) =>
  `/api/v1/applications/${applicationId}/answers`;
const auth = (builder, token = 'tenant-token') =>
  builder.set('Authorization', `Bearer ${token}`);

describe('draft application answer reads and ownership', () => {
  it('returns the owning tenant answers in question order through a safe serializer', async () => {
    const context = createApplicationAnswerTestContext({
      answerRecords: [
        makeAnswer({
          question_id: ANSWER_QUESTION_IDS.number,
          answer_text: '3',
        }),
        makeAnswer({
          id: '93000000-0000-4000-8000-000000000002',
          question_id: ANSWER_QUESTION_IDS.text,
        }),
      ],
    });
    const response = await auth(request(context.app).get(answersPath()));
    expect(response.status).toBe(200);
    expect(response.body.data.map((answer) => answer.question_id)).toEqual([
      ANSWER_QUESTION_IDS.text,
      ANSWER_QUESTION_IDS.number,
    ]);
    expect(Object.keys(response.body.data[0])).toEqual([
      'question_id',
      'answer_text',
      'updated_at',
    ]);
    for (const forbidden of [
      'application_id',
      'tenant_id',
      'listing_id',
      'landlord_id',
      'question_text',
      'created_at',
    ]) {
      expect(JSON.stringify(response.body)).not.toContain(forbidden);
    }
  });

  it('allows answer reads after the listing becomes unavailable', async () => {
    const context = createApplicationAnswerTestContext({
      listingRecords: [makeListing({ status: 'PAUSED' })],
      answerRecords: [makeAnswer()],
    });
    const response = await auth(request(context.app).get(answersPath()));
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      {
        question_id: ANSWER_QUESTION_IDS.text,
        answer_text: 'Existing answer',
        updated_at: '2026-08-22T10:00:00.000Z',
      },
    ]);
  });

  it('returns 404 for Tenant B reading or changing Tenant A answers', async () => {
    const context = createApplicationAnswerTestContext({
      answerRecords: [makeAnswer()],
    });
    const getResponse = await auth(
      request(context.app).get(answersPath()),
      'other-token',
    );
    const putResponse = await auth(
      request(context.app).put(answersPath()),
      'other-token',
    ).send({ answers: [] });
    expect(getResponse.status).toBe(404);
    expect(putResponse.status).toBe(404);
    expect(context.answerRecords).toHaveLength(1);
  });
});

describe('draft answer type validation and persistence', () => {
  it('creates and canonicalizes all five answer types', async () => {
    const context = createApplicationAnswerTestContext();
    const response = await auth(request(context.app).put(answersPath())).send({
      answers: [
        {
          question_id: ANSWER_QUESTION_IDS.text,
          answer_text: '  Quiet household  ',
        },
        {
          question_id: ANSWER_QUESTION_IDS.number,
          answer_text: '01.50',
        },
        {
          question_id: ANSWER_QUESTION_IDS.boolean,
          answer_text: 'true',
        },
        {
          question_id: ANSWER_QUESTION_IDS.date,
          answer_text: '2026-12-15',
        },
        {
          question_id: ANSWER_QUESTION_IDS.select,
          answer_text: '12 months',
        },
      ],
    });
    expect(response.status).toBe(200);
    expect(response.body.data.map((answer) => answer.answer_text)).toEqual([
      'Quiet household',
      '1.5',
      'true',
      '2026-12-15',
      '12 months',
    ]);
    expect(context.answerRecords).toHaveLength(5);
  });

  it('updates an existing answer without creating a duplicate row', async () => {
    const context = createApplicationAnswerTestContext({
      answerRecords: [makeAnswer()],
    });
    const response = await auth(request(context.app).put(answersPath())).send({
      answers: [
        {
          question_id: ANSWER_QUESTION_IDS.text,
          answer_text: 'Updated answer',
        },
      ],
    });
    expect(response.status).toBe(200);
    expect(context.answerRecords).toHaveLength(1);
    expect(context.answerRecords[0].answer_text).toBe('Updated answer');
  });

  it('clears rows with null, empty, or whitespace-only values', async () => {
    const context = createApplicationAnswerTestContext({
      answerRecords: [
        makeAnswer(),
        makeAnswer({
          id: '93000000-0000-4000-8000-000000000002',
          question_id: ANSWER_QUESTION_IDS.number,
          answer_text: '2',
        }),
        makeAnswer({
          id: '93000000-0000-4000-8000-000000000003',
          question_id: ANSWER_QUESTION_IDS.boolean,
          answer_text: 'false',
        }),
      ],
    });
    const response = await auth(request(context.app).put(answersPath())).send({
      answers: [
        { question_id: ANSWER_QUESTION_IDS.text, answer_text: null },
        { question_id: ANSWER_QUESTION_IDS.number, answer_text: '' },
        { question_id: ANSWER_QUESTION_IDS.boolean, answer_text: '   ' },
      ],
    });
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(context.answerRecords).toHaveLength(0);
  });

  it('allows required questions to remain unanswered in a DRAFT', async () => {
    const context = createApplicationAnswerTestContext();
    const response = await auth(request(context.app).put(answersPath())).send({
      answers: [],
    });
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
  });

  it('updates only supplied questions and preserves omitted answers', async () => {
    const context = createApplicationAnswerTestContext({
      answerRecords: [
        makeAnswer(),
        makeAnswer({
          id: '93000000-0000-4000-8000-000000000002',
          question_id: ANSWER_QUESTION_IDS.number,
          answer_text: '2',
        }),
      ],
    });
    await auth(request(context.app).put(answersPath())).send({
      answers: [
        {
          question_id: ANSWER_QUESTION_IDS.text,
          answer_text: 'Changed',
        },
      ],
    });
    expect(context.answerRecords).toEqual([
      expect.objectContaining({ answer_text: 'Changed' }),
      expect.objectContaining({ answer_text: '2' }),
    ]);
  });

  it.each([
    [ANSWER_QUESTION_IDS.number, 'NaN', 'valid finite number'],
    [ANSWER_QUESTION_IDS.number, 'Infinity', 'valid finite number'],
    [ANSWER_QUESTION_IDS.number, '12abc', 'valid finite number'],
    [ANSWER_QUESTION_IDS.boolean, 'yes', 'Choose Yes or No'],
    [ANSWER_QUESTION_IDS.boolean, 'TRUE', 'Choose Yes or No'],
    [ANSWER_QUESTION_IDS.date, '2026-02-30', 'valid date'],
    [ANSWER_QUESTION_IDS.date, 'not-a-date', 'valid date'],
    [ANSWER_QUESTION_IDS.select, 'Invented option', 'current option'],
  ])(
    'rejects invalid typed answer %s = %s',
    async (questionId, value, message) => {
      const context = createApplicationAnswerTestContext();
      const response = await auth(request(context.app).put(answersPath())).send(
        {
          answers: [{ question_id: questionId, answer_text: value }],
        },
      );
      expect(response.status).toBe(422);
      expect(response.body.error.fields['answers.0.answer_text']).toContain(
        message,
      );
      expect(context.answerRecords).toHaveLength(0);
    },
  );

  it('rejects an option that belongs to another SELECT question', async () => {
    const context = createApplicationAnswerTestContext();
    const response = await auth(request(context.app).put(answersPath())).send({
      answers: [
        {
          question_id: ANSWER_QUESTION_IDS.select,
          answer_text: 'Other option',
        },
      ],
    });
    expect(response.status).toBe(422);
    expect(context.answerRecords).toHaveLength(0);
  });

  it('rejects a question from another listing without revealing it', async () => {
    const context = createApplicationAnswerTestContext();
    const response = await auth(request(context.app).put(answersPath())).send({
      answers: [
        {
          question_id: ANSWER_QUESTION_IDS.otherListing,
          answer_text: 'Other option',
        },
      ],
    });
    expect(response.status).toBe(422);
    expect(response.body.error.fields['answers.0.question_id']).toContain(
      'does not belong',
    );
  });

  it('rejects duplicate question IDs in one request', async () => {
    const context = createApplicationAnswerTestContext();
    const response = await auth(request(context.app).put(answersPath())).send({
      answers: [
        { question_id: ANSWER_QUESTION_IDS.text, answer_text: 'One' },
        { question_id: ANSWER_QUESTION_IDS.text, answer_text: 'Two' },
      ],
    });
    expect(response.status).toBe(422);
    expect(context.answerRecords).toHaveLength(0);
  });

  it('concurrent upserts preserve one row per application and question', async () => {
    const context = createApplicationAnswerTestContext();
    const responses = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        auth(request(context.app).put(answersPath())).send({
          answers: [
            {
              question_id: ANSWER_QUESTION_IDS.text,
              answer_text: `Concurrent ${index}`,
            },
          ],
        }),
      ),
    );
    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(context.answerRecords).toHaveLength(1);
  });

  it('compensates earlier upserts if a later clear operation fails', async () => {
    const context = createApplicationAnswerTestContext({
      failDeleteOnce: true,
      answerRecords: [
        makeAnswer(),
        makeAnswer({
          id: ANSWER_IDS.b,
          question_id: ANSWER_QUESTION_IDS.number,
          answer_text: '2',
        }),
      ],
    });
    const response = await auth(request(context.app).put(answersPath())).send({
      answers: [
        { question_id: ANSWER_QUESTION_IDS.text, answer_text: 'Changed' },
        { question_id: ANSWER_QUESTION_IDS.number, answer_text: null },
      ],
    });
    expect(response.status).toBe(500);
    expect(context.answerRecords).toEqual([
      expect.objectContaining({ answer_text: 'Existing answer' }),
      expect.objectContaining({ answer_text: '2' }),
    ]);
  });
});

describe('draft answer authorization and protected state', () => {
  it.each([
    'application_id',
    'tenant_id',
    'listing_id',
    'created_at',
    'updated_at',
  ])('rejects protected answer field %s', async (field) => {
    const context = createApplicationAnswerTestContext();
    const response = await auth(request(context.app).put(answersPath())).send({
      answers: [
        {
          question_id: ANSWER_QUESTION_IDS.text,
          answer_text: 'Hello',
          [field]: 'attacker-controlled',
        },
      ],
    });
    expect(response.status).toBe(422);
    expect(context.answerRecords).toHaveLength(0);
  });

  it.each(['application_id', 'tenant_id', 'listing_id', 'status'])(
    'rejects protected top-level field %s',
    async (field) => {
      const context = createApplicationAnswerTestContext();
      const response = await auth(request(context.app).put(answersPath())).send(
        {
          answers: [],
          [field]: 'attacker-controlled',
        },
      );
      expect(response.status).toBe(422);
    },
  );

  it('blocks answer mutation for a non-DRAFT application', async () => {
    const context = createApplicationAnswerTestContext({
      applicationRecords: [
        makeApplication({
          status: 'SUBMITTED',
          submitted_at: '2026-08-22T12:00:00.000Z',
        }),
      ],
    });
    const response = await auth(request(context.app).put(answersPath())).send({
      answers: [],
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('APPLICATION_NOT_EDITABLE');
  });

  it('blocks mutation but not reading after the listing becomes unavailable', async () => {
    const context = createApplicationAnswerTestContext({
      listingRecords: [makeListing({ status: 'CLOSED' })],
      answerRecords: [makeAnswer()],
    });
    const response = await auth(request(context.app).put(answersPath())).send({
      answers: [
        { question_id: ANSWER_QUESTION_IDS.text, answer_text: 'Changed' },
      ],
    });
    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe('LISTING_NOT_AVAILABLE');
    expect(context.answerRecords[0].answer_text).toBe('Existing answer');
  });

  it.each(['GET', 'PUT'])(
    'requires authentication for %s answers',
    async (method) => {
      const context = createApplicationAnswerTestContext();
      const testClient = request(context.app);
      const response = await testClient[method.toLowerCase()](
        answersPath(),
      ).send(method === 'PUT' ? { answers: [] } : undefined);
      expect(response.status).toBe(401);
    },
  );

  it('blocks LANDLORD answer access and mutation', async () => {
    const context = createApplicationAnswerTestContext();
    const response = await auth(
      request(context.app).put(answersPath()),
      'landlord-token',
    ).send({ answers: [] });
    expect(response.status).toBe(403);
  });

  it.each(['SUSPENDED', 'DELETED'])(
    'blocks a %s tenant before answer access',
    async (accountStatus) => {
      const context = createApplicationAnswerTestContext({
        applicationProfiles: [
          makeProfile({ account_status: accountStatus }),
          makeProfile({ id: TEST_USERS.other }),
          makeProfile({ id: TEST_USERS.landlord, role: 'LANDLORD' }),
        ],
      });
      const response = await auth(request(context.app).get(answersPath()));
      expect(response.status).toBe(403);
    },
  );

  it('isolates a second tenant application and answer row', async () => {
    const context = createApplicationAnswerTestContext({
      applicationRecords: [
        makeApplication(),
        makeApplication({
          id: APPLICATION_IDS.b,
          tenant_id: TENANT_PROFILE_IDS.b,
        }),
      ],
    });
    const response = await auth(
      request(context.app).put(answersPath(APPLICATION_IDS.b)),
      'other-token',
    ).send({
      answers: [
        { question_id: ANSWER_QUESTION_IDS.text, answer_text: 'Tenant B' },
      ],
    });
    expect(response.status).toBe(200);
    expect(context.answerRecords[0]).toMatchObject({
      application_id: APPLICATION_IDS.b,
      answer_text: 'Tenant B',
    });
  });
});
