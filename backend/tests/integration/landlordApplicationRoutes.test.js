import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeProfile, TEST_USERS } from '../helpers/createAuthTestContext.js';
import {
  createLandlordApplicationTestContext,
  LANDLORD_APPLICATION_IDS,
  makeApplicantIdentity,
} from '../helpers/createLandlordApplicationTestContext.js';
import { makeApplication } from '../helpers/createApplicationTestContext.js';
import {
  LISTING_IDS,
  makeListing,
} from '../helpers/createListingTestContext.js';
import { TENANT_PROFILE_IDS } from '../helpers/createSavedListingTestContext.js';

const VISIBLE_STATUSES = [
  'SUBMITTED',
  'UNDER_REVIEW',
  'SHORTLISTED',
  'VIEWING_INVITED',
  'VIEWING_COMPLETED',
  'ACCEPTED',
  'REJECTED',
  'WITHDRAWN',
];

function auth(operation, token = 'landlord-token') {
  return operation.set('Authorization', `Bearer ${token}`);
}

const listPath = `/api/v1/landlord/listings/${LISTING_IDS.a}/applications`;
const detailPath = (id) => `/api/v1/landlord/applications/${id}`;

describe('landlord applicant list', () => {
  it('returns submitted applications and never returns DRAFT records', async () => {
    const context = createLandlordApplicationTestContext();
    const response = await auth(request(context.app).get(listPath));
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      application_id: LANDLORD_APPLICATION_IDS.submitted,
      status: 'SUBMITTED',
      tenant: {
        first_name: 'Jane',
        last_name: 'Applicant',
        profile_photo_url: null,
      },
    });
    expect(JSON.stringify(response.body)).not.toContain(
      LANDLORD_APPLICATION_IDS.draft,
    );
  });

  it('paginates submitted applications with deterministic ordering', async () => {
    const applications = [
      makeApplication({
        id: LANDLORD_APPLICATION_IDS.submitted,
        status: 'SUBMITTED',
        submitted_at: '2026-08-22T10:00:00.000Z',
      }),
      makeApplication({
        id: LANDLORD_APPLICATION_IDS.draft,
        status: 'SUBMITTED',
        submitted_at: '2026-08-22T10:00:00.000Z',
      }),
    ];
    const context = createLandlordApplicationTestContext({
      applicationRecords: applications,
    });
    const first = await auth(
      request(context.app).get(`${listPath}?page=1&limit=1`),
    );
    const second = await auth(
      request(context.app).get(`${listPath}?page=2&limit=1`),
    );
    expect(first.body.data[0].application_id).toBe(
      LANDLORD_APPLICATION_IDS.draft,
    );
    expect(second.body.data[0].application_id).toBe(
      LANDLORD_APPLICATION_IDS.submitted,
    );
    expect(second.body.meta).toMatchObject({
      page: 2,
      limit: 1,
      total: 2,
      total_pages: 2,
    });
  });

  it.each(VISIBLE_STATUSES)(
    'accepts the approved %s filter',
    async (status) => {
      const context = createLandlordApplicationTestContext();
      const response = await auth(
        request(context.app).get(`${listPath}?status=${status}`),
      );
      expect(response.status).toBe(200);
      expect(response.body.data.every((item) => item.status === status)).toBe(
        true,
      );
    },
  );

  it('rejects DRAFT, invalid pagination, and unknown query fields', async () => {
    const context = createLandlordApplicationTestContext();
    for (const query of [
      'status=DRAFT',
      'status=ACTIVE',
      'page=0',
      'limit=101',
      'tenant_id=x',
    ]) {
      const response = await auth(
        request(context.app).get(`${listPath}?${query}`),
      );
      expect(response.status).toBe(422);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('returns an empty state without disclosing a DRAFT count', async () => {
    const context = createLandlordApplicationTestContext({
      applicationRecords: [makeApplication()],
    });
    const response = await auth(request(context.app).get(listPath));
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.meta.total).toBe(0);
  });

  it('hides another landlord listing and applicant volume', async () => {
    const context = createLandlordApplicationTestContext();
    const response = await auth(
      request(context.app).get(listPath),
      'other-token',
    );
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('LISTING_NOT_FOUND');
    expect(response.body.meta).toBeUndefined();
  });

  it('blocks TENANT, missing auth, SUSPENDED, and DELETED landlord access', async () => {
    const normal = createLandlordApplicationTestContext();
    expect(
      (await auth(request(normal.app).get(listPath), 'tenant-token')).status,
    ).toBe(403);
    expect((await request(normal.app).get(listPath)).status).toBe(401);

    for (const account_status of ['SUSPENDED', 'DELETED']) {
      const context = createLandlordApplicationTestContext({
        applicationProfiles: [
          makeProfile(),
          makeProfile({
            id: TEST_USERS.landlord,
            role: 'LANDLORD',
            account_status,
          }),
          makeProfile({ id: TEST_USERS.other, role: 'LANDLORD' }),
        ],
      });
      expect((await auth(request(context.app).get(listPath))).status).toBe(403);
    }
  });

  it('exposes only approved applicant identity and application fields', async () => {
    const context = createLandlordApplicationTestContext({
      applicantIdentities: [
        [
          TENANT_PROFILE_IDS.a,
          makeApplicantIdentity({
            profile_photo_url: 'https://images.test/profile.jpg',
            auth_user_id: TEST_USERS.tenant,
            storage_path: 'private/profile/path',
            supabase_metadata: { private: true },
          }),
        ],
      ],
    });
    const response = await auth(request(context.app).get(listPath));
    expect(Object.keys(response.body.data[0].tenant)).toEqual([
      'first_name',
      'last_name',
      'profile_photo_url',
    ]);
    const serialized = JSON.stringify(response.body);
    for (const forbidden of [
      'tenant_id',
      TEST_USERS.tenant,
      'private@example.test',
      '+23050000000',
      'account_status',
      'income_range',
      'employer_or_school',
      'occupation_type',
      'preferred_locations',
      'bio',
      'storage_path',
      'supabase_metadata',
    ])
      expect(serialized).not.toContain(forbidden);
  });
});

describe('landlord application detail', () => {
  it('returns submitted fields, understandable answers, and actor-free history', async () => {
    const context = createLandlordApplicationTestContext({
      applicationRecords: [
        makeApplication({
          id: LANDLORD_APPLICATION_IDS.submitted,
          status: 'SUBMITTED',
          submitted_at: '2026-08-22T10:00:00.000Z',
          introductory_message: 'Tenant submitted introduction',
        }),
      ],
      answerRecords: [
        {
          id: 'd0000000-0000-4000-8000-000000000001',
          application_id: LANDLORD_APPLICATION_IDS.submitted,
          question_id: '90000000-0000-4000-8000-000000000001',
          answer_text: 'Submitted answer',
          question: {
            listing_id: LISTING_IDS.a,
            question_text: 'Why this rental?',
            question_type: 'TEXT',
          },
        },
      ],
      historyRecords: [
        {
          application_id: LANDLORD_APPLICATION_IDS.submitted,
          from_status: 'DRAFT',
          to_status: 'SUBMITTED',
          created_at: '2026-08-22T10:00:00.000Z',
          changed_by_user_id: TEST_USERS.tenant,
        },
      ],
    });
    const response = await auth(
      request(context.app).get(detailPath(LANDLORD_APPLICATION_IDS.submitted)),
    );
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      status: 'SUBMITTED',
      introductory_message: 'Tenant submitted introduction',
      tenant: { first_name: 'Jane', last_name: 'Applicant' },
      listing: {
        id: LISTING_IDS.a,
        title: 'Modern apartment in Moka',
        property: { district: 'Moka', locality: 'Moka' },
      },
      answers: [
        {
          question_text: 'Why this rental?',
          question_type: 'TEXT',
          answer_text: 'Submitted answer',
        },
      ],
      history: [
        {
          from_status: 'DRAFT',
          to_status: 'SUBMITTED',
          created_at: '2026-08-22T10:00:00.000Z',
        },
      ],
    });
    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain('changed_by_user_id');
    expect(serialized).not.toContain(TEST_USERS.tenant);
    expect(serialized).not.toContain('application_id');
    expect(serialized).not.toContain('question_id');
    expect(serialized).not.toContain('address_line_1');
    expect(serialized).not.toContain('landlord_id');
  });

  it('returns 404 for a guessed DRAFT application ID', async () => {
    const context = createLandlordApplicationTestContext();
    const response = await auth(
      request(context.app).get(detailPath(LANDLORD_APPLICATION_IDS.draft)),
    );
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('APPLICATION_NOT_FOUND');
  });

  it('returns 404 to another landlord for submitted detail', async () => {
    const context = createLandlordApplicationTestContext();
    const response = await auth(
      request(context.app).get(detailPath(LANDLORD_APPLICATION_IDS.submitted)),
      'other-token',
    );
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('APPLICATION_NOT_FOUND');
  });

  it.each(['PAUSED', 'CLOSED', 'RENTED'])(
    'keeps submitted history visible after listing becomes %s',
    async (status) => {
      const context = createLandlordApplicationTestContext({
        listingRecords: [makeListing({ status })],
      });
      const response = await auth(
        request(context.app).get(
          detailPath(LANDLORD_APPLICATION_IDS.submitted),
        ),
      );
      expect(response.status).toBe(200);
      expect(response.body.data.listing.status).toBe(status);
    },
  );

  it('does not expose generic or legacy viewing mutation endpoints', async () => {
    const context = createLandlordApplicationTestContext();
    const id = LANDLORD_APPLICATION_IDS.submitted;
    const attempts = [
      request(context.app)
        .patch(`/api/v1/landlord/applications/${id}`)
        .send({ status: 'UNDER_REVIEW' }),
      request(context.app).post(
        `/api/v1/landlord/applications/${id}/under-review`,
      ),
      request(context.app).post(
        `/api/v1/landlord/applications/${id}/invite-viewing`,
      ),
      request(context.app)
        .patch(`/api/v1/applications/${id}/status`)
        .send({ status: 'UNDER_REVIEW' }),
    ];
    for (const attempt of attempts) {
      const response = await auth(attempt);
      expect(response.status).toBe(404);
    }
    expect(context.applicationRecords[0].status).toBe('SUBMITTED');
  });
});
