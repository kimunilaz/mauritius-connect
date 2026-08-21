import { createApp } from '../../src/app.js';
import {
  createAuthService,
  InvalidAccessTokenError,
} from '../../src/services/authService.js';
import { ProfileRepositoryError } from '../../src/repositories/profileRepository.js';

export const TEST_USERS = Object.freeze({
  tenant: '00000000-0000-0000-0000-000000000001',
  landlord: '00000000-0000-0000-0000-000000000002',
  other: '00000000-0000-0000-0000-000000000003',
});

export function makeProfile(overrides = {}) {
  return {
    id: TEST_USERS.tenant,
    role: 'TENANT',
    first_name: 'Test',
    last_name: 'Tenant',
    phone: null,
    profile_photo_url: null,
    phone_verified: false,
    account_status: 'ACTIVE',
    ...overrides,
  };
}

export function createAuthTestContext(initialProfiles = []) {
  const records = new Map(
    initialProfiles.map((profile) => [profile.id, makeProfile(profile)]),
  );

  const profiles = {
    async findByUserId(userId) {
      return records.get(userId) ?? null;
    },

    async create(profile) {
      if (records.has(profile.id)) {
        throw new ProfileRepositoryError('DUPLICATE');
      }

      const created = makeProfile(profile);
      records.set(profile.id, created);
      return created;
    },
  };

  const tokenIdentities = new Map([
    ['tenant-token', { userId: TEST_USERS.tenant }],
    ['landlord-token', { userId: TEST_USERS.landlord }],
    ['other-token', { userId: TEST_USERS.other }],
  ]);

  async function tokenVerifier(token) {
    const identity = tokenIdentities.get(token);

    if (!identity) {
      throw new InvalidAccessTokenError();
    }

    return Object.freeze({ userId: identity.userId });
  }

  const authService = createAuthService({ tokenVerifier, profiles });

  return {
    app: createApp({ authService }),
    authService,
    records,
  };
}
