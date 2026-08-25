import { randomUUID } from 'node:crypto';
import { AppError } from '../middleware/AppError.js';
import { processPropertyImage } from './imageProcessor.js';
import { verificationRepository as defaultRepository } from '../repositories/verificationRepository.js';
import { verificationStorageService as defaultStorage } from './verificationStorageService.js';
const fail = (s, c, m) => new AppError({ statusCode: s, code: c, message: m });
function safe(row) {
  return row
    ? {
        id: row.id,
        type: row.verification_type,
        status: row.status,
        created_at: row.created_at,
        updated_at: row.updated_at,
        rejection_reason: row.rejection_reason ?? null,
        evidence_count: row.evidence_count ?? 0,
      }
    : null;
}
export function createVerificationService({
  repository = defaultRepository,
  storage = defaultStorage,
} = {}) {
  return Object.freeze({
    async create(userId, input) {
      const r = await repository.create({
        userId,
        type: input.type,
        propertyId: input.property_id,
      });
      if (r?.outcome === 'NOT_FOUND')
        throw fail(404, 'PROPERTY_NOT_FOUND', 'Property not found.');
      if (r?.outcome === 'INVALID')
        throw fail(422, 'VALIDATION_ERROR', 'Unsupported verification type.');
      return safe(await repository.get(r.verification_id));
    },
    async list(userId, opts) {
      const r = await repository.list({ userId, ...opts });
      return { items: r.data.map(safe), total: r.count };
    },
    async get(userId, id, admin = false) {
      const row = await repository.get(id);
      if (!row)
        throw fail(404, 'VERIFICATION_NOT_FOUND', 'Verification not found.');
      if (!admin) {
        const mine =
          (row.subject_type === 'USER' && row.subject_id === userId) ||
          (row.subject_type === 'PROPERTY' &&
            (await repository.ownsProperty(userId, row.subject_id)));
        if (!mine)
          throw fail(404, 'VERIFICATION_NOT_FOUND', 'Verification not found.');
      }
      return safe(row);
    },
    async moderate(adminId, id, status, reason) {
      const r = await repository.moderate(id, adminId, status, reason);
      if (r?.outcome === 'NOT_FOUND')
        throw fail(404, 'VERIFICATION_NOT_FOUND', 'Verification not found.');
      if (r?.outcome === 'INVALID_TRANSITION')
        throw fail(
          409,
          'INVALID_VERIFICATION_TRANSITION',
          'This verification action is not allowed.',
        );
      if (r?.outcome === 'FORBIDDEN')
        throw fail(403, 'FORBIDDEN', 'Forbidden.');
      return {
        status: r.verification_status,
        transitioned: r.outcome === 'TRANSITIONED',
      };
    },
    async evidence(userId, id, file) {
      const row = await repository.get(id);
      if (
        !row ||
        row.status !== 'PENDING' ||
        (!(row.subject_type === 'USER' && row.subject_id === userId) &&
          !(
            row.subject_type === 'PROPERTY' &&
            (await repository.ownsProperty(userId, row.subject_id))
          ))
      )
        throw fail(404, 'VERIFICATION_NOT_FOUND', 'Verification not found.');
      if (!file)
        throw fail(422, 'INVALID_EVIDENCE', 'Upload one evidence file.');
      if ((row.evidence_count ?? 0) >= 5)
        throw fail(422, 'EVIDENCE_LIMIT', 'Maximum evidence files reached.');
      let buffer = file.buffer,
        mime = file.mimetype,
        ext = 'pdf';
      if (mime.startsWith('image/')) {
        const p = await processPropertyImage(buffer);
        buffer = p.buffer;
        mime = p.mimeType;
        ext = p.extension;
      } else if (mime !== 'application/pdf' || buffer.length > 10 * 1024 * 1024)
        throw fail(
          422,
          'INVALID_EVIDENCE',
          'Upload a valid PDF, JPEG, PNG, or WebP.',
        );
      const path = `${userId}/${id}/${randomUUID()}.${ext}`;
      await storage.upload(path, buffer, mime);
      await repository.addEvidence(id, {
        evidence_path: path,
        evidence_filename: null,
        evidence_mime_type: mime,
        evidence_size_bytes: buffer.length,
        evidence_count: (row.evidence_count ?? 0) + 1,
      });
      return { id, evidence_count: (row.evidence_count ?? 0) + 1 };
    },
    async evidenceUrl(userId, id, admin = false) {
      const row = await repository.get(id);
      if (!row || !row.evidence_path)
        throw fail(404, 'EVIDENCE_NOT_FOUND', 'Evidence not found.');
      if (
        !admin &&
        !(row.subject_type === 'USER' && row.subject_id === userId) &&
        !(
          row.subject_type === 'PROPERTY' &&
          (await repository.ownsProperty(userId, row.subject_id))
        )
      )
        throw fail(404, 'VERIFICATION_NOT_FOUND', 'Verification not found.');
      return { url: await storage.signedUrl(row.evidence_path) };
    },
  });
}
export const verificationService = createVerificationService();
