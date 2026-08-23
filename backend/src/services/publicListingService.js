import { AppError } from '../middleware/AppError.js';
import { propertyImageRepository } from '../repositories/propertyImageRepository.js';
import { publicListingRepository } from '../repositories/publicListingRepository.js';
import {
  serializePublicListingCard,
  serializePublicListingDetail,
} from '../serializers/publicListingSerializer.js';
import {
  propertyImageStorageService,
  PropertyImageStorageError,
} from './propertyImageStorageService.js';
import { isPublicListingEligible } from './publicListingEligibility.js';

function listingNotFound() {
  return new AppError({
    statusCode: 404,
    code: 'LISTING_NOT_FOUND',
    message: 'Listing not found.',
  });
}

export function createPublicListingService({
  listings = publicListingRepository,
  images = propertyImageRepository,
  storage = propertyImageStorageService,
} = {}) {
  async function safeSignedUrl(image) {
    try {
      return await storage.signedUrl(image.storage_path);
    } catch (error) {
      if (error instanceof PropertyImageStorageError) return null;
      throw error;
    }
  }

  async function coverUrlForEligibleListing(listing) {
    const records = await images.listForProperty(listing.property.id);
    const cover = records.find((image) => image.is_cover);
    return cover ? safeSignedUrl(cover) : null;
  }

  async function presentCard(listing) {
    if (!isPublicListingEligible(listing)) return null;
    return serializePublicListingCard(
      listing,
      await coverUrlForEligibleListing(listing),
    );
  }

  return Object.freeze({
    async search(filters) {
      const result = await listings.search(filters);
      return {
        total: result.total,
        listings: await Promise.all(result.listings.map(presentCard)),
      };
    },

    async isEligible(listingId) {
      return Boolean(await listings.findPublicById(listingId));
    },

    presentCard,

    async presentCardForId(listingId) {
      const listing = await listings.findPublicById(listingId);
      return listing ? presentCard(listing) : null;
    },

    async get(listingId) {
      const listing = await listings.findPublicById(listingId);
      if (!listing) throw listingNotFound();
      const records = await images.listForProperty(listing.property.id);
      const presented = await Promise.all(
        records.map(async (image) => ({
          id: image.id,
          url: await safeSignedUrl(image),
          display_order: image.display_order,
          is_cover: image.is_cover,
        })),
      );
      return serializePublicListingDetail(
        listing,
        presented.filter((image) => image.url !== null),
      );
    },
  });
}

export const publicListingService = createPublicListingService();
