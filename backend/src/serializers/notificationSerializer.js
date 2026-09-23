function targetFor(notification, role) {
  if (!notification.entity_id) return null;
  if (
    notification.entity_type === 'PROPERTY' &&
    ['LANDLORD', 'AGENT'].includes(role)
  )
    return `/owner/properties/${notification.entity_id}?tab=maintenance`;
  if (notification.entity_type === 'TENANCY' && role === 'TENANT')
    return '/tenant/home';
  if (notification.entity_type === 'CONVERSATION') {
    return `/conversations/${notification.entity_id}`;
  }
  if (notification.entity_type === 'APPLICATION') {
    return ['LANDLORD', 'AGENT'].includes(role)
      ? `/landlord/applications/${notification.entity_id}`
      : `/tenant/applications/${notification.entity_id}`;
  }
  return null;
}

export function serializeNotification(notification, role) {
  return {
    id: notification.id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    read_at: notification.read_at ?? null,
    created_at: notification.created_at,
    target: targetFor(notification, role),
  };
}
