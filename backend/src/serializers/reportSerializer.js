function serializeReporter(reporter) {
  if (!reporter) return null;
  return {
    first_name: reporter.first_name,
    last_name: reporter.last_name,
  };
}

export function serializeReportListItem(report) {
  return {
    id: report.id,
    target_type: report.target_type,
    reason: report.reason,
    status: report.status,
    created_at: report.created_at,
    updated_at: report.updated_at,
    reporter: serializeReporter(report.reporter),
  };
}

export function serializeReportDetail(report) {
  return {
    ...serializeReportListItem(report),
    details: report.description ?? null,
    target: report.target ?? null,
  };
}
