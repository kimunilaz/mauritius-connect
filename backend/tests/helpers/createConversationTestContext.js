import { createApp } from '../../src/app.js';
import { createConversationService } from '../../src/services/conversationService.js';
import { makeProfile, TEST_USERS } from './createAuthTestContext.js';
import { makeListing } from './createListingTestContext.js';
import { makeProperty } from './createPropertyTestContext.js';
import { createProfileTestContext } from './createProfileTestContext.js';

export const CONVERSATION_ID = 'f0000000-0000-4000-8000-000000000001';
export const OTHER_CONVERSATION_ID = 'f0000000-0000-4000-8000-000000000002';

function safeProfile(profile) {
  return {
    first_name: profile.first_name,
    last_name: profile.last_name,
    profile_photo_url: profile.profile_photo_url,
  };
}

export function createConversationTestContext({
  listingStatus = 'ACTIVE',
  archived = false,
  conversationExists = false,
  applicationProfiles,
} = {}) {
  const tenantProfile = makeProfile({
    email: 'private@example.test',
    income_range: 'PRIVATE',
  });
  const landlordProfile = makeProfile({
    id: TEST_USERS.landlord,
    role: 'LANDLORD',
    first_name: 'Lina',
    last_name: 'Owner',
    profile_photo_url: 'https://images.test/landlord.jpg',
    phone: '+23050000000',
  });
  const otherProfile = makeProfile({
    id: TEST_USERS.other,
    first_name: 'Other',
    last_name: 'Tenant',
  });
  const profiles = createProfileTestContext({
    applicationProfiles: applicationProfiles ?? [
      tenantProfile,
      landlordProfile,
      otherProfile,
    ],
  });
  const property = makeProperty({
    archived_at: archived ? '2026-08-22T00:00:00.000Z' : null,
    address_line_1: 'PRIVATE exact address',
    latitude: -20.2,
    longitude: 57.5,
  });
  const listing = makeListing({ status: listingStatus });
  const records = [];
  const participants = [];

  function addConversation({
    id = CONVERSATION_ID,
    tenantUserId = TEST_USERS.tenant,
    landlordUserId = TEST_USERS.landlord,
  } = {}) {
    const record = {
      id,
      listing_id: listing.id,
      tenant_user_id: tenantUserId,
      landlord_user_id: landlordUserId,
      created_at: '2026-08-22T10:00:00.000Z',
      updated_at: '2026-08-22T11:00:00.000Z',
      tenant: safeProfile(
        tenantUserId === TEST_USERS.tenant ? tenantProfile : otherProfile,
      ),
      landlord: safeProfile(landlordProfile),
      listing: {
        id: listing.id,
        title: listing.title,
        status: listing.status,
        property: { archived_at: property.archived_at },
      },
    };
    records.push(record);
    participants.push(
      { conversation_id: id, user_id: tenantUserId, last_read_at: null },
      { conversation_id: id, user_id: landlordUserId, last_read_at: null },
    );
    return record;
  }

  if (conversationExists) addConversation();

  const conversations = {
    async createForListing(listingId, tenantUserId) {
      if (
        listingId !== listing.id ||
        listing.status !== 'ACTIVE' ||
        property.archived_at
      ) {
        return { outcome: 'LISTING_NOT_FOUND' };
      }
      const existing = records.find(
        (record) =>
          record.listing_id === listingId &&
          record.tenant_user_id === tenantUserId &&
          record.landlord_user_id === TEST_USERS.landlord,
      );
      if (existing) {
        return {
          outcome: 'READY',
          conversation_id: existing.id,
          created_now: false,
        };
      }
      const created = addConversation({ tenantUserId });
      return {
        outcome: 'READY',
        conversation_id: created.id,
        created_now: true,
      };
    },
    async listForParticipant(userId, { page, limit }) {
      const owned = records
        .filter((record) =>
          participants.some(
            (participant) =>
              participant.conversation_id === record.id &&
              participant.user_id === userId,
          ),
        )
        .sort(
          (left, right) =>
            right.updated_at.localeCompare(left.updated_at) ||
            right.id.localeCompare(left.id),
        );
      const first = (page - 1) * limit;
      return {
        conversations: owned.slice(first, first + limit),
        total: owned.length,
      };
    },
    async findByIdForParticipant(id, userId) {
      if (
        !participants.some(
          (participant) =>
            participant.conversation_id === id &&
            participant.user_id === userId,
        )
      ) {
        return null;
      }
      return records.find((record) => record.id === id) ?? null;
    },
  };
  const publicListings = {
    async presentCardForId(listingId) {
      if (
        listingId !== listing.id ||
        listing.status !== 'ACTIVE' ||
        property.archived_at
      ) {
        return null;
      }
      return {
        id: listing.id,
        title: listing.title,
        monthly_rent: Number(listing.monthly_rent),
        cover_image_url: 'https://storage.test/signed-cover',
        property: {
          district: property.district,
          locality: property.locality,
          bedrooms: property.bedrooms,
          bathrooms: property.bathrooms,
        },
      };
    },
  };
  const conversationService = createConversationService({
    conversations,
    publicListings,
  });

  return {
    ...profiles,
    app: createApp({
      authService: profiles.authService,
      profileService: profiles.profileService,
      conversationService,
    }),
    conversationService,
    conversations,
    records,
    participants,
    listing,
    property,
  };
}
