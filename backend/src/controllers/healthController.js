import { getHealthStatus } from '../services/healthService.js';

export function getHealth(_request, response) {
  response.status(200).json({
    success: true,
    data: getHealthStatus(),
  });
}
