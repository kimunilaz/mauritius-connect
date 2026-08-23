import { createApp } from '../../src/app.js';
import { SavedListingRepositoryError } from '../../src/repositories/savedListingRepository.js';
import { createSavedListingService } from '../../src/services/savedListingService.js';
import { makeProfile, TEST_USERS } from './createAuthTestContext.js';
import { makeListing } from './createListingTestContext.js';
import { createProfileTestContext } from './createProfileTestContext.js';
import { createPublicListingTestContext } from './createPublicListingTestContext.js';

export const TENANT_PROFILE_IDS = Object.freeze({
  a: '10000000-0000-4000-8000-000000000001',
  b: '10000000-0000-4000-8000-000000000002',
});

export function makeSavedListing(overrides = {}) {
  return {
    tenant_id: TENANT_PROFILE_IDS.a,
    listing_id: '80000000-0000-4000-8000-000000000001',
    created_at: '2026-08-21T10:00:00.000Z',
    ...overrides,
  };
}

export function createSavedListingTestContext({
  listingRecords = [makeListing({ status: 'ACTIVE' })],
  propertyRecords,
  imageRecords,
  savedRecords: savedInput = [],
  applicationProfiles,
  failConcurrentCreate = false,
} = {}) {
  const profiles = createProfileTestContext({
    applicationProfiles: applicationProfiles ?? [
      makeProfile(),
      makeProfile({ id: TEST_USERS.other, first_name: 'Other' }),
      makeProfile({
        id: TEST_USERS.landlord,
        role: 'LANDLORD',
        first_name: 'Landlord',
      }),
    ],
    tenantRoleProfiles: [
      { id: TENANT_PROFILE_IDS.a, user_id: TEST_USERS.tenant },
      { id: TENANT_PROFILE_IDS.b, user_id: TEST_USERS.other },
    ],
  });
  const publicContext = createPublicListingTestContext({
    listingRecords,
    propertyRecords,
    imageRecords,
  });
  const savedRecords = savedInput.map((save) => makeSavedListing(save));

  function find(tenantId, listingId) {
    return savedRecords.find(
      (save) => save.tenant_id === tenantId && save.listing_id === listingId,
    );
  }

  const saves = {
    async createForTenant(tenantId, listingId) {
      if (find(tenantId, listingId)) {
        throw new SavedListingRepositoryError('DUPLICATE');
      }
      const created = makeSavedListing({
        tenant_id: tenantId,
        listing_id: listingId,
        created_at: '2026-08-21T12:00:00.000Z',
      });
      savedRecords.push(created);
      if (failConcurrentCreate) {
        throw new SavedListingRepositoryError('DUPLICATE');
      }
      return created;
    },

    async deleteForTenant(tenantId, listingId) {
      const index = savedRecords.findIndex(
        (save) => save.tenant_id === tenantId && save.listing_id === listingId,
      );
      if (index >= 0) savedRecords.splice(index, 1);
    },

    async isSavedByTenant(tenantId, listingId) {
      return Boolean(find(tenantId, listingId));
    },

    async listForTenant(tenantId, { page, limit }) {
      const owned = savedRecords
        .filter((save) => save.tenant_id === tenantId)
        .sort(
          (left, right) =>
            right.created_at.localeCompare(left.created_at) ||
            left.listing_id.localeCompare(right.listing_id),
        );
      const first = (page - 1) * limit;
      return {
        saves: owned.slice(first, first + limit).map((save) => {
          const listing = publicContext.listingRecords.find(
            (candidate) => candidate.id === save.listing_id,
          );
          const property = listing
            ? publicContext.propertyRecords.get(listing.property_id)
            : null;
          return {
            listing_id: save.listing_id,
            created_at: save.created_at,
            listing: listing
              ? { ...listing, property: property ? { ...property } : null }
              : null,
          };
        }),
        total: owned.length,
      };
    },
  };
  const savedListingService = createSavedListingService({
    saves,
    profiles: profiles.profileService,
    publicListings: publicContext.publicListingService,
  });

  return {
    ...profiles,
    ...publicContext,
    app: createApp({
      authService: profiles.authService,
      profileService: profiles.profileService,
      publicListingService: publicContext.publicListingService,
      savedListingService,
    }),
    savedListingService,
    saves,
    savedRecords,
  };
}
