function counterparty(profile) {
  return {
    first_name: profile.first_name,
    last_name: profile.last_name,
    profile_photo_url: profile.profile_photo_url ?? null,
  };
}

export function serializeConversation(
  conversation,
  { counterpartyProfile, availability, listing, viewerId },
) {
  const result = {
    id: conversation.id,
    created_at: conversation.created_at,
    updated_at: conversation.updated_at,
    counterparty: counterparty(counterpartyProfile),
    listing_context: {
      listing_id: conversation.listing_id,
      availability,
      listing,
    },
  };
  if (conversation.unread_count !== undefined) {
    result.unread_count = conversation.unread_count;
    result.last_message = conversation.last_message
      ? {
          body: conversation.last_message.content,
          created_at: conversation.last_message.created_at,
          is_me: conversation.last_message.sender_user_id === viewerId,
        }
      : null;
  }
  return result;
}
