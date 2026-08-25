import { AppError } from '../middleware/AppError.js';
import { applicationAcceptanceRepository as r } from '../repositories/applicationAcceptanceRepository.js';
const e = (code, message) =>
  new AppError({
    statusCode: code === 'APPLICATION_NOT_FOUND' ? 404 : 409,
    code,
    message,
  });
export function createApplicationAcceptanceService(repository = r) {
  return {
    async accept(userId, id) {
      const x = await repository.accept(userId, id);
      if (x?.outcome === 'NOT_FOUND')
        throw e('APPLICATION_NOT_FOUND', 'Application not found.');
      if (x?.outcome === 'INVALID_TRANSITION')
        throw e(
          'INVALID_APPLICATION_TRANSITION',
          'This application cannot be accepted in its current state.',
        );
      return {
        application_status: x.current_status,
        listing_status: x.listing_status,
        transitioned: x.outcome === 'TRANSITIONED',
      };
    },
  };
}

export const applicationAcceptanceService =
  createApplicationAcceptanceService();
