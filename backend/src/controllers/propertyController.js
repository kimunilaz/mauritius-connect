import { serializeProperty } from '../serializers/propertySerializer.js';
import { propertyService as defaultPropertyService } from '../services/propertyService.js';
import { propertyImageService as defaultPropertyImageService } from '../services/propertyImageService.js';

export function createPropertyController(
  service = defaultPropertyService,
  imageService = defaultPropertyImageService,
) {
  return Object.freeze({
    async create(request, response) {
      const property = await service.create(request.auth.userId, request.body);
      response
        .status(201)
        .json({ success: true, data: serializeProperty(property) });
    },

    async list(request, response) {
      const query = request.validatedQuery;
      const result = await service.list(request.auth.userId, query);
      response.json({
        success: true,
        data: result.properties.map(serializeProperty),
        meta: {
          page: query.page,
          limit: query.limit,
          total: result.total,
          total_pages: Math.ceil(result.total / query.limit),
        },
      });
    },

    async get(request, response) {
      const property = await service.get(
        request.auth.userId,
        request.params.propertyId,
      );
      const images = await imageService.list(
        request.auth.userId,
        request.params.propertyId,
        property,
      );
      response.json({
        success: true,
        data: { ...serializeProperty(property), images },
      });
    },

    async update(request, response) {
      const property = await service.update(
        request.auth.userId,
        request.params.propertyId,
        request.body,
      );
      response.json({ success: true, data: serializeProperty(property) });
    },

    async archive(request, response) {
      const property = await service.archive(
        request.auth.userId,
        request.params.propertyId,
      );
      response.json({ success: true, data: serializeProperty(property) });
    },
  });
}
