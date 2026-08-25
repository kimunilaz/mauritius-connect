import { AppError } from '../middleware/AppError.js';
import { reportRepository as defaultRepository } from '../repositories/reportRepository.js';
import {
  serializeReportDetail,
  serializeReportListItem,
} from '../serializers/reportSerializer.js';

function error(statusCode, code, message) {
  return new AppError({ statusCode, code, message });
}

function targetNotFound(targetType) {
  return error(
    404,
    targetType === 'MESSAGE' ? 'MESSAGE_NOT_FOUND' : 'LISTING_NOT_FOUND',
    targetType === 'MESSAGE' ? 'Message not found.' : 'Listing not found.',
  );
}

function reportNotFound() {
  return error(404, 'REPORT_NOT_FOUND', 'Report not found.');
}

function mapCreate(result, input) {
  if (!result || result.outcome === 'NOT_FOUND')
    throw targetNotFound(input.target_type);
  if (result.outcome === 'INVALID_TARGET') {
    throw error(
      422,
      'VALIDATION_ERROR',
      'This report target is not supported.',
    );
  }
  if (result.outcome === 'INVALID_REASON') {
    throw error(
      422,
      'VALIDATION_ERROR',
      'This reason is not valid for the selected target.',
    );
  }
  if (!['CREATED', 'EXISTING'].includes(result.outcome)) {
    throw new Error('Unexpected report creation outcome.');
  }
  return { id: result.report_id, created: result.outcome === 'CREATED' };
}

function mapModeration(result) {
  if (!result || result.outcome === 'NOT_FOUND') throw reportNotFound();
  if (result.outcome === 'INVALID_TRANSITION') {
    throw error(
      409,
      'INVALID_REPORT_TRANSITION',
      'This report action is not allowed from its current state.',
    );
  }
  if (!['TRANSITIONED', 'ALREADY_TARGET'].includes(result.outcome)) {
    throw new Error('Unexpected report moderation outcome.');
  }
  return {
    status: result.report_status,
    transitioned: result.outcome === 'TRANSITIONED',
  };
}

export function createReportService({ reports = defaultRepository } = {}) {
  return Object.freeze({
    async create(userId, input) {
      return mapCreate(
        await reports.create({
          reporterUserId: userId,
          targetType: input.target_type,
          targetId: input.target_id,
          reason: input.reason,
          details: input.details,
        }),
        input,
      );
    },
    async list(userId, options) {
      void userId;
      const result = await reports.list(options);
      return {
        reports: result.reports.map(serializeReportListItem),
        total: result.total,
      };
    },
    async get(userId, reportId) {
      void userId;
      const report = await reports.findById(reportId);
      if (!report) throw reportNotFound();
      return serializeReportDetail(report);
    },
    async moderate(userId, reportId, status, reason) {
      return mapModeration(
        await reports.moderate(reportId, userId, status, reason),
      );
    },
  });
}

export const reportService = createReportService();
