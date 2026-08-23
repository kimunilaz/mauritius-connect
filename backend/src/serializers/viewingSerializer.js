export function serializeViewing(viewing) {
  return {
    id: viewing.id,
    start_time: viewing.start_time,
    end_time: viewing.end_time,
    status: viewing.status,
    notes: viewing.notes,
    created_at: viewing.created_at,
    updated_at: viewing.updated_at,
  };
}
