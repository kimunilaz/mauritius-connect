import console from 'node:console';
import { randomUUID } from 'node:crypto';
import { AppError } from '../middleware/AppError.js';
import {
  propertyImageRepository,
  PropertyImageRepositoryError,
} from '../repositories/propertyImageRepository.js';
import { processPropertyImage } from './imageProcessor.js';
import {
  propertyImageStorageService,
  PropertyImageStorageError,
} from './propertyImageStorageService.js';
import { propertyService as defaultPropertyService } from './propertyService.js';

const MAX_IMAGES_PER_PROPERTY = 20;

function imageNotFound() {
  return new AppError({
    statusCode: 404,
    code: 'PROPERTY_IMAGE_NOT_FOUND',
    message: 'Property image not found.',
  });
}

function safeStorageError(code, message) {
  return new AppError({ statusCode: 502, code, message });
}

export function createPropertyImageService({
  images = propertyImageRepository,
  storage = propertyImageStorageService,
  properties = defaultPropertyService,
  processor = processPropertyImage,
  uuid = randomUUID,
} = {}) {
  async function ownedProperty(userId, propertyId, suppliedProperty) {
    if (suppliedProperty?.id === propertyId) return suppliedProperty;
    return properties.get(userId, propertyId);
  }

  async function ownedImage(userId, propertyId, imageId, suppliedProperty) {
    const property = await ownedProperty(userId, propertyId, suppliedProperty);
    const image = await images.findForProperty(propertyId, imageId);
    if (!image) throw imageNotFound();
    return { property, image };
  }

  async function present(image) {
    try {
      return {
        id: image.id,
        url: await storage.signedUrl(image.storage_path),
        display_order: image.display_order,
        is_cover: image.is_cover,
      };
    } catch (error) {
      if (error instanceof PropertyImageStorageError) {
        throw safeStorageError(
          'IMAGE_URL_FAILED',
          'A private property image could not be prepared for viewing.',
        );
      }
      throw error;
    }
  }

  async function restoreCover(propertyId, formerCover, replacement) {
    try {
      if (replacement) {
        await images.setCoverState(propertyId, replacement.id, false);
      }
      if (formerCover) {
        await images.setCoverState(propertyId, formerCover.id, true);
      }
    } catch {
      console.error('Property image cover rollback failed.');
    }
  }

  return Object.freeze({
    async assertOwnedProperty(userId, propertyId, { writable = false } = {}) {
      const property = await ownedProperty(userId, propertyId);
      if (writable && property.archived_at) {
        throw new AppError({
          statusCode: 409,
          code: 'PROPERTY_ARCHIVED',
          message: 'Archived properties cannot accept new images.',
        });
      }
      return property;
    },

    async list(userId, propertyId, suppliedProperty) {
      await ownedProperty(userId, propertyId, suppliedProperty);
      const records = await images.listForProperty(propertyId);
      return Promise.all(records.map(present));
    },

    async summary(userId, propertyId, suppliedProperty) {
      await ownedProperty(userId, propertyId, suppliedProperty);
      const records = await images.listForProperty(propertyId);
      return {
        count: records.length,
        hasCover: records.some((image) => image.is_cover),
      };
    },

    async cover(userId, propertyId, suppliedProperty) {
      await ownedProperty(userId, propertyId, suppliedProperty);
      const records = await images.listForProperty(propertyId);
      const cover = records.find((image) => image.is_cover);
      return cover ? present(cover) : null;
    },

    async upload(userId, propertyId, file, suppliedProperty) {
      const property = await ownedProperty(
        userId,
        propertyId,
        suppliedProperty,
      );
      if (property.archived_at) {
        throw new AppError({
          statusCode: 409,
          code: 'PROPERTY_ARCHIVED',
          message: 'Archived properties cannot accept new images.',
        });
      }
      if (!file?.buffer) {
        throw new AppError({
          statusCode: 422,
          code: 'IMAGE_REQUIRED',
          message: 'Choose a property image to upload.',
        });
      }

      const existing = await images.listForProperty(propertyId);
      if (existing.length >= MAX_IMAGES_PER_PROPERTY) {
        throw new AppError({
          statusCode: 409,
          code: 'PROPERTY_IMAGE_LIMIT_REACHED',
          message: 'A property can have at most 20 images.',
        });
      }

      const processed = await processor(file.buffer);
      const storagePath = `${userId}/${propertyId}/${uuid()}.${processed.extension}`;
      try {
        await storage.upload(storagePath, processed.buffer, processed.mimeType);
      } catch (error) {
        if (error instanceof PropertyImageStorageError) {
          throw safeStorageError(
            'UPLOAD_FAILED',
            'The image could not be uploaded.',
          );
        }
        throw error;
      }

      const displayOrder =
        existing.reduce(
          (maximum, image) => Math.max(maximum, image.display_order),
          -1,
        ) + 1;
      let created;
      try {
        created = await images.create({
          property_id: propertyId,
          storage_path: storagePath,
          display_order: displayOrder,
          is_cover: existing.length === 0,
        });
      } catch (error) {
        try {
          await storage.remove(storagePath);
        } catch {
          console.error('Property image upload compensation failed.');
        }
        if (error instanceof PropertyImageRepositoryError) {
          throw new AppError({
            statusCode: 500,
            code: 'IMAGE_METADATA_FAILED',
            message: 'The image could not be saved.',
          });
        }
        throw error;
      }
      return present(created);
    },

    async update(userId, propertyId, imageId, input, suppliedProperty) {
      const { image } = await ownedImage(
        userId,
        propertyId,
        imageId,
        suppliedProperty,
      );
      let updated = image;

      if (input.is_cover === true && !image.is_cover) {
        const records = await images.listForProperty(propertyId);
        const formerCover = records.find((candidate) => candidate.is_cover);
        await images.unsetCover(propertyId);
        try {
          updated = await images.setCoverState(propertyId, imageId, true);
          if (!updated) throw imageNotFound();
        } catch (error) {
          await restoreCover(propertyId, formerCover);
          throw error;
        }
      }

      if (Object.hasOwn(input, 'display_order')) {
        updated = await images.updateOrder(
          propertyId,
          imageId,
          input.display_order,
        );
        if (!updated) throw imageNotFound();
      }
      return present(updated);
    },

    async delete(userId, propertyId, imageId, suppliedProperty) {
      const { image } = await ownedImage(
        userId,
        propertyId,
        imageId,
        suppliedProperty,
      );
      const records = await images.listForProperty(propertyId);
      const replacement = image.is_cover
        ? records.find((candidate) => candidate.id !== imageId)
        : null;

      let backup;
      try {
        backup = await storage.download(image.storage_path);
        await storage.remove(image.storage_path);
      } catch (error) {
        if (error instanceof PropertyImageStorageError) {
          throw safeStorageError(
            'IMAGE_DELETE_FAILED',
            'The property image could not be deleted.',
          );
        }
        throw error;
      }

      try {
        if (image.is_cover) {
          await images.setCoverState(propertyId, imageId, false);
          if (replacement) {
            await images.setCoverState(propertyId, replacement.id, true);
          }
        }
        const deleted = await images.deleteForProperty(propertyId, imageId);
        if (!deleted) throw imageNotFound();
      } catch (error) {
        try {
          const mimeType = image.storage_path.endsWith('.png')
            ? 'image/png'
            : image.storage_path.endsWith('.webp')
              ? 'image/webp'
              : 'image/jpeg';
          await storage.upload(image.storage_path, backup, mimeType);
          await restoreCover(propertyId, image, replacement);
        } catch {
          console.error('Property image deletion compensation failed.');
        }
        throw error;
      }

      const remaining = await images.listForProperty(propertyId);
      return Promise.all(remaining.map(present));
    },
  });
}

export const propertyImageService = createPropertyImageService();
