import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeProfile, TEST_USERS } from '../helpers/createAuthTestContext.js';
import {
  APPLICATION_IDS,
  createApplicationTransitionTestContext,
} from '../helpers/createApplicationTransitionTestContext.js';

const landlordPath = (action, id = APPLICATION_IDS.a) =>
  `/api/v1/landlord/applications/${id}/${action}`;
const withdrawPath = (id = APPLICATION_IDS.a) =>
  `/api/v1/applications/${id}/withdraw`;
const auth = (builder, token) =>
  builder.set('Authorization', `Bearer ${token}`);

describe('explicit application state actions', () => {
  it.each([
    ['SUBMITTED', 'review', 'UNDER_REVIEW'],
    ['SUBMITTED', 'reject', 'REJECTED'],
    ['UNDER_REVIEW', 'shortlist', 'SHORTLISTED'],
    ['UNDER_REVIEW', 'reject', 'REJECTED'],
    ['SHORTLISTED', 'reject', 'REJECTED'],
  ])(
    'allows landlord %s through %s to %s',
    async (initialStatus, action, targetStatus) => {
      const context = createApplicationTransitionTestContext({ initialStatus });
      const response = await auth(
        request(context.app).post(landlordPath(action)),
        'landlord-token',
      ).send({ status: 'ACCEPTED', changed_by_user_id: TEST_USERS.other });
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: { status: targetStatus },
        meta: { transitioned_now: true },
      });
      expect(context.historyRecords).toEqual([
        {
          application_id: APPLICATION_IDS.a,
          from_status: initialStatus,
          to_status: targetStatus,
          changed_by_user_id: TEST_USERS.landlord,
        },
      ]);
      expect(context.transitionCalls[0]).toMatchObject({
        actorUserId: TEST_USERS.landlord,
        actorRole: 'LANDLORD',
        expectedStatus: initialStatus,
        targetStatus,
      });
    },
  );

  it.each(['SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED'])(
    'allows the owning tenant to withdraw from %s',
    async (initialStatus) => {
      const context = createApplicationTransitionTestContext({ initialStatus });
      const response = await auth(
        request(context.app).post(withdrawPath()),
        'tenant-token',
      ).send({ status: 'ACCEPTED', tenant_id: TEST_USERS.other });
      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe('WITHDRAWN');
      expect(context.applicationRecords[0].withdrawn_at).not.toBeNull();
      expect(context.historyRecords[0]).toMatchObject({
        from_status: initialStatus,
        to_status: 'WITHDRAWN',
        changed_by_user_id: TEST_USERS.tenant,
      });
    },
  );

  it('makes identical repeated actions idempotent without duplicate history', async () => {
    const context = createApplicationTransitionTestContext();
    const first = await auth(
      request(context.app).post(landlordPath('review')),
      'landlord-token',
    ).send();
    const second = await auth(
      request(context.app).post(landlordPath('review')),
      'landlord-token',
    ).send();
    expect(first.body.meta.transitioned_now).toBe(true);
    expect(second.body.meta.transitioned_now).toBe(false);
    expect(context.historyRecords).toHaveLength(1);
  });

  it.each([
    ['DRAFT', 'review'],
    ['SUBMITTED', 'shortlist'],
    ['REJECTED', 'review'],
    ['WITHDRAWN', 'reject'],
  ])('blocks invalid landlord %s / %s actions', async (status, action) => {
    const context = createApplicationTransitionTestContext({
      initialStatus: status,
    });
    const response = await auth(
      request(context.app).post(landlordPath(action)),
      'landlord-token',
    ).send();
    expect(response.status).toBe(status === 'DRAFT' ? 404 : 409);
    expect(response.body.error.code).toBe(
      status === 'DRAFT'
        ? 'APPLICATION_NOT_FOUND'
        : 'INVALID_APPLICATION_TRANSITION',
    );
    expect(context.historyRecords).toHaveLength(0);
  });

  it.each(['DRAFT', 'REJECTED'])(
    'blocks tenant withdrawal from %s',
    async (status) => {
      const context = createApplicationTransitionTestContext({
        initialStatus: status,
      });
      const response = await auth(
        request(context.app).post(withdrawPath()),
        'tenant-token',
      ).send();
      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('INVALID_APPLICATION_TRANSITION');
      expect(context.historyRecords).toHaveLength(0);
    },
  );

  it('hides DRAFT and other-landlord applications from landlord actions', async () => {
    const draft = createApplicationTransitionTestContext({
      initialStatus: 'DRAFT',
    });
    expect(
      (
        await auth(
          request(draft.app).post(landlordPath('reject')),
          'landlord-token',
        ).send()
      ).status,
    ).toBe(404);
    expect(draft.transitionCalls).toHaveLength(0);

    const other = createApplicationTransitionTestContext();
    const response = await auth(
      request(other.app).post(landlordPath('reject')),
      'other-token',
    ).send();
    expect(response.status).toBe(404);
    expect(other.transitionCalls).toHaveLength(0);
  });

  it('requires the correct ACTIVE role and verified ownership', async () => {
    const normal = createApplicationTransitionTestContext();
    expect(
      (await request(normal.app).post(landlordPath('review'))).status,
    ).toBe(401);
    expect(
      (
        await auth(
          request(normal.app).post(landlordPath('review')),
          'tenant-token',
        ).send()
      ).status,
    ).toBe(403);
    expect(
      (
        await auth(
          request(normal.app).post(withdrawPath()),
          'landlord-token',
        ).send()
      ).status,
    ).toBe(403);

    for (const accountStatus of ['SUSPENDED', 'DELETED']) {
      const context = createApplicationTransitionTestContext({
        applicationProfiles: [
          makeProfile({ account_status: accountStatus }),
          makeProfile({
            id: TEST_USERS.landlord,
            role: 'LANDLORD',
            account_status: accountStatus,
          }),
          makeProfile({ id: TEST_USERS.other }),
        ],
      });
      expect(
        (
          await auth(
            request(context.app).post(withdrawPath()),
            'tenant-token',
          ).send()
        ).status,
      ).toBe(403);
      expect(
        (
          await auth(
            request(context.app).post(landlordPath('review')),
            'landlord-token',
          ).send()
        ).status,
      ).toBe(403);
    }
  });

  it('continues historical workflow after the listing stops being public', async () => {
    const context = createApplicationTransitionTestContext({
      listingStatus: 'CLOSED',
    });
    const response = await auth(
      request(context.app).post(landlordPath('review')),
      'landlord-token',
    ).send();
    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe('UNDER_REVIEW');
  });

  it('exposes no generic status or legacy viewing transition route', async () => {
    const context = createApplicationTransitionTestContext();
    for (const [method, path, token] of [
      [
        'patch',
        `/api/v1/applications/${APPLICATION_IDS.a}/status`,
        'tenant-token',
      ],
      [
        'post',
        `/api/v1/applications/${APPLICATION_IDS.a}/accept`,
        'tenant-token',
      ],
      [
        'post',
        `/api/v1/landlord/applications/${APPLICATION_IDS.a}/invite-viewing`,
        'landlord-token',
      ],
    ]) {
      const response = await auth(
        request(context.app)[method](path),
        token,
      ).send();
      expect(response.status).toBe(404);
    }
  });

  it('exposes the dedicated landlord acceptance action added by TASK-024', async () => {
    const calls = [];
    const context = createApplicationTransitionTestContext({
      initialStatus: 'VIEWING_COMPLETED',
      acceptanceService: {
        async accept(userId, applicationId) {
          calls.push({ userId, applicationId });
          return {
            application_status: 'ACCEPTED',
            listing_status: 'RENTED',
            transitioned: true,
          };
        },
      },
    });
    const response = await auth(
      request(context.app).post(
        `/api/v1/landlord/applications/${APPLICATION_IDS.a}/accept`,
      ),
      'landlord-token',
    ).send();

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({
      application_status: 'ACCEPTED',
      listing_status: 'RENTED',
      transitioned: true,
    });
    expect(calls).toEqual([
      {
        userId: TEST_USERS.landlord,
        applicationId: APPLICATION_IDS.a,
      },
    ]);
  });

  it('allows at most one different target racing from the same observed status', async () => {
    const context = createApplicationTransitionTestContext();
    const application = context.applicationRecords[0];
    const observedStatus = application.status;
    const first = context.transitions.transition({
      applicationId: application.id,
      actorUserId: TEST_USERS.landlord,
      actorRole: 'LANDLORD',
      expectedStatus: observedStatus,
      targetStatus: 'UNDER_REVIEW',
    });
    const second = context.transitions.transition({
      applicationId: application.id,
      actorUserId: TEST_USERS.tenant,
      actorRole: 'TENANT',
      expectedStatus: observedStatus,
      targetStatus: 'WITHDRAWN',
    });
    const settled = await Promise.allSettled([first, second]);
    expect(observedStatus).toBe('SUBMITTED');
    const outcomes = settled.map(({ value }) => value.outcome).sort();
    expect(outcomes).toEqual(['INVALID_TRANSITION', 'TRANSITIONED']);
    expect(context.historyRecords).toHaveLength(1);
  });
});
