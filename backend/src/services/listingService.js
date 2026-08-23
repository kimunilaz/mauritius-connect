import { AppError } from '../middleware/AppError.js';
import {
  listingRepository,
  ListingRepositoryError,
} from '../repositories/listingRepository.js';
import { serializeListing } from '../serializers/listingSerializer.js';
import { profileService as defaultProfileService } from './profileService.js';
import { propertyImageService as defaultPropertyImageService } from './propertyImageService.js';
import { propertyService as defaultPropertyService } from './propertyService.js';
import { listingStateService as defaultListingStateService } from './listingStateService.js';

const editableFields = [
  'title',
  'description',
  'monthly_rent',
  'deposit_amount',
  'available_from',
  'minimum_lease_months',
  'maximum_occupants',
  'pets_allowed',
];

function allowlistedFields(input) {
  return Object.fromEntries(
    editableFields
      .filter((field) => Object.hasOwn(input, field))
      .map((field) => [field, input[field]]),
  );
}

function listingNotFound() {
  return new AppError({
    statusCode: 404,
    code: 'LISTING_NOT_FOUND',
    message: 'Listing not found.',
  });
}

function liveListingConflict() {
  return new AppError({
    statusCode: 409,
    code: 'LIVE_LISTING_ALREADY_EXISTS',
    message: 'This property already has a live listing.',
  });
}

function mapWriteError(error) {
  if (
    error instanceof ListingRepositoryError &&
    error.reason === 'LIVE_LISTING_CONFLICT'
  ) {
    throw liveListingConflict();
  }
  throw error;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value ?? '')) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().startsWith(value);
}

function storedReadinessReasons(listing, property, imageSummary) {
  const reasons = [];
  if (property.archived_at) reasons.push('PROPERTY_ARCHIVED');
  if (!listing.title?.trim() || listing.title.trim().length > 200)
    reasons.push('TITLE_INVALID');
  if (!listing.description?.trim() || listing.description.trim().length > 5000)
    reasons.push('DESCRIPTION_INVALID');
  if (
    !Number.isFinite(Number(listing.monthly_rent)) ||
    !(Number(listing.monthly_rent) > 0)
  )
    reasons.push('MONTHLY_RENT_REQUIRED');
  if (listing.deposit_amount !== null && !(Number(listing.deposit_amount) >= 0))
    reasons.push('DEPOSIT_INVALID');
  if (!validDate(listing.available_from))
    reasons.push('AVAILABLE_FROM_INVALID');
  if (
    listing.minimum_lease_months !== null &&
    !(
      Number.isInteger(listing.minimum_lease_months) &&
      listing.minimum_lease_months > 0
    )
  )
    reasons.push('MINIMUM_LEASE_INVALID');
  if (
    listing.maximum_occupants !== null &&
    !(
      Number.isInteger(listing.maximum_occupants) &&
      listing.maximum_occupants > 0
    )
  )
    reasons.push('MAXIMUM_OCCUPANTS_INVALID');
  if (imageSummary.count < 1) reasons.push('PROPERTY_IMAGE_REQUIRED');
  if (!imageSummary.hasCover) reasons.push('COVER_IMAGE_REQUIRED');
  return reasons;
}

export function createListingService({
  listings = listingRepository,
  profiles = defaultProfileService,
  properties = defaultPropertyService,
  images = defaultPropertyImageService,
  states = defaultListingStateService,
  now = () => new Date().toISOString(),
} = {}) {
  async function landlordFor(userId) {
    return profiles.ensureLandlordProfile(userId);
  }

  async function ownedListing(userId, listingId) {
    const landlord = await landlordFor(userId);
    const listing = await listings.findByIdForLandlord(listingId, landlord.id);
    if (!listing) throw listingNotFound();
    return listing;
  }

  async function assertReady(userId, listing) {
    const property = await properties.get(userId, listing.property_id);
    const imageSummary = await images.summary(
      userId,
      listing.property_id,
      property,
    );
    const reasons = storedReadinessReasons(listing, property, imageSummary);
    if (reasons.length) {
      throw new AppError({
        statusCode: 409,
        code: 'LISTING_NOT_READY',
        message: 'Complete the listing requirements before submitting it.',
        fields: { readiness: reasons },
      });
    }
    const conflict = await listings.findOtherLiveForProperty(
      listing.property_id,
      listing.id,
    );
    if (conflict) throw liveListingConflict();
  }

  async function transition(
    userId,
    listingId,
    action,
    { readiness = false } = {},
  ) {
    const listing = await ownedListing(userId, listingId);
    if (action === 'close' && listing.status === 'CLOSED') return listing;
    const nextStatus = states.transition(action, listing.status);
    if (readiness) await assertReady(userId, listing);
    const fields = { status: nextStatus };
    if (action === 'publish') fields.published_at = now();
    if (action === 'close') fields.closed_at = now();

    let updated;
    try {
      updated = await listings.updateExpected(
        listing.id,
        listing.property_id,
        listing.status,
        fields,
      );
    } catch (error) {
      mapWriteError(error);
    }
    if (updated) return updated;

    const current = await ownedListing(userId, listingId);
    if (action === 'close' && current.status === 'CLOSED') return current;
    states.transition(action, current.status);
    throw new AppError({
      statusCode: 409,
      code: 'LISTING_STATE_CHANGED',
      message: 'The listing state changed. Refresh and try again.',
    });
  }

  return Object.freeze({
    getOwnedRecord: ownedListing,

    async create(userId, input) {
      const property = await properties.get(userId, input.property_id);
      if (property.archived_at) {
        throw new AppError({
          statusCode: 409,
          code: 'PROPERTY_ARCHIVED',
          message: 'Archived properties cannot receive new listings.',
        });
      }
      const listing = await listings.create({
        property_id: property.id,
        ...allowlistedFields(input),
        deposit_amount: input.deposit_amount ?? null,
        minimum_lease_months: input.minimum_lease_months ?? null,
        maximum_occupants: input.maximum_occupants ?? null,
        pets_allowed: input.pets_allowed ?? false,
      });
      return serializeListing(listing);
    },

    async list(userId, query) {
      const landlord = await landlordFor(userId);
      const result = await listings.listForLandlord(landlord.id, query);
      return {
        total: result.total,
        listings: await Promise.all(
          result.listings.map(async (listing) =>
            serializeListing(listing, {
              coverImage: await images.cover(
                userId,
                listing.property_id,
                listing.property,
              ),
            }),
          ),
        ),
      };
    },

    async get(userId, listingId) {
      const listing = await ownedListing(userId, listingId);
      return serializeListing(listing, {
        images: await images.list(
          userId,
          listing.property_id,
          listing.property,
        ),
      });
    },

    async update(userId, listingId, input) {
      const listing = await ownedListing(userId, listingId);
      states.assertEditable(listing.status);
      const updated = await listings.updateExpected(
        listing.id,
        listing.property_id,
        listing.status,
        allowlistedFields(input),
      );
      if (updated) return serializeListing(updated);
      const current = await ownedListing(userId, listingId);
      states.assertEditable(current.status);
      throw new AppError({
        statusCode: 409,
        code: 'LISTING_STATE_CHANGED',
        message: 'The listing state changed. Refresh and try again.',
      });
    },

    async publish(userId, listingId) {
      return serializeListing(
        await transition(userId, listingId, 'publish', { readiness: true }),
      );
    },

    async pause(userId, listingId) {
      return serializeListing(await transition(userId, listingId, 'pause'));
    },

    async activate(userId, listingId) {
      return serializeListing(
        await transition(userId, listingId, 'activate', { readiness: true }),
      );
    },

    async close(userId, listingId) {
      return serializeListing(await transition(userId, listingId, 'close'));
    },
  });
}

export const listingService = createListingService();
