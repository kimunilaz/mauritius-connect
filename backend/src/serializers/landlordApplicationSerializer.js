function applicantIdentity(identity) {
  return {
    first_name: identity.first_name,
    last_name: identity.last_name,
    profile_photo_url: identity.profile_photo_url ?? null,
  };
}

export function serializeLandlordApplicantListItem(application, identity) {
  return {
    application_id: application.id,
    status: application.status,
    submitted_at: application.submitted_at,
    move_in_date: application.move_in_date ?? null,
    requested_lease_duration_months:
      application.requested_lease_duration_months ?? null,
    number_of_occupants: application.number_of_occupants ?? null,
    updated_at: application.updated_at,
    tenant: applicantIdentity(identity),
  };
}

function safeProperty(property) {
  return {
    property_type: property.property_type,
    district: property.district,
    locality: property.locality,
    bedrooms: property.bedrooms,
    bathrooms: Number(property.bathrooms),
    furnished: property.furnished,
    parking_spaces: property.parking_spaces,
  };
}

function safeListing(listing) {
  return {
    id: listing.id,
    title: listing.title,
    status: listing.status,
    property: safeProperty(listing.property),
  };
}

function safeAnswer(answer) {
  return {
    question_text: answer.question.question_text,
    question_type: answer.question.question_type,
    answer_text: answer.answer_text,
  };
}

function safeHistory(history) {
  return history.map(({ from_status, to_status, created_at }) => ({
    from_status,
    to_status,
    created_at,
  }));
}

export function serializeLandlordApplicationDetail({
  application,
  identity,
  listing,
  answers,
  history,
}) {
  return {
    id: application.id,
    status: application.status,
    move_in_date: application.move_in_date ?? null,
    requested_lease_duration_months:
      application.requested_lease_duration_months ?? null,
    number_of_occupants: application.number_of_occupants ?? null,
    introductory_message: application.introductory_message ?? null,
    submitted_at: application.submitted_at,
    created_at: application.created_at,
    updated_at: application.updated_at,
    tenant: applicantIdentity(identity),
    listing: safeListing(listing),
    answers: answers.map(safeAnswer),
    history: safeHistory(history),
  };
}
