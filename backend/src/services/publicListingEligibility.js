export const PUBLIC_LISTING_STATUS = 'ACTIVE';

export function isPublicListingEligible(listing) {
  return (
    listing?.status === PUBLIC_LISTING_STATUS &&
    listing.property?.archived_at == null
  );
}
