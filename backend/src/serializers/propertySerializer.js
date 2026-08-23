export function serializeProperty(property) {
  return {
    id: property.id,
    property_type: property.property_type,
    address_line_1: property.address_line_1 ?? null,
    address_line_2: property.address_line_2 ?? null,
    district: property.district,
    locality: property.locality,
    neighbourhood: property.neighbourhood ?? null,
    latitude: property.latitude === null ? null : Number(property.latitude),
    longitude: property.longitude === null ? null : Number(property.longitude),
    bedrooms: property.bedrooms,
    bathrooms: Number(property.bathrooms),
    furnished: property.furnished,
    parking_spaces: property.parking_spaces,
    verification_status: property.verification_status,
    archived_at: property.archived_at ?? null,
    created_at: property.created_at,
    updated_at: property.updated_at,
  };
}
