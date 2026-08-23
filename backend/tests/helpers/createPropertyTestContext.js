import { createApp } from '../../src/app.js';
import { createPropertyService } from '../../src/services/propertyService.js';
import { makeProfile, TEST_USERS } from './createAuthTestContext.js';
import { createProfileTestContext } from './createProfileTestContext.js';

export const LANDLORD_PROFILE_IDS = Object.freeze({
  a: '40000000-0000-4000-8000-000000000001',
  b: '40000000-0000-4000-8000-000000000002',
});

export function makeProperty(overrides = {}) {
  return {
    id: '50000000-0000-4000-8000-000000000001',
    landlord_id: LANDLORD_PROFILE_IDS.a,
    property_type: 'APARTMENT',
    address_line_1: '1 Test Street',
    address_line_2: null,
    district: 'Moka',
    locality: 'Moka',
    neighbourhood: null,
    latitude: -20.23,
    longitude: 57.5,
    bedrooms: 2,
    bathrooms: 1.5,
    furnished: true,
    parking_spaces: 1,
    verification_status: 'UNVERIFIED',
    archived_at: null,
    created_at: '2026-08-20T00:00:00.000Z',
    updated_at: '2026-08-20T00:00:00.000Z',
    ...overrides,
  };
}

export function createPropertyTestContext({
  propertyRecords: initialProperties = [],
  applicationProfiles,
  propertyImageService = { list: async () => [] },
  listingRecords = [],
} = {}) {
  const base = createProfileTestContext({
    applicationProfiles: applicationProfiles ?? [
      makeProfile(),
      makeProfile({
        id: TEST_USERS.landlord,
        role: 'LANDLORD',
        first_name: 'Landlord',
      }),
      makeProfile({
        id: TEST_USERS.other,
        role: 'LANDLORD',
        first_name: 'Other',
      }),
    ],
    landlordRoleProfiles: [
      {
        id: LANDLORD_PROFILE_IDS.a,
        user_id: TEST_USERS.landlord,
        verification_status: 'UNVERIFIED',
      },
      {
        id: LANDLORD_PROFILE_IDS.b,
        user_id: TEST_USERS.other,
        verification_status: 'UNVERIFIED',
      },
    ],
  });
  const records = new Map(
    initialProperties.map((property) => [property.id, makeProperty(property)]),
  );
  let sequence = 10;
  let archiveWrites = 0;

  const properties = {
    async create(landlordId, input) {
      const property = makeProperty({
        ...input,
        id: `50000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`,
        landlord_id: landlordId,
        verification_status: 'UNVERIFIED',
      });
      records.set(property.id, property);
      return property;
    },
    async listForLandlord(landlordId, { archived, page, limit }) {
      const owned = [...records.values()]
        .filter(
          (property) =>
            property.landlord_id === landlordId &&
            Boolean(property.archived_at) === archived,
        )
        .sort((a, b) => b.created_at.localeCompare(a.created_at));
      const first = (page - 1) * limit;
      return {
        properties: owned.slice(first, first + limit),
        total: owned.length,
      };
    },
    async findByIdForLandlord(propertyId, landlordId) {
      const property = records.get(propertyId);
      return property?.landlord_id === landlordId ? property : null;
    },
    async updateForLandlord(propertyId, landlordId, fields) {
      const property = records.get(propertyId);
      if (
        !property ||
        property.landlord_id !== landlordId ||
        property.archived_at
      ) {
        return null;
      }
      const updated = {
        ...property,
        ...fields,
        updated_at: '2026-08-21T00:00:00.000Z',
      };
      records.set(propertyId, updated);
      return updated;
    },
    async archiveForLandlord(propertyId, landlordId, archivedAt) {
      const property = records.get(propertyId);
      if (
        !property ||
        property.landlord_id !== landlordId ||
        property.archived_at
      ) {
        return null;
      }
      archiveWrites += 1;
      const updated = { ...property, archived_at: archivedAt };
      records.set(propertyId, updated);
      return updated;
    },
  };
  const propertyService = createPropertyService({
    properties,
    listings: {
      async hasLiveForProperty(propertyId) {
        return listingRecords.some(
          (listing) =>
            listing.property_id === propertyId &&
            ['PENDING_REVIEW', 'ACTIVE', 'PAUSED'].includes(listing.status),
        );
      },
    },
    profiles: base.profileService,
    now: () => '2026-08-21T12:00:00.000Z',
  });

  return {
    app: createApp({
      authService: base.authService,
      profileService: base.profileService,
      propertyService,
      propertyImageService,
    }),
    authService: base.authService,
    profileService: base.profileService,
    propertyService,
    records,
    get archiveWrites() {
      return archiveWrites;
    },
  };
}
