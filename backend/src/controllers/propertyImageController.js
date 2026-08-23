import { propertyImageService as defaultPropertyImageService } from '../services/propertyImageService.js';

export function createPropertyImageController(
  service = defaultPropertyImageService,
) {
  return Object.freeze({
    async upload(request, response) {
      const image = await service.upload(
        request.auth.userId,
        request.params.propertyId,
        request.file,
        request.ownedProperty,
      );
      response.status(201).json({ success: true, data: image });
    },

    async update(request, response) {
      const image = await service.update(
        request.auth.userId,
        request.params.propertyId,
        request.params.imageId,
        request.body,
        request.ownedProperty,
      );
      response.json({ success: true, data: image });
    },

    async delete(request, response) {
      const images = await service.delete(
        request.auth.userId,
        request.params.propertyId,
        request.params.imageId,
        request.ownedProperty,
      );
      response.json({ success: true, data: images });
    },
  });
}
