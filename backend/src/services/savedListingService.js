import { AppError } from '../middleware/AppError.js';
import {
  savedListingRepository,
  SavedListingRepositoryError,
} from '../repositories/savedListingRepository.js';
import {
  serializeSavedListing,
  serializeSavedStatus,
} from '../serializers/savedListingSerializer.js';
import { profileService as defaultProfileService } from './profileService.js';
import { publicListingService as defaultPublicListingService } from './publicListingService.js';

function listingNotFound() {
  return new AppError({
    statusCode: 404,
    code: 'LISTING_NOT_FOUND',
    message: 'Listing not found.',
  });
}

export function createSavedListingService({
  saves = savedListingRepository,
  profiles = defaultProfileService,
  publicListings = defaultPublicListingService,
} = {}) {
  async function tenantFor(userId) {
    return profiles.ensureTenantProfile(userId);
  }

  return Object.freeze({
    async save(userId, listingId) {
      const tenant = await tenantFor(userId);
      if (await saves.isSavedByTenant(tenant.id, listingId)) {
        return serializeSavedStatus(listingId, true);
      }
      if (!(await publicListings.isEligible(listingId))) {
        throw listingNotFound();
      }
      try {
        await saves.createForTenant(tenant.id, listingId);
      } catch (error) {
        if (
          !(error instanceof SavedListingRepositoryError) ||
          error.reason !== 'DUPLICATE'
        ) {
          throw error;
        }
      }
      return serializeSavedStatus(listingId, true);
    },

    async remove(userId, listingId) {
      const tenant = await tenantFor(userId);
      await saves.deleteForTenant(tenant.id, listingId);
    },

    async status(userId, listingId) {
      const tenant = await tenantFor(userId);
      return serializeSavedStatus(
        listingId,
        await saves.isSavedByTenant(tenant.id, listingId),
      );
    },

    async list(userId, query) {
      const tenant = await tenantFor(userId);
      const result = await saves.listForTenant(tenant.id, query);
      return {
        total: result.total,
        saves: await Promise.all(
          result.saves.map(async (save) =>
            serializeSavedListing(
              save,
              await publicListings.presentCard(save.listing),
            ),
          ),
        ),
      };
    },
  });
}

export const savedListingService = createSavedListingService();
