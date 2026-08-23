import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { makeProfile, TEST_USERS } from '../helpers/createAuthTestContext.js';
import {
  CONVERSATION_ID,
  createConversationTestContext,
} from '../helpers/createConversationTestContext.js';
import { LISTING_IDS } from '../helpers/createListingTestContext.js';

const auth = (operation, token) =>
  operation.set('Authorization', `Bearer ${token}`);
const createPath = `/api/v1/listings/${LISTING_IDS.a}/conversation`;
const detailPath = `/api/v1/conversations/${CONVERSATION_ID}`;

describe('conversation foundation', () => {
  it('lets an ACTIVE TENANT create a pre-application conversation with exactly two derived participants', async () => {
    const context = createConversationTestContext();
    const response = await auth(
      request(context.app).post(createPath),
      'tenant-token',
    ).send({});
    expect(response.status).toBe(201);
    expect(response.body.meta.created_now).toBe(true);
    expect(context.records).toHaveLength(1);
    expect(context.participants).toEqual([
      {
        conversation_id: CONVERSATION_ID,
        user_id: TEST_USERS.tenant,
        last_read_at: null,
      },
      {
        conversation_id: CONVERSATION_ID,
        user_id: TEST_USERS.landlord,
        last_read_at: null,
      },
    ]);
  });

  it('rejects participant mass assignment and non-tenant creation', async () => {
    const context = createConversationTestContext();
    for (const body of [
      { tenant_user_id: TEST_USERS.other },
      { landlord_user_id: TEST_USERS.other },
      { user_id: TEST_USERS.other },
      { participants: [TEST_USERS.other] },
    ]) {
      expect(
        (
          await auth(
            request(context.app).post(createPath),
            'tenant-token',
          ).send(body)
        ).status,
      ).toBe(422);
    }
    expect(
      (
        await auth(
          request(context.app).post(createPath),
          'landlord-token',
        ).send({})
      ).status,
    ).toBe(403);
  });

  it.each(['DRAFT', 'PENDING_REVIEW', 'PAUSED', 'RENTED', 'CLOSED'])(
    'hides a %s listing from new conversation creation',
    async (status) => {
      const context = createConversationTestContext({ listingStatus: status });
      const response = await auth(
        request(context.app).post(createPath),
        'tenant-token',
      ).send({});
      expect(response.status).toBe(404);
      expect(response.body.error.code).toBe('LISTING_NOT_FOUND');
    },
  );

  it('hides an archived property from new conversation creation', async () => {
    const context = createConversationTestContext({ archived: true });
    expect(
      (
        await auth(request(context.app).post(createPath), 'tenant-token').send(
          {},
        )
      ).status,
    ).toBe(404);
  });

  it('makes repeated and concurrent creation idempotent', async () => {
    const context = createConversationTestContext();
    const responses = await Promise.all(
      Array.from({ length: 8 }, () =>
        auth(request(context.app).post(createPath), 'tenant-token').send({}),
      ),
    );
    expect(responses.filter(({ status }) => status === 201)).toHaveLength(1);
    expect(
      responses.every(({ body }) => body.data.id === CONVERSATION_ID),
    ).toBe(true);
    expect(context.records).toHaveLength(1);
    expect(context.participants).toHaveLength(2);
  });

  it('lists and retrieves only participant conversations with pagination', async () => {
    const context = createConversationTestContext({ conversationExists: true });
    const list = await auth(
      request(context.app).get('/api/v1/conversations?page=1&limit=1'),
      'tenant-token',
    );
    expect(list.status).toBe(200);
    expect(list.body.meta).toEqual({
      page: 1,
      limit: 1,
      total: 1,
      total_pages: 1,
    });
    expect(list.body.data[0].id).toBe(CONVERSATION_ID);
    expect(
      (await auth(request(context.app).get(detailPath), 'landlord-token'))
        .status,
    ).toBe(200);
    expect(
      (await auth(request(context.app).get(detailPath), 'other-token')).status,
    ).toBe(404);
  });

  it('preserves access but hides tenant listing context after unavailability', async () => {
    const context = createConversationTestContext({ conversationExists: true });
    context.listing.status = 'CLOSED';
    context.records[0].listing.status = 'CLOSED';
    const tenant = await auth(
      request(context.app).get(detailPath),
      'tenant-token',
    );
    const landlord = await auth(
      request(context.app).get(detailPath),
      'landlord-token',
    );
    expect(tenant.body.data.listing_context).toEqual({
      listing_id: LISTING_IDS.a,
      availability: 'UNAVAILABLE',
      listing: null,
    });
    expect(landlord.body.data.listing_context).toEqual({
      listing_id: LISTING_IDS.a,
      availability: 'UNAVAILABLE',
      listing: {
        id: LISTING_IDS.a,
        title: context.listing.title,
        status: 'CLOSED',
      },
    });
  });

  it('serializes only minimal counterparty and privacy-safe listing fields', async () => {
    const context = createConversationTestContext({ conversationExists: true });
    for (const token of ['tenant-token', 'landlord-token']) {
      const response = await auth(request(context.app).get(detailPath), token);
      const serialized = JSON.stringify(response.body);
      for (const forbidden of [
        'tenant_user_id',
        'landlord_user_id',
        'user_id',
        'email',
        'phone',
        'income',
        'employer',
        'preferred_locations',
        'account_status',
        'address_line_1',
        'latitude',
        'longitude',
        'storage_path',
        'Supabase',
      ]) {
        expect(serialized).not.toContain(forbidden);
      }
      expect(response.body.data.counterparty).toEqual(
        expect.objectContaining({
          first_name: expect.any(String),
          last_name: expect.any(String),
          profile_photo_url: expect.anything(),
        }),
      );
    }
  });

  it('blocks missing authentication and inactive users', async () => {
    expect(
      (await request(createConversationTestContext().app).get(detailPath))
        .status,
    ).toBe(401);
    for (const accountStatus of ['SUSPENDED', 'DELETED']) {
      const context = createConversationTestContext({
        conversationExists: true,
        applicationProfiles: [
          makeProfile({ account_status: accountStatus }),
          makeProfile({ id: TEST_USERS.landlord, role: 'LANDLORD' }),
          makeProfile({ id: TEST_USERS.other }),
        ],
      });
      expect(
        (await auth(request(context.app).get(detailPath), 'tenant-token'))
          .status,
      ).toBe(403);
    }
  });

  it('does not expose message, read-state, notification, or acceptance routes', async () => {
    const context = createConversationTestContext({ conversationExists: true });
    for (const [method, path] of [
      ['post', `${detailPath}/messages`],
      ['get', `${detailPath}/messages`],
      ['post', `${detailPath}/read`],
      ['post', `${detailPath}/notify`],
      ['post', `${detailPath}/accept`],
    ]) {
      expect(
        (
          await auth(request(context.app)[method](path), 'tenant-token').send(
            {},
          )
        ).status,
      ).toBe(404);
    }
  });
});
