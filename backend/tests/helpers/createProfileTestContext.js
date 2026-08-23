import { createApp } from '../../src/app.js';
import {
  createAuthService,
  InvalidAccessTokenError,
} from '../../src/services/authService.js';
import { createProfileService } from '../../src/services/profileService.js';
import { RoleProfileRepositoryError } from '../../src/repositories/roleProfileRepository.js';
import { makeProfile, TEST_USERS } from './createAuthTestContext.js';

const identities = new Map([
  ['tenant-token', { userId: TEST_USERS.tenant }],
  ['landlord-token', { userId: TEST_USERS.landlord }],
  ['other-token', { userId: TEST_USERS.other }],
]);

export function createProfileTestContext({
  applicationProfiles = [
    makeProfile(),
    makeProfile({
      id: TEST_USERS.landlord,
      role: 'LANDLORD',
      first_name: 'Test',
      last_name: 'Landlord',
    }),
  ],
  tenantRoleProfiles = [],
  landlordRoleProfiles = [],
  preferredLocations = [],
} = {}) {
  const profileRecords = new Map(
    applicationProfiles.map((item) => [item.id, { ...item }]),
  );
  const tenantRecords = new Map(
    tenantRoleProfiles.map((item) => [item.user_id, { ...item }]),
  );
  const landlordRecords = new Map(
    landlordRoleProfiles.map((item) => [item.user_id, { ...item }]),
  );
  const locationRecords = new Map(
    preferredLocations.map((item) => [item.id, { ...item }]),
  );
  let sequence = 10;

  const profiles = {
    async findByUserId(userId) {
      return profileRecords.get(userId) ?? null;
    },
    async updateBaseFields(userId, fields) {
      const updated = { ...profileRecords.get(userId), ...fields };
      profileRecords.set(userId, updated);
      return updated;
    },
  };
  const tenantProfiles = {
    async findByUserId(userId) {
      return tenantRecords.get(userId) ?? null;
    },
    async create(userId) {
      if (tenantRecords.has(userId))
        throw new RoleProfileRepositoryError('DUPLICATE');
      const created = {
        id: `10000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`,
        user_id: userId,
        occupation_type: null,
        employer_or_school: null,
        income_range: null,
        preferred_move_date: null,
        preferred_lease_duration_months: null,
        number_of_occupants: null,
        has_pets: false,
        bio: null,
      };
      tenantRecords.set(userId, created);
      return created;
    },
    async update(userId, fields) {
      const updated = { ...tenantRecords.get(userId), ...fields };
      tenantRecords.set(userId, updated);
      return updated;
    },
  };
  const landlordProfiles = {
    async findByUserId(userId) {
      return landlordRecords.get(userId) ?? null;
    },
    async create(userId) {
      if (landlordRecords.has(userId))
        throw new RoleProfileRepositoryError('DUPLICATE');
      const created = {
        id: `20000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`,
        user_id: userId,
        verification_status: 'UNVERIFIED',
      };
      landlordRecords.set(userId, created);
      return created;
    },
  };
  const locations = {
    async list(tenantProfileId) {
      return [...locationRecords.values()].filter(
        (item) => item.tenant_profile_id === tenantProfileId,
      );
    },
    async create(tenantProfileId, location) {
      const created = {
        id: `30000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`,
        tenant_profile_id: tenantProfileId,
        ...location,
      };
      locationRecords.set(created.id, created);
      return created;
    },
    async deleteOwned(tenantProfileId, locationId) {
      const location = locationRecords.get(locationId);
      if (!location || location.tenant_profile_id !== tenantProfileId)
        return false;
      locationRecords.delete(locationId);
      return true;
    },
  };

  const authService = createAuthService({
    profiles,
    tokenVerifier: async (token) => {
      const identity = identities.get(token);
      if (!identity) throw new InvalidAccessTokenError();
      return identity;
    },
  });
  const profileService = createProfileService({
    profiles,
    tenantProfiles,
    landlordProfiles,
    locations,
  });

  return {
    app: createApp({ authService, profileService }),
    authService,
    profileService,
    profileRecords,
    tenantRecords,
    landlordRecords,
    locationRecords,
  };
}
