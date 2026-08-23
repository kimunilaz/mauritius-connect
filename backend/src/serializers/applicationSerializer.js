export function serializeApplication(application) {
  return {
    id: application.id,
    listing_id: application.listing_id,
    move_in_date: application.move_in_date ?? null,
    requested_lease_duration_months:
      application.requested_lease_duration_months ?? null,
    number_of_occupants: application.number_of_occupants ?? null,
    introductory_message: application.introductory_message ?? null,
    status: application.status,
    created_at: application.created_at,
    updated_at: application.updated_at,
  };
}

export function serializeSubmittedApplication(application) {
  return {
    ...serializeApplication(application),
    submitted_at: application.submitted_at,
  };
}

export function serializeTenantApplicationListItem(application, listing) {
  return {
    id: application.id,
    listing_id: application.listing_id,
    status: application.status,
    move_in_date: application.move_in_date ?? null,
    requested_lease_duration_months:
      application.requested_lease_duration_months ?? null,
    number_of_occupants: application.number_of_occupants ?? null,
    submitted_at: application.submitted_at ?? null,
    updated_at: application.updated_at,
    availability: listing ? 'AVAILABLE' : 'UNAVAILABLE',
    listing,
  };
}

export function serializeTenantApplicationAnswer(answer, includeQuestion) {
  return {
    question_id: answer.question_id,
    ...(includeQuestion
      ? {
          question_text: answer.question.question_text,
          question_type: answer.question.question_type,
        }
      : {}),
    answer_text: answer.answer_text,
    updated_at: answer.updated_at,
  };
}

export function serializeApplicationHistory(history) {
  return history.map(({ from_status, to_status, created_at }) => ({
    from_status,
    to_status,
    created_at,
  }));
}

export function serializeTenantApplicationDetail({
  application,
  listing,
  answers,
  history,
}) {
  const includeQuestion = application.status !== 'DRAFT' || Boolean(listing);
  return {
    ...serializeApplication(application),
    submitted_at: application.submitted_at ?? null,
    withdrawn_at: application.withdrawn_at ?? null,
    availability: listing ? 'AVAILABLE' : 'UNAVAILABLE',
    listing,
    answers: answers.map((answer) =>
      serializeTenantApplicationAnswer(answer, includeQuestion),
    ),
    history: serializeApplicationHistory(history),
  };
}
