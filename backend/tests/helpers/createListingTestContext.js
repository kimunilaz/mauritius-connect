import { createApp } from '../../src/app.js';
import { ListingRepositoryError } from '../../src/repositories/listingRepository.js';
import { createListingService } from '../../src/services/listingService.js';
import { TEST_USERS } from './createAuthTestContext.js';
import {
  createPropertyImageTestContext,
  makePropertyImage,
} from './createPropertyImageTestContext.js';
import {
  LANDLORD_PROFILE_IDS,
  makeProperty,
} from './createPropertyTestContext.js';

export const LISTING_IDS = Object.freeze({
  a: '80000000-0000-4000-8000-000000000001',
  b: '80000000-0000-4000-8000-000000000002',
});

export function makeListing(overrides = {}) {
  return {
    id: LISTING_IDS.a,
    property_id: '50000000-0000-4000-8000-000000000001',
    title: 'Modern apartment in Moka',
    description: 'A bright, well maintained rental home.',
    monthly_rent: '18000.00',
    deposit_amount: '18000.00',
    available_from: '2026-10-01',
    minimum_lease_months: 6,
    maximum_occupants: 3,
    pets_allowed: false,
    status: 'DRAFT',
    published_at: null,
    closed_at: null,
    created_at: '2026-08-21T00:00:00.000Z',
    updated_at: '2026-08-21T00:00:00.000Z',
    ...overrides,
  };
}

export function createListingTestContext({
  propertyRecords = [makeProperty()],
  imageRecords = [makePropertyImage()],
  listingRecords: initialListings = [],
  applicationProfiles,
  forceLiveConflictOnUpdate = false,
} = {}) {
  const listingRecords = initialListings.map((listing) => makeListing(listing));
  const base = createPropertyImageTestContext({
    propertyRecords,
    imageRecords,
    applicationProfiles,
    listingRecords,
  });
  let sequence = 10;

  function withProperty(listing) {
    if (!listing) return null;
    const property = base.records.get(listing.property_id);
    return property ? { ...listing, property: { ...property } } : null;
  }

  function ownerMatches(listing, landlordId) {
    return base.records.get(listing.property_id)?.landlord_id === landlordId;
  }

  function liveConflict(candidate, excludedId) {
    return listingRecords.some(
      (listing) =>
        listing.id !== excludedId &&
        listing.property_id === candidate.property_id &&
        ['PENDING_REVIEW', 'ACTIVE', 'PAUSED'].includes(listing.status),
    );
  }

  const listings = {
    async create(input) {
      const created = makeListing({
        ...input,
        id: `80000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`,
        status: 'DRAFT',
      });
      listingRecords.push(created);
      return withProperty(created);
    },
    async listForLandlord(landlordId, { page, limit, status }) {
      const owned = listingRecords
        .filter(
          (listing) =>
            ownerMatches(listing, landlordId) &&
            (!status || listing.status === status),
        )
        .sort((left, right) => right.created_at.localeCompare(left.created_at));
      const first = (page - 1) * limit;
      return {
        listings: owned.slice(first, first + limit).map(withProperty),
        total: owned.length,
      };
    },
    async findByIdForLandlord(listingId, landlordId) {
      const listing = listingRecords.find(
        (candidate) =>
          candidate.id === listingId && ownerMatches(candidate, landlordId),
      );
      return withProperty(listing);
    },
    async updateExpected(listingId, propertyId, expectedStatus, fields) {
      const listing = listingRecords.find(
        (candidate) =>
          candidate.id === listingId &&
          candidate.property_id === propertyId &&
          candidate.status === expectedStatus,
      );
      if (!listing) return null;
      if (
        forceLiveConflictOnUpdate &&
        ['PENDING_REVIEW', 'ACTIVE', 'PAUSED'].includes(fields.status)
      ) {
        throw new ListingRepositoryError('LIVE_LISTING_CONFLICT');
      }
      if (
        ['PENDING_REVIEW', 'ACTIVE', 'PAUSED'].includes(fields.status) &&
        liveConflict(listing, listing.id)
      ) {
        throw new ListingRepositoryError('LIVE_LISTING_CONFLICT');
      }
      Object.assign(listing, fields, {
        updated_at: '2026-08-21T12:00:00.000Z',
      });
      return withProperty(listing);
    },
    async findOtherLiveForProperty(propertyId, excludedListingId) {
      return (
        listingRecords.find(
          (listing) =>
            listing.id !== excludedListingId &&
            listing.property_id === propertyId &&
            ['PENDING_REVIEW', 'ACTIVE', 'PAUSED'].includes(listing.status),
        ) ?? null
      );
    },
    async hasLiveForProperty(propertyId) {
      return listingRecords.some(
        (listing) =>
          listing.property_id === propertyId &&
          ['PENDING_REVIEW', 'ACTIVE', 'PAUSED'].includes(listing.status),
      );
    },
  };
  const listingService = createListingService({
    listings,
    profiles: base.profileService,
    properties: base.propertyService,
    images: base.propertyImageService,
    now: () => '2026-08-21T12:00:00.000Z',
  });

  return {
    ...base,
    app: createApp({
      authService: base.authService,
      profileService: base.profileService,
      propertyService: base.propertyService,
      propertyImageService: base.propertyImageService,
      listingService,
    }),
    listings,
    listingService,
    listingRecords,
  };
}

export function otherLandlordProperty(overrides = {}) {
  return makeProperty({
    id: '50000000-0000-4000-8000-000000000002',
    landlord_id: LANDLORD_PROFILE_IDS.b,
    locality: 'Curepipe',
    ...overrides,
  });
}

export const OTHER_USER_ID = TEST_USERS.other;
