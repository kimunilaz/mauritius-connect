function propertySummary(property) {
  return {
    id: property.id,
    property_type: property.property_type,
    district: property.district,
    locality: property.locality,
    bedrooms: property.bedrooms,
    bathrooms: Number(property.bathrooms),
    furnished: property.furnished,
    parking_spaces: property.parking_spaces,
    verification_status: property.verification_status,
    archived_at: property.archived_at ?? null,
  };
}

export function serializeListing(listing, { coverImage, images } = {}) {
  const serialized = {
    id: listing.id,
    property_id: listing.property_id,
    title: listing.title,
    description: listing.description,
    monthly_rent: Number(listing.monthly_rent),
    deposit_amount:
      listing.deposit_amount === null ? null : Number(listing.deposit_amount),
    available_from: listing.available_from,
    minimum_lease_months: listing.minimum_lease_months ?? null,
    maximum_occupants: listing.maximum_occupants ?? null,
    pets_allowed: listing.pets_allowed,
    status: listing.status,
    published_at: listing.published_at ?? null,
    closed_at: listing.closed_at ?? null,
    created_at: listing.created_at,
    updated_at: listing.updated_at,
    property: propertySummary(listing.property),
  };
  if (coverImage !== undefined) serialized.cover_image = coverImage;
  if (images !== undefined) serialized.images = images;
  return serialized;
}
