import { AppError } from '../middleware/AppError.js';
import { notificationRepository as defaultRepository } from '../repositories/notificationRepository.js';
import { serializeNotification } from '../serializers/notificationSerializer.js';

function notFound() {
  return new AppError({
    statusCode: 404,
    code: 'NOTIFICATION_NOT_FOUND',
    message: 'Notification not found.',
  });
}

export function createNotificationService({
  notifications = defaultRepository,
} = {}) {
  return Object.freeze({
    async list(userId, role, options) {
      const result = await notifications.listForUser(userId, options);
      return {
        data: result.notifications.map((item) =>
          serializeNotification(item, role),
        ),
        total: result.total,
      };
    },
    async unreadCount(userId) {
      return notifications.unreadCount(userId);
    },
    async markRead(userId, notificationId) {
      const item = await notifications.markRead(notificationId, userId);
      if (!item) throw notFound();
      return item;
    },
    async markAllRead(userId) {
      await notifications.markAllRead(userId);
    },
  });
}

export const notificationService = createNotificationService();
