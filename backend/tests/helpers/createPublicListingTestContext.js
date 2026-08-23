import { createApp } from '../../src/app.js';
import { createPublicListingService } from '../../src/services/publicListingService.js';
import { PropertyImageStorageError } from '../../src/services/propertyImageStorageService.js';
import { makeListing } from './createListingTestContext.js';
import { makePropertyImage } from './createPropertyImageTestContext.js';
import { makeProperty } from './createPropertyTestContext.js';

function compare(left, right, field, direction) {
  const leftValue = left[field] ?? '';
  const rightValue = right[field] ?? '';
  const result =
    typeof leftValue === 'number' || !Number.isNaN(Number(leftValue))
      ? Number(leftValue) - Number(rightValue)
      : String(leftValue).localeCompare(String(rightValue));
  return result * direction || left.id.localeCompare(right.id);
}

export function createPublicListingTestContext({
  listingRecords: listingInput = [],
  propertyRecords: propertyInput = [makeProperty()],
  imageRecords: imageInput = [makePropertyImage()],
  failingStoragePaths = [],
} = {}) {
  const properties = new Map(
    propertyInput.map((property) => [property.id, makeProperty(property)]),
  );
  const listingRecords = listingInput.map((listing) => makeListing(listing));
  const imageRecords = imageInput.map((image) => makePropertyImage(image));
  const signedPaths = [];

  function eligible() {
    return listingRecords
      .filter(
        (listing) =>
          listing.status === 'ACTIVE' &&
          !properties.get(listing.property_id)?.archived_at,
      )
      .map((listing) => ({
        ...listing,
        property: { ...properties.get(listing.property_id) },
      }));
  }

  const listings = {
    async search(filters) {
      let rows = eligible();
      for (const field of ['district', 'locality', 'neighbourhood']) {
        if (filters[field]) {
          rows = rows.filter(
            (listing) =>
              listing.property[field]?.toLocaleLowerCase() ===
              filters[field].toLocaleLowerCase(),
          );
        }
      }
      if (filters.property_type) {
        rows = rows.filter(
          (listing) => listing.property.property_type === filters.property_type,
        );
      }
      if (filters.min_rent !== undefined) {
        rows = rows.filter(
          (listing) => Number(listing.monthly_rent) >= filters.min_rent,
        );
      }
      if (filters.max_rent !== undefined) {
        rows = rows.filter(
          (listing) => Number(listing.monthly_rent) <= filters.max_rent,
        );
      }
      if (filters.bedrooms !== undefined) {
        rows = rows.filter(
          (listing) => listing.property.bedrooms >= filters.bedrooms,
        );
      }
      if (filters.bathrooms !== undefined) {
        rows = rows.filter(
          (listing) => listing.property.bathrooms >= filters.bathrooms,
        );
      }
      if (filters.furnished !== undefined) {
        rows = rows.filter(
          (listing) => listing.property.furnished === filters.furnished,
        );
      }
      if (filters.pets_allowed !== undefined) {
        rows = rows.filter(
          (listing) => listing.pets_allowed === filters.pets_allowed,
        );
      }
      if (filters.available_from) {
        rows = rows.filter(
          (listing) => listing.available_from <= filters.available_from,
        );
      }

      const sorting = {
        newest: ['published_at', -1],
        rent_low: ['monthly_rent', 1],
        rent_high: ['monthly_rent', -1],
        available_soon: ['available_from', 1],
      };
      const [field, direction] = sorting[filters.sort];
      rows.sort((left, right) => compare(left, right, field, direction));
      const total = rows.length;
      const first = (filters.page - 1) * filters.limit;
      return {
        listings: rows.slice(first, first + filters.limit),
        total,
      };
    },

    async findPublicById(listingId) {
      return eligible().find((listing) => listing.id === listingId) ?? null;
    },
  };

  const images = {
    async listForProperty(propertyId) {
      return imageRecords
        .filter((image) => image.property_id === propertyId)
        .sort(
          (left, right) =>
            left.display_order - right.display_order ||
            left.created_at.localeCompare(right.created_at) ||
            left.id.localeCompare(right.id),
        );
    },
  };
  const storage = {
    async signedUrl(path) {
      signedPaths.push(path);
      if (failingStoragePaths.includes(path)) {
        throw new PropertyImageStorageError('SIGN_FAILED');
      }
      return `https://storage.test/private/presentation?signed=${encodeURIComponent(path)}`;
    },
  };
  const publicListingService = createPublicListingService({
    listings,
    images,
    storage,
  });

  return {
    app: createApp({ publicListingService }),
    publicListingService,
    listings,
    images,
    storage,
    listingRecords,
    propertyRecords: properties,
    imageRecords,
    signedPaths,
  };
}
