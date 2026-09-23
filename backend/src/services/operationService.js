import { propertyImageStorageService } from './propertyImageStorageService.js';
import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { AppError } from '../middleware/AppError.js';
import { operationRepository } from '../repositories/operationRepository.js';
import { getPrivilegedSupabaseClient } from '../config/supabase.js';
import { processPropertyImage } from './imageProcessor.js';
const fail = (code = 404, message = 'Record not found.') =>
  new AppError({
    statusCode: code,
    code: code === 404 ? 'OPERATION_NOT_FOUND' : 'OPERATION_CONFLICT',
    message,
  });
const pick = (r, keys) =>
  Object.fromEntries(
    keys.filter((k) => Object.hasOwn(r, k)).map((k) => [k, r[k]]),
  );
const tenantFields = {
  rent: [
    'id',
    'property_id',
    'tenancy_id',
    'period',
    'due_date',
    'amount_due',
    'waived',
    'amount_paid',
    'outstanding',
    'rent_status',
    'receipts',
  ],
  maintenance: [
    'id',
    'property_id',
    'tenancy_id',
    'title',
    'description',
    'category',
    'priority',
    'status',
    'scheduled_date',
    'completed_at',
    'owner_update',
    'created_at',
    'updated_at',
  ],
  documents: [
    'id',
    'property_id',
    'category',
    'filename',
    'description',
    'mime_type',
    'size_bytes',
    'created_at',
  ],
};
export function rentStatus(entry, paid, today) {
  if (entry.waived) return 'WAIVED';
  if (paid >= Number(entry.amount_due)) return 'PAID';
  if (entry.due_date < today) return 'OVERDUE';
  if (paid > 0) return 'PARTIALLY_PAID';
  return entry.due_date === today ? 'DUE' : 'UPCOMING';
}
export function createOperationService({
  repository = operationRepository,
  clock = () => new Date(),
  storage = () =>
    getPrivilegedSupabaseClient().storage.from('property-operations'),
} = {}) {
  const today = () => clock().toISOString().slice(0, 10);
  async function owned(user, id, writable = false) {
    const p = await repository.owns(user, id);
    if (!p) throw fail();
    if (writable && p.archived_at)
      throw fail(409, 'Archived property records are read-only.');
    return p;
  }
  async function linked(input, propertyId) {
    for (const [key, domain] of [
      ['tenancy_id', 'tenancies'],
      ['shared_tenancy_id', 'tenancies'],
      ['maintenance_id', 'maintenance'],
      ['inspection_id', 'inspections'],
      ['document_id', 'documents'],
    ])
      if (
        input[key] &&
        !(await repository.related(domain, input[key], propertyId))
      )
        throw fail();
  }
  async function tenant(user, id, active = false) {
    const t = await repository.tenantTenancy(user, id);
    if (
      !t ||
      (t.end_date && t.end_date < today()) ||
      (t.expected_end_date && t.expected_end_date < today()) ||
      (active && (t.start_date > today() || t.status === 'UPCOMING'))
    )
      throw fail();
    return t;
  }
  async function present(domain, rows, tenantView = false) {
    return rows.map((r) => (tenantView ? pick(r, tenantFields[domain]) : r));
  }
  const service = {
    owned,
    async conversation(user, id) {
      return {
        id: await repository.rpc('tenancy_conversation', {
          p_actor: user,
          p_tenancy: id,
        }),
      };
    },
    async list(user, domain, query) {
      if (query.property_id) await owned(user, query.property_id);
      const r = await repository.list(user, domain, query);
      return { ...r, items: await present(domain, r.items) };
    },
    async get(user, domain, id) {
      const r = await repository.get(user, domain, id);
      if (!r) throw fail();
      const [row] = await present(domain, [r]);
      if (domain === 'maintenance') row.updates = await repository.history(id);
      return row;
    },
    async create(user, domain, input) {
      await owned(user, input.property_id, true);
      await linked(input, input.property_id);
      if (domain === 'maintenance') input = { ...input, submitted_by: user };
      if (domain === 'tenancies' && input.status === 'ENDED' && !input.end_date)
        throw fail(422, 'Provide the actual tenancy end date.');
      if (domain === 'finances') {
        if (input.maintenance_id) {
          const m = await repository.related(
            'maintenance',
            input.maintenance_id,
            input.property_id,
          );
          if (
            input.kind !== 'EXPENSE' ||
            input.category !== 'MAINTENANCE' ||
            m.status !== 'COMPLETED'
          )
            throw fail(
              422,
              'Link maintenance costs only to completed work as an expense.',
            );
        }
        if (
          input.kind === 'INCOME' &&
          [
            'MAINTENANCE',
            'UTILITIES',
            'INSURANCE',
            'TAX',
            'SERVICE',
            'SUPPLIES',
          ].includes(input.category)
        )
          throw fail(422, 'Choose an income category.');
        if (
          input.kind === 'EXPENSE' &&
          ['RENT', 'DEPOSIT', 'UTILITY_REIMBURSEMENT'].includes(input.category)
        )
          throw fail(422, 'Choose an expense category.');
      }
      return repository.create(domain, input);
    },
    async update(user, domain, id, input) {
      const old = await repository.get(user, domain, id);
      if (!old) throw fail();
      await owned(user, old.property_id, true);
      await linked(input, old.property_id);
      const { version, archived, ...fields } = input;
      if (domain === 'documents' && archived !== undefined)
        fields.archived_at = archived ? clock().toISOString() : null;
      if (
        ['finances', 'rent'].includes(domain) &&
        Object.keys(fields).some(
          (k) => !['voided', 'waived', 'notes'].includes(k),
        )
      )
        throw fail(
          422,
          'Financial history cannot be overwritten. Void or waive the record where allowed.',
        );
      const row = await repository.update(
        domain,
        id,
        old.property_id,
        version,
        fields,
      );
      if (!row) throw fail(409, 'This record changed. Reload before saving.');
      return row;
    },
    async receipt(user, id, input) {
      return repository.rpc('record_rent_receipt', {
        p_actor: user,
        p_ledger: id,
        p_amount: input.amount,
        p_received: input.received_on,
        p_reference: input.reference ?? null,
        p_key: input.request_key,
      });
    },
    async invite(user, id) {
      const row = await service.get(user, 'tenancies', id);
      if (row.tenant_user_id || ['ENDED', 'CANCELLED'].includes(row.status))
        throw fail(
          409,
          'Only an unlinked current or upcoming tenancy can be connected.',
        );
      const code = randomBytes(32).toString('hex');
      const updated = await repository.update(
        'tenancies',
        id,
        row.property_id,
        row.version,
        { invitation_hash: createHash('sha256').update(code).digest('hex') },
      );
      if (!updated) throw fail(409, 'Reload the tenancy.');
      return { code };
    },
    async claim(user, code) {
      return {
        id: await repository.rpc('claim_tenancy', {
          p_actor: user,
          p_hash: createHash('sha256').update(code).digest('hex'),
        }),
      };
    },
    async homes(user) {
      const rows = await repository.tenantHomes(user);
      return rows.filter(
        (t) =>
          (!t.end_date || t.end_date >= today()) &&
          (!t.expected_end_date || t.expected_end_date >= today()),
      );
    },
    async tenantList(user, domain, query) {
      await tenant(user, query.tenancy_id);
      const r = await repository.tenantList(
        domain,
        query.tenancy_id,
        query,
        user,
      );
      return { ...r, items: await present(domain, r.items, true) };
    },
    async tenantMaintenance(user, input) {
      const t = await tenant(user, input.tenancy_id, true);
      if (t.property_id !== input.property_id) throw fail();
      const row = await repository.create('maintenance', {
        ...input,
        submitted_by: user,
        status: 'NEW',
        priority: 'NORMAL',
      });
      return pick(row, tenantFields.maintenance);
    },
    async upload(user, input, file, isTenant = false) {
      if (isTenant) {
        const t = await tenant(user, input.tenancy_id, true);
        if (t.property_id !== input.property_id || !input.maintenance_id)
          throw fail();
        const m = await repository.related(
          'maintenance',
          input.maintenance_id,
          t.property_id,
        );
        if (!m || m.tenancy_id !== t.id) throw fail();
        input = {
          property_id: t.property_id,
          tenancy_id: t.id,
          maintenance_id: m.id,
          shared_tenancy_id: t.id,
          category: 'MAINTENANCE',
        };
      } else {
        await owned(user, input.property_id, true);
        await linked(input, input.property_id);
      }
      if (!file || file.size > 10485760)
        throw fail(422, 'Choose one PDF, JPEG, PNG or WebP file up to 10 MB.');
      let buffer = file.buffer,
        mime,
        ext;
      if (buffer.subarray(0, 5).toString() === '%PDF-') {
        if (!/%%EOF\s*$/.test(buffer.subarray(-1024).toString()))
          throw fail(422, 'The PDF is incomplete or invalid.');
        if (isTenant)
          throw fail(422, 'Maintenance attachments must be photos.');
        mime = 'application/pdf';
        ext = 'pdf';
      } else {
        const image = await processPropertyImage(buffer);
        buffer = image.buffer;
        mime = image.mimeType;
        ext = image.extension;
      }
      const path = `${user}/${input.property_id}/${randomUUID()}.${ext}`;
      const uploaded = await storage().upload(path, buffer, {
        contentType: mime,
        upsert: false,
      });
      if (uploaded.error) throw fail(503, 'File upload failed. Try again.');
      try {
        const document = await repository.create('documents', {
          ...input,
          filename:
            file.originalname.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 150) ||
            `document.${ext}`,
          storage_path: path,
          mime_type: mime,
          size_bytes: buffer.length,
          uploaded_by: user,
        });
        return isTenant ? pick(document, tenantFields.documents) : document;
      } catch (error) {
        await storage().remove([path]);
        throw error;
      }
    },
    async documentUrl(user, id, tenancyId) {
      let row;
      if (tenancyId) {
        const t = await tenant(user, tenancyId);
        row = await repository.related('documents', id, t.property_id);
        if (!row || row.shared_tenancy_id !== t.id || row.archived_at)
          throw fail();
      } else row = await service.get(user, 'documents', id);
      const path = await repository.storagePath(id, row.property_id);
      if (!path) throw fail();
      const { data, error } = await storage().createSignedUrl(path, 60, {
        download: row.filename,
      });
      if (error) throw fail(503, 'File unavailable. Try again.');
      return { url: data.signedUrl };
    },
    async leasing(user, propertyId, query) {
      if (propertyId) await owned(user, propertyId);
      return repository.leasing(user, propertyId, query);
    },
    async summary(user, query) {
      if (query.property_id) await owned(user, query.property_id);
      const result = await repository.rpc('owner_operations_summary', {
        p_owner: query.owner_id ?? null,
        p_actor: user,
        p_property: query.property_id ?? null,
        p_from: query.from ?? today().slice(0, 7) + '-01',
        p_to: query.to ?? today(),
        p_page: query.page,
        p_limit: query.limit,
        p_occupancy: query.occupancy ?? null,
        p_location: query.location ?? null,
      });
      result.portfolio = await Promise.all(
        result.portfolio.map(async ({ cover_path, ...p }) => ({
          ...p,
          cover_image_url: cover_path
            ? await propertyImageStorageService
                .signedUrl(cover_path)
                .catch(() => null)
            : null,
        })),
      );
      return result;
    },
  };
  return Object.freeze(service);
}
export const operationService = createOperationService();
