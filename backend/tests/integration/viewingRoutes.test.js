import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeProfile, TEST_USERS } from '../helpers/createAuthTestContext.js';
import { APPLICATION_IDS } from '../helpers/createApplicationTestContext.js';
import {
  createViewingTestContext,
  VIEWING_ID,
} from '../helpers/createViewingTestContext.js';

const auth = (operation, token) =>
  operation.set('Authorization', `Bearer ${token}`);
const proposePath = `/api/v1/landlord/applications/${APPLICATION_IDS.a}/viewings`;
const listPath = `/api/v1/applications/${APPLICATION_IDS.a}/viewings`;
const actionPath = (action) => `/api/v1/viewings/${VIEWING_ID}/${action}`;
const proposal = {
  start_time: '2099-09-12T10:00:00.000Z',
  end_time: '2099-09-12T10:30:00.000Z',
  notes: 'Meet at the entrance.',
};

describe('viewing workflow', () => {
  it('atomically proposes the first viewing and attributes application history', async () => {
    const context = createViewingTestContext();
    const response = await auth(
      request(context.app).post(proposePath),
      'landlord-token',
    ).send(proposal);
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      id: VIEWING_ID,
      status: 'PROPOSED',
      notes: proposal.notes,
    });
    expect(response.body.data).not.toHaveProperty('proposed_by_user_id');
    expect(context.application.status).toBe('VIEWING_INVITED');
    expect(context.history).toEqual([
      {
        from_status: 'SHORTLISTED',
        to_status: 'VIEWING_INVITED',
        changed_by_user_id: TEST_USERS.landlord,
      },
    ]);
  });

  it.each(['VIEWING_INVITED'])(
    'allows another proposal in %s after prior viewings close',
    async (applicationStatus) => {
      const context = createViewingTestContext({ applicationStatus });
      const response = await auth(
        request(context.app).post(proposePath),
        'landlord-token',
      ).send(proposal);
      expect(response.status).toBe(201);
      expect(context.history).toHaveLength(0);
    },
  );

  it('blocks a second open viewing and invalid application states', async () => {
    const open = createViewingTestContext({
      applicationStatus: 'VIEWING_INVITED',
      viewingStatus: 'PROPOSED',
    });
    expect(
      (
        await auth(request(open.app).post(proposePath), 'landlord-token').send(
          proposal,
        )
      ).body.error.code,
    ).toBe('OPEN_VIEWING_EXISTS');
    for (const status of [
      'DRAFT',
      'SUBMITTED',
      'UNDER_REVIEW',
      'REJECTED',
      'WITHDRAWN',
      'VIEWING_COMPLETED',
      'ACCEPTED',
    ]) {
      const context = createViewingTestContext({ applicationStatus: status });
      const response = await auth(
        request(context.app).post(proposePath),
        'landlord-token',
      ).send(proposal);
      expect([404, 409]).toContain(response.status);
    }
  });

  it('validates future time, ordering, notes, and protected fields', async () => {
    const context = createViewingTestContext();
    for (const body of [
      { ...proposal, start_time: '2020-01-01T10:00:00.000Z' },
      { ...proposal, end_time: '2099-09-12T09:00:00.000Z' },
      { ...proposal, notes: 'x'.repeat(1001) },
      { ...proposal, application_id: APPLICATION_IDS.a },
      { ...proposal, proposed_by_user_id: TEST_USERS.other },
      { ...proposal, status: 'COMPLETED' },
    ]) {
      const response = await auth(
        request(context.app).post(proposePath),
        'landlord-token',
      ).send(body);
      expect(response.status).toBe(422);
    }
  });

  it.each([
    ['confirm', 'tenant-token', 'PROPOSED', 'CONFIRMED'],
    ['decline', 'tenant-token', 'PROPOSED', 'DECLINED'],
    ['cancel', 'tenant-token', 'PROPOSED', 'CANCELLED'],
    ['cancel', 'landlord-token', 'CONFIRMED', 'CANCELLED'],
    ['complete', 'landlord-token', 'CONFIRMED', 'COMPLETED'],
    ['no-show', 'landlord-token', 'CONFIRMED', 'NO_SHOW'],
  ])(
    '%s is actor-scoped and transitions %s to %s',
    async (action, token, initial, target) => {
      const context = createViewingTestContext({
        applicationStatus: 'VIEWING_INVITED',
        viewingStatus: initial,
        startTime: '2020-09-12T10:00:00.000Z',
      });
      const response = await auth(
        request(context.app).post(actionPath(action)),
        token,
      ).send();
      expect(response.status).toBe(200);
      expect(response.body.data.status).toBe(target);
      expect(response.body.meta.transitioned_now).toBe(true);
      if (action === 'complete') {
        expect(context.application.status).toBe('VIEWING_COMPLETED');
        expect(context.history).toHaveLength(1);
      } else {
        expect(context.application.status).toBe('VIEWING_INVITED');
        expect(context.history).toHaveLength(0);
      }
    },
  );

  it('makes identical actions idempotent without duplicate history', async () => {
    const context = createViewingTestContext({
      applicationStatus: 'VIEWING_INVITED',
      viewingStatus: 'CONFIRMED',
      startTime: '2020-09-12T10:00:00.000Z',
    });
    const first = await auth(
      request(context.app).post(actionPath('complete')),
      'landlord-token',
    ).send();
    const second = await auth(
      request(context.app).post(actionPath('complete')),
      'landlord-token',
    ).send();
    expect(first.body.meta.transitioned_now).toBe(true);
    expect(second.body.meta.transitioned_now).toBe(false);
    expect(context.history).toHaveLength(1);
  });

  it('returns participant-safe list and detail in deterministic form', async () => {
    const context = createViewingTestContext({
      applicationStatus: 'VIEWING_INVITED',
      viewingStatus: 'PROPOSED',
    });
    for (const [path, token] of [
      [listPath, 'tenant-token'],
      [listPath, 'landlord-token'],
      [`/api/v1/viewings/${VIEWING_ID}`, 'tenant-token'],
    ]) {
      const response = await auth(request(context.app).get(path), token);
      expect(response.status).toBe(200);
      expect(JSON.stringify(response.body)).not.toContain(
        'proposed_by_user_id',
      );
      expect(JSON.stringify(response.body)).not.toContain('application_id');
    }
  });

  it('enforces role actions, participant ownership, and authentication', async () => {
    const context = createViewingTestContext({
      applicationStatus: 'VIEWING_INVITED',
      viewingStatus: 'PROPOSED',
    });
    expect((await request(context.app).get(listPath)).status).toBe(401);
    expect(
      (
        await auth(request(context.app).post(proposePath), 'tenant-token').send(
          proposal,
        )
      ).status,
    ).toBe(403);
    expect(
      (
        await auth(
          request(context.app).post(actionPath('confirm')),
          'landlord-token',
        ).send()
      ).status,
    ).toBe(403);
    expect(
      (
        await auth(
          request(context.app).post(actionPath('complete')),
          'tenant-token',
        ).send()
      ).status,
    ).toBe(403);
    expect(
      (
        await auth(
          request(context.app).get(`/api/v1/viewings/${VIEWING_ID}`),
          'other-token',
        )
      ).status,
    ).toBe(404);
  });

  it('hides viewings from a different landlord and blocks inactive participants', async () => {
    const crossLandlord = createViewingTestContext({
      applicationStatus: 'VIEWING_INVITED',
      viewingStatus: 'PROPOSED',
      applicationProfiles: [
        makeProfile(),
        makeProfile({ id: TEST_USERS.other, role: 'LANDLORD' }),
        makeProfile({ id: TEST_USERS.landlord, role: 'LANDLORD' }),
      ],
      landlordRoleProfiles: [
        {
          id: 'b0000000-0000-4000-8000-000000000001',
          user_id: TEST_USERS.landlord,
        },
        {
          id: 'b0000000-0000-4000-8000-000000000002',
          user_id: TEST_USERS.other,
        },
      ],
    });
    expect(
      (
        await auth(
          request(crossLandlord.app).get(`/api/v1/viewings/${VIEWING_ID}`),
          'other-token',
        )
      ).status,
    ).toBe(404);

    for (const [token, profiles] of [
      [
        'tenant-token',
        [
          makeProfile({ account_status: 'SUSPENDED' }),
          makeProfile({ id: TEST_USERS.other }),
          makeProfile({ id: TEST_USERS.landlord, role: 'LANDLORD' }),
        ],
      ],
      [
        'landlord-token',
        [
          makeProfile(),
          makeProfile({ id: TEST_USERS.other }),
          makeProfile({
            id: TEST_USERS.landlord,
            role: 'LANDLORD',
            account_status: 'DELETED',
          }),
        ],
      ],
    ]) {
      const inactive = createViewingTestContext({
        applicationStatus: 'VIEWING_INVITED',
        viewingStatus: 'PROPOSED',
        applicationProfiles: profiles,
      });
      expect(
        (await auth(request(inactive.app).get(listPath), token)).status,
      ).toBe(403);
    }
  });

  it('closes conflicting transition races with one winner', async () => {
    for (const [initial, firstAction, secondAction] of [
      ['PROPOSED', 'CONFIRM', 'DECLINE'],
      ['PROPOSED', 'CONFIRM', 'CANCEL'],
      ['CONFIRMED', 'COMPLETE', 'CANCEL'],
    ]) {
      const context = createViewingTestContext({
        applicationStatus: 'VIEWING_INVITED',
        viewingStatus: initial,
        startTime: '2020-09-12T10:00:00.000Z',
      });
      const results = await Promise.all([
        context.viewings.transition({
          p_expected_viewing_status: initial,
          p_action: firstAction,
        }),
        context.viewings.transition({
          p_expected_viewing_status: initial,
          p_action: secondAction,
        }),
      ]);
      expect(results.map(({ outcome }) => outcome).sort()).toEqual([
        'INVALID_TRANSITION',
        'TRANSITIONED',
      ]);
    }
  });

  it('does not expose generic status, acceptance, messaging, or notification actions', async () => {
    const context = createViewingTestContext({
      applicationStatus: 'VIEWING_INVITED',
      viewingStatus: 'PROPOSED',
    });
    for (const path of [
      `/api/v1/viewings/${VIEWING_ID}/status`,
      `/api/v1/viewings/${VIEWING_ID}/accept`,
      `/api/v1/viewings/${VIEWING_ID}/message`,
      `/api/v1/viewings/${VIEWING_ID}/notify`,
    ]) {
      expect(
        (await auth(request(context.app).patch(path), 'tenant-token').send())
          .status,
      ).toBe(404);
    }
  });
});
