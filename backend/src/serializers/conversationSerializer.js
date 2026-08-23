function counterparty(profile) {
  return {
    first_name: profile.first_name,
    last_name: profile.last_name,
    profile_photo_url: profile.profile_photo_url ?? null,
  };
}

export function serializeConversation(
  conversation,
  { counterpartyProfile, availability, listing },
) {
  return {
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
}
