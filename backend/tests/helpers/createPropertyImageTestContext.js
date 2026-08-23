import { Buffer } from 'node:buffer';
import { createApp } from '../../src/app.js';
import { PropertyImageRepositoryError } from '../../src/repositories/propertyImageRepository.js';
import { processPropertyImage } from '../../src/services/imageProcessor.js';
import { createPropertyImageService } from '../../src/services/propertyImageService.js';
import { PropertyImageStorageError } from '../../src/services/propertyImageStorageService.js';
import {
  createPropertyTestContext,
  makeProperty,
} from './createPropertyTestContext.js';

export function makePropertyImage(overrides = {}) {
  return {
    id: '60000000-0000-4000-8000-000000000001',
    property_id: '50000000-0000-4000-8000-000000000001',
    storage_path:
      '00000000-0000-4000-8000-000000000002/50000000-0000-4000-8000-000000000001/safe.jpeg',
    display_order: 0,
    is_cover: true,
    created_at: '2026-08-21T00:00:00.000Z',
    ...overrides,
  };
}

export function createPropertyImageTestContext({
  propertyRecords = [makeProperty()],
  imageRecords = [],
  applicationProfiles,
  processor = processPropertyImage,
  failMetadataCreate = false,
  failMetadataDelete = false,
  failStorageUpload = false,
  failStorageDelete = false,
  failSignedUrl = false,
  listingRecords = [],
} = {}) {
  const base = createPropertyTestContext({
    propertyRecords,
    applicationProfiles,
    listingRecords,
  });
  const records = new Map(
    imageRecords.map((image) => [image.id, makePropertyImage(image)]),
  );
  const objects = new Map(
    [...records.values()].map((image) => [
      image.storage_path,
      Buffer.from('stored'),
    ]),
  );
  const uploadedPaths = [];
  const removedPaths = [];
  let sequence = 10;

  const images = {
    async listForProperty(propertyId) {
      return [...records.values()]
        .filter((image) => image.property_id === propertyId)
        .sort(
          (left, right) =>
            left.display_order - right.display_order ||
            left.created_at.localeCompare(right.created_at) ||
            left.id.localeCompare(right.id),
        );
    },
    async findForProperty(propertyId, imageId) {
      const image = records.get(imageId);
      return image?.property_id === propertyId ? image : null;
    },
    async create(input) {
      if (failMetadataCreate) throw new PropertyImageRepositoryError();
      const created = makePropertyImage({
        ...input,
        id: `60000000-0000-4000-8000-${String(sequence++).padStart(12, '0')}`,
      });
      records.set(created.id, created);
      return created;
    },
    async updateOrder(propertyId, imageId, displayOrder) {
      const image = await this.findForProperty(propertyId, imageId);
      if (!image) return null;
      const updated = { ...image, display_order: displayOrder };
      records.set(imageId, updated);
      return updated;
    },
    async setCoverState(propertyId, imageId, isCover) {
      const image = await this.findForProperty(propertyId, imageId);
      if (!image) return null;
      const updated = { ...image, is_cover: isCover };
      records.set(imageId, updated);
      return updated;
    },
    async unsetCover(propertyId) {
      for (const [id, image] of records) {
        if (image.property_id === propertyId && image.is_cover) {
          records.set(id, { ...image, is_cover: false });
        }
      }
    },
    async deleteForProperty(propertyId, imageId) {
      if (failMetadataDelete) throw new PropertyImageRepositoryError();
      const image = await this.findForProperty(propertyId, imageId);
      if (!image) return null;
      records.delete(imageId);
      return image;
    },
  };
  const storage = {
    async upload(path, buffer) {
      if (failStorageUpload) throw new PropertyImageStorageError();
      uploadedPaths.push(path);
      objects.set(path, buffer);
    },
    async signedUrl(path) {
      if (failSignedUrl) throw new PropertyImageStorageError();
      return `https://storage.test/private/${encodeURIComponent(path)}?signed=test`;
    },
    async download(path) {
      if (!objects.has(path)) throw new PropertyImageStorageError();
      return objects.get(path);
    },
    async remove(path) {
      if (failStorageDelete) throw new PropertyImageStorageError();
      removedPaths.push(path);
      objects.delete(path);
    },
  };
  const propertyImageService = createPropertyImageService({
    images,
    storage,
    properties: base.propertyService,
    processor,
    uuid: () => '70000000-0000-4000-8000-000000000001',
  });

  return {
    ...base,
    app: createApp({
      authService: base.authService,
      profileService: base.profileService,
      propertyService: base.propertyService,
      propertyImageService,
    }),
    propertyImageService,
    imageRecords: records,
    objects,
    uploadedPaths,
    removedPaths,
  };
}
