import { notificationService as defaultService } from '../services/notificationService.js';

export function createNotificationController(service = defaultService) {
  return Object.freeze({
    async list(request, response) {
      const result = await service.list(
        request.auth.userId,
        request.profile.role,
        request.validatedQuery,
      );
      const { page, limit } = request.validatedQuery;
      response.json({
        success: true,
        data: result.data,
        meta: {
          page,
          limit,
          total: result.total,
          total_pages: Math.ceil(result.total / limit),
        },
      });
    },
    async unreadCount(request, response) {
      response.json({
        success: true,
        data: { unread_count: await service.unreadCount(request.auth.userId) },
      });
    },
    async markRead(request, response) {
      await service.markRead(
        request.auth.userId,
        request.params.notificationId,
      );
      response.json({ success: true, data: { read: true } });
    },
    async markAllRead(request, response) {
      await service.markAllRead(request.auth.userId);
      response.json({ success: true, data: { read: true } });
    },
  });
}
