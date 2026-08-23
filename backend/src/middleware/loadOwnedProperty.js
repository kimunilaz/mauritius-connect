import { propertyImageService as defaultPropertyImageService } from '../services/propertyImageService.js';

export function createLoadOwnedProperty(
  service = defaultPropertyImageService,
  options = {},
) {
  return async function loadOwnedProperty(request, _response, next) {
    request.ownedProperty = await service.assertOwnedProperty(
      request.auth.userId,
      request.params.propertyId,
      options,
    );
    next();
  };
}
