import { AppError } from '../middleware/AppError.js';
import { propertyRepository } from '../repositories/propertyRepository.js';
import { listingRepository } from '../repositories/listingRepository.js';
import { profileService as defaultProfileService } from './profileService.js';

const editableFields = [
  'property_type',
  'address_line_1',
  'address_line_2',
  'district',
  'locality',
  'neighbourhood',
  'latitude',
  'longitude',
  'bedrooms',
  'bathrooms',
  'furnished',
  'parking_spaces',
];

function allowlistedFields(input) {
  return Object.fromEntries(
    editableFields
      .filter((field) => Object.hasOwn(input, field))
      .map((field) => [field, input[field]]),
  );
}

function propertyNotFound() {
  return new AppError({
    statusCode: 404,
    code: 'PROPERTY_NOT_FOUND',
    message: 'Property not found.',
  });
}

export function createPropertyService({
  properties = propertyRepository,
  listings = listingRepository,
  profiles = defaultProfileService,
  now = () => new Date().toISOString(),
} = {}) {
  async function landlordFor(userId) {
    return profiles.ensurePropertyManager(userId);
  }

  async function ownedProperty(userId, propertyId) {
    const landlordProfile = await landlordFor(userId);
    const property = await properties.findByIdForLandlord(
      propertyId,
      landlordProfile.id,
    );
    if (!property) throw propertyNotFound();
    return { landlordProfile, property };
  }

  return Object.freeze({
    async create(userId, input) {
      const landlordProfile = await landlordFor(userId);
      if (
        (landlordProfile.role === 'AGENT') !==
        Boolean(input.managed_owner_id)
      ) {
        throw new AppError({
          statusCode: 422,
          code: 'INVALID_OWNER_CONTEXT',
          message:
            landlordProfile.role === 'AGENT'
              ? 'Select an active property owner.'
              : 'Self-managed properties do not require an owner record.',
        });
      }
      return properties.create(landlordProfile.id, {
        ...(input.managed_owner_id
          ? { managed_owner_id: input.managed_owner_id }
          : {}),
        ...allowlistedFields(input),
        furnished: input.furnished ?? false,
        parking_spaces: input.parking_spaces ?? 0,
      });
    },

    async list(userId, pagination) {
      const landlordProfile = await landlordFor(userId);
      return properties.listForLandlord(landlordProfile.id, pagination);
    },

    async get(userId, propertyId) {
      return (await ownedProperty(userId, propertyId)).property;
    },

    async update(userId, propertyId, input) {
      const { landlordProfile, property } = await ownedProperty(
        userId,
        propertyId,
      );
      if (property.archived_at) {
        throw new AppError({
          statusCode: 409,
          code: 'PROPERTY_ARCHIVED',
          message: 'Archived properties cannot be edited.',
        });
      }
      const updated = await properties.updateForLandlord(
        propertyId,
        landlordProfile.id,
        allowlistedFields(input),
      );
      if (!updated) throw propertyNotFound();
      return updated;
    },

    async archive(userId, propertyId) {
      const { landlordProfile, property } = await ownedProperty(
        userId,
        propertyId,
      );
      if (property.archived_at) return property;
      if (await listings.hasLiveForProperty(propertyId)) {
        throw new AppError({
          statusCode: 409,
          code: 'PROPERTY_HAS_LIVE_LISTING',
          message: 'Close the live listing before archiving this property.',
        });
      }

      const archived = await properties.archiveForLandlord(
        propertyId,
        landlordProfile.id,
        now(),
      );
      if (archived) return archived;

      const concurrentResult = await properties.findByIdForLandlord(
        propertyId,
        landlordProfile.id,
      );
      if (!concurrentResult) throw propertyNotFound();
      return concurrentResult;
    },
  });
}

export const propertyService = createPropertyService();
