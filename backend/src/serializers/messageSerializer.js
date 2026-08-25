export function serializeMessage(message, viewerId) {
  return {
    id: message.id,
    body: message.content,
    created_at: message.created_at,
    sender: {
      is_me: message.sender_user_id === viewerId,
    },
  };
}
