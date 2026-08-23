import request from 'supertest';
import { describe, expect, it } from 'vitest';
import {
  APPLICATION_IDS,
  createApplicationTestContext,
  makeApplication,
} from '../helpers/createApplicationTestContext.js';
import {
  makeListing,
  LISTING_IDS,
} from '../helpers/createListingTestContext.js';
import { makeProfile, TEST_USERS } from '../helpers/createAuthTestContext.js';
import { TENANT_PROFILE_IDS } from '../helpers/createSavedListingTestContext.js';

const STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'VIEWING_INVITED',
  'VIEWING_COMPLETED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
];

function auth(operation, token = 'tenant-token') {
  return operation.set('Authorization', `Bearer ${token}`);
}

function unavailableListing() {
  return makeListing({
    id: LISTING_IDS.b,
    status: 'PAUSED',
    title: 'Never expose this paused title',
    description: 'Never expose this paused description',
  });
}

function contextWithApplications(overrides = {}) {
  return createApplicationTestContext({
    listingRecords: [
      makeListing({ status: 'ACTIVE', published_at: '2026-08-01T00:00:00Z' }),
      unavailableListing(),
    ],
    applicationRecords: [
      makeApplication({
        id: APPLICATION_IDS.a,
        listing_id: LISTING_IDS.a,
        updated_at: '2026-08-22T09:00:00.000Z',
      }),
      makeApplication({
        id: APPLICATION_IDS.b,
        listing_id: LISTING_IDS.b,
        status: 'SUBMITTED',
        submitted_at: '2026-08-22T08:30:00.000Z',
        updated_at: '2026-08-22T08:30:00.000Z',
      }),
      makeApplication({
        id: 'b0000000-0000-4000-8000-000000000003',
        listing_id: LISTING_IDS.a,
        tenant_id: TENANT_PROFILE_IDS.b,
        updated_at: '2026-08-22T10:00:00.000Z',
      }),
    ],
    ...overrides,
  });
}

describe('tenant application list', () => {
  it('lists only the authenticated tenant applications in deterministic order', async () => {
    const context = contextWithApplications();
    const response = await auth(
      request(context.app).get('/api/v1/tenant/applications'),
    );

    expect(response.status).toBe(200);
    expect(response.body.data.map(({ id }) => id)).toEqual([
      APPLICATION_IDS.a,
      APPLICATION_IDS.b,
    ]);
    expect(response.body.meta).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      total_pages: 1,
    });
    expect(JSON.stringify(response.body)).not.toContain(TENANT_PROFILE_IDS.b);
  });

  it('paginates and exposes stable pagination metadata', async () => {
    const context = contextWithApplications();
    const response = await auth(
      request(context.app).get('/api/v1/tenant/applications?page=2&limit=1'),
    );
    expect(response.status).toBe(200);
    expect(response.body.data.map(({ id }) => id)).toEqual([APPLICATION_IDS.b]);
    expect(response.body.meta).toEqual({
      page: 2,
      limit: 1,
      total: 2,
      total_pages: 2,
    });
  });

  it.each(STATUSES)('accepts the approved %s status filter', async (status) => {
    const context = contextWithApplications();
    const response = await auth(
      request(context.app).get(`/api/v1/tenant/applications?status=${status}`),
    );
    expect(response.status).toBe(200);
    expect(
      response.body.data.every((application) => application.status === status),
    ).toBe(true);
  });

  it('rejects invalid status, pagination, and unknown query values', async () => {
    const context = contextWithApplications();
    for (const query of [
      'status=ACTIVE',
      'page=0',
      'limit=101',
      'private=true',
    ]) {
      const response = await auth(
        request(context.app).get(`/api/v1/tenant/applications?${query}`),
      );
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('uses a public card only while a listing remains publicly eligible', async () => {
    const context = contextWithApplications();
    const response = await auth(
      request(context.app).get('/api/v1/tenant/applications'),
    );
    const available = response.body.data.find(
      ({ id }) => id === APPLICATION_IDS.a,
    );
    const unavailable = response.body.data.find(
      ({ id }) => id === APPLICATION_IDS.b,
    );

    expect(available).toMatchObject({
      availability: 'AVAILABLE',
      listing: { id: LISTING_IDS.a },
    });
    expect(available.listing.cover_image_url).toContain(
      'https://storage.test/',
    );
    expect(unavailable).toMatchObject({
      availability: 'UNAVAILABLE',
      listing: null,
    });
    const serialized = JSON.stringify(unavailable);
    for (const forbidden of [
      'Never expose this paused title',
      'Never expose this paused description',
      'address_line_1',
      'latitude',
      'longitude',
      'landlord_id',
      'storage_path',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('requires authentication, an active account, and TENANT role', async () => {
    const base = contextWithApplications();
    expect(
      (await request(base.app).get('/api/v1/tenant/applications')).status,
    ).toBe(401);
    expect(
      (
        await auth(
          request(base.app).get('/api/v1/tenant/applications'),
          'landlord-token',
        )
      ).status,
    ).toBe(403);

    for (const account_status of ['SUSPENDED', 'DELETED']) {
      const context = contextWithApplications({
        applicationProfiles: [
          makeProfile({ account_status }),
          makeProfile({ id: TEST_USERS.landlord, role: 'LANDLORD' }),
        ],
      });
      expect(
        (await auth(request(context.app).get('/api/v1/tenant/applications')))
          .status,
      ).toBe(403);
    }
  });
});

describe('tenant application detail', () => {
  it('returns own fields, current answers, public listing presentation, and an actor-free timeline', async () => {
    const context = contextWithApplications({
      answerRecords: [
        {
          id: 'd0000000-0000-4000-8000-000000000001',
          application_id: APPLICATION_IDS.a,
          question_id: '90000000-0000-4000-8000-000000000001',
          answer_text: 'A careful answer',
          updated_at: '2026-08-22T09:00:00.000Z',
          question: {
            listing_id: LISTING_IDS.a,
            question_text: 'Why this home?',
            question_type: 'TEXT',
            is_required: true,
          },
        },
      ],
      historyRecords: [
        {
          id: 'e0000000-0000-4000-8000-000000000001',
          application_id: APPLICATION_IDS.a,
          from_status: 'DRAFT',
          to_status: 'SUBMITTED',
          changed_by_user_id: TEST_USERS.landlord,
          created_at: '2026-08-22T09:30:00.000Z',
        },
      ],
    });
    const response = await auth(
      request(context.app).get(`/api/v1/applications/${APPLICATION_IDS.a}`),
    );

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({
      listing_available: true,
      editable: true,
    });
    expect(response.body.data.answers[0]).toMatchObject({
      question_text: 'Why this home?',
      question_type: 'TEXT',
      answer_text: 'A careful answer',
    });
    expect(response.body.data.history).toEqual([
      {
        from_status: 'DRAFT',
        to_status: 'SUBMITTED',
        created_at: '2026-08-22T09:30:00.000Z',
      },
    ]);
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('changed_by_user_id');
    expect(serialized).not.toContain(TEST_USERS.landlord);
  });

  it('preserves an unavailable DRAFT without leaking listing or mutable question structure', async () => {
    const context = contextWithApplications({
      applicationRecords: [makeApplication({ listing_id: LISTING_IDS.b })],
      answerRecords: [
        {
          application_id: APPLICATION_IDS.a,
          question_id: '90000000-0000-4000-8000-000000000001',
          answer_text: 'My retained answer',
          updated_at: '2026-08-22T09:00:00.000Z',
          question: {
            listing_id: LISTING_IDS.b,
            question_text: 'Now private question',
            question_type: 'TEXT',
          },
        },
      ],
    });
    const response = await auth(
      request(context.app).get(`/api/v1/applications/${APPLICATION_IDS.a}`),
    );

    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({
      listing_available: false,
      editable: false,
    });
    expect(response.body.data).toMatchObject({
      availability: 'UNAVAILABLE',
      listing: null,
    });
    expect(response.body.data.answers[0]).toEqual({
      question_id: '90000000-0000-4000-8000-000000000001',
      answer_text: 'My retained answer',
      updated_at: '2026-08-22T09:00:00.000Z',
    });
    expect(JSON.stringify(response.body)).not.toContain('Now private question');
    expect(JSON.stringify(response.body)).not.toContain(
      'Never expose this paused',
    );
  });

  it('returns a submitted application read-only while retaining locked answer snapshots', async () => {
    const context = contextWithApplications({
      applicationRecords: [
        makeApplication({
          listing_id: LISTING_IDS.b,
          status: 'SUBMITTED',
          submitted_at: '2026-08-22T09:00:00.000Z',
        }),
      ],
      answerRecords: [
        {
          application_id: APPLICATION_IDS.a,
          question_id: '90000000-0000-4000-8000-000000000001',
          answer_text: 'Submitted answer',
          updated_at: '2026-08-22T08:59:00.000Z',
          question: {
            listing_id: LISTING_IDS.b,
            question_text: 'Locked submitted question',
            question_type: 'TEXT',
            is_required: true,
          },
        },
      ],
    });
    const response = await auth(
      request(context.app).get(`/api/v1/applications/${APPLICATION_IDS.a}`),
    );
    expect(response.status).toBe(200);
    expect(response.body.meta).toEqual({
      listing_available: false,
      editable: false,
    });
    expect(response.body.data.answers[0].question_text).toBe(
      'Locked submitted question',
    );
  });

  it('does not allow one tenant to retrieve another tenant application', async () => {
    const context = contextWithApplications();
    const response = await auth(
      request(context.app).get(`/api/v1/applications/${APPLICATION_IDS.a}`),
      'other-token',
    );
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('APPLICATION_NOT_FOUND');
  });
});
