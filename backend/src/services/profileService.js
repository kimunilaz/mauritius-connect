import { AppError } from '../middleware/AppError.js';
import { profileRepository } from '../repositories/profileRepository.js';
import {
  landlordProfileRepository,
  preferredLocationRepository,
  RoleProfileRepositoryError,
  tenantProfileRepository,
} from '../repositories/roleProfileRepository.js';

async function ensureRoleProfile(repository, userId) {
  const existing = await repository.findByUserId(userId);
  if (existing) return existing;

  try {
    return await repository.create(userId);
  } catch (error) {
    if (
      error instanceof RoleProfileRepositoryError &&
      error.reason === 'DUPLICATE'
    ) {
      const concurrentRecord = await repository.findByUserId(userId);
      if (concurrentRecord) return concurrentRecord;
    }
    throw error;
  }
}

function normalizedLocationKey(location) {
  return ['district', 'locality', 'neighbourhood']
    .map((field) => (location[field] ?? '').trim().toLocaleLowerCase('en'))
    .join('|');
}

export function createProfileService({
  profiles = profileRepository,
  tenantProfiles = tenantProfileRepository,
  landlordProfiles = landlordProfileRepository,
  locations = preferredLocationRepository,
} = {}) {
  async function requireMatchingRole(userId, expectedRole) {
    const applicationProfile = await profiles.findByUserId(userId);
    if (!applicationProfile || applicationProfile.role !== expectedRole) {
      throw new AppError({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'You do not have permission to perform this action.',
      });
    }
  }

  async function ensureTenantProfile(userId) {
    await requireMatchingRole(userId, 'TENANT');
    return ensureRoleProfile(tenantProfiles, userId);
  }

  async function ensureLandlordProfile(userId) {
    await requireMatchingRole(userId, 'LANDLORD');
    return ensureRoleProfile(landlordProfiles, userId);
  }

  return Object.freeze({
    ensureTenantProfile,
    ensureLandlordProfile,

    async updateTenantProfile(userId, fields) {
      await ensureTenantProfile(userId);
      return tenantProfiles.update(userId, fields);
    },

    updateBaseProfile(userId, fields) {
      return profiles.updateBaseFields(userId, fields);
    },

    async getLandlordProfile(userId) {
      const roleProfile = await ensureLandlordProfile(userId);
      const baseProfile = await profiles.findByUserId(userId);
      return { roleProfile, baseProfile };
    },

    async updateLandlordProfile(userId, fields) {
      await ensureLandlordProfile(userId);
      const baseProfile = await profiles.updateBaseFields(userId, fields);
      const roleProfile = await landlordProfiles.findByUserId(userId);
      return { roleProfile, baseProfile };
    },

    async listPreferredLocations(userId) {
      const tenantProfile = await ensureTenantProfile(userId);
      return locations.list(tenantProfile.id);
    },

    async addPreferredLocation(userId, location) {
      const tenantProfile = await ensureTenantProfile(userId);
      const existing = await locations.list(tenantProfile.id);
      const key = normalizedLocationKey(location);
      if (
        existing.some((candidate) => normalizedLocationKey(candidate) === key)
      ) {
        throw new AppError({
          statusCode: 409,
          code: 'CONFLICT',
          message: 'This preferred location already exists.',
        });
      }
      return locations.create(tenantProfile.id, location);
    },

    async deletePreferredLocation(userId, locationId) {
      const tenantProfile = await ensureTenantProfile(userId);
      const deleted = await locations.deleteOwned(tenantProfile.id, locationId);
      if (!deleted) {
        throw new AppError({
          statusCode: 404,
          code: 'PREFERRED_LOCATION_NOT_FOUND',
          message: 'Preferred location not found.',
        });
      }
    },
  });
}

export const profileService = createProfileService();
