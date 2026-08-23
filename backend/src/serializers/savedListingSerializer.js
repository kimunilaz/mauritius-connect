export function serializeSavedListing(save, listing) {
  return {
    listing_id: save.listing_id,
    saved_at: save.created_at,
    availability: listing ? 'AVAILABLE' : 'UNAVAILABLE',
    listing,
  };
}

export function serializeSavedStatus(listingId, saved) {
  return { listing_id: listingId, saved };
}
