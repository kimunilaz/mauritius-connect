function publicProperty(property) {
  return {
    property_type: property.property_type,
    district: property.district,
    locality: property.locality,
    neighbourhood: property.neighbourhood ?? null,
    bedrooms: property.bedrooms,
    bathrooms: Number(property.bathrooms),
    furnished: property.furnished,
    parking_spaces: property.parking_spaces,
    property_information_verified: property.verification_status === 'VERIFIED',
  };
}

function publicListingBase(listing) {
  return {
    id: listing.id,
    title: listing.title,
    monthly_rent: Number(listing.monthly_rent),
    available_from: listing.available_from,
    minimum_lease_months: listing.minimum_lease_months ?? null,
    maximum_occupants: listing.maximum_occupants ?? null,
    pets_allowed: listing.pets_allowed,
    published_at: listing.published_at,
    property: publicProperty(listing.property),
  };
}

export function serializePublicListingCard(listing, coverImageUrl) {
  return {
    ...publicListingBase(listing),
    cover_image_url: coverImageUrl,
  };
}

export function serializePublicListingDetail(listing, images) {
  return {
    ...publicListingBase(listing),
    description: listing.description,
    deposit_amount:
      listing.deposit_amount === null ? null : Number(listing.deposit_amount),
    images,
  };
}
