import { z } from 'zod';
const text = (max = 4000) => z.string().trim().max(max).nullable().optional();
const required = (max = 200) => z.string().trim().min(1).max(max);
const date = z.iso.date();
const money = z.number().finite().min(0).max(9999999999.99).multipleOf(0.01);
const link = z.uuid().nullable().optional();
const tenancy = { tenancy_id: link };
export const operationFields = {
  details: {
    reference_name: text(150),
    floor_area: money.nullable().optional(),
    acquisition_notes: text(),
    utilities_notes: text(),
    access_notes: text(),
    owner_notes: text(),
  },
  tenancies: {
    tenant_name: required(),
    tenant_contact: text(250),
    application_id: link,
    start_date: date,
    expected_end_date: date.nullable().optional(),
    monthly_rent: money,
    deposit_amount: money.nullable().optional(),
    status: z
      .enum(['UPCOMING', 'ACTIVE', 'ENDING', 'ENDED', 'CANCELLED'])
      .default('UPCOMING'),
    end_date: date.nullable().optional(),
    move_in_date: date.nullable().optional(),
    move_out_date: date.nullable().optional(),
    move_in_notes: text(),
    move_out_notes: text(),
  },
  rent: {
    tenancy_id: z.uuid(),
    period: date.refine(
      (v) => v.endsWith('-01'),
      'Use the first day of the rent month.',
    ),
    due_date: date,
    amount_due: money,
    waived: z.boolean().default(false),
    notes: text(),
  },
  maintenance: {
    ...tenancy,
    title: required(),
    description: required(4000),
    category: z
      .enum([
        'PLUMBING',
        'ELECTRICAL',
        'APPLIANCE',
        'STRUCTURAL',
        'GENERAL',
        'OTHER',
      ])
      .default('OTHER'),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
    status: z
      .enum([
        'NEW',
        'ACKNOWLEDGED',
        'SCHEDULED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
      ])
      .default('NEW'),
    scheduled_date: date.nullable().optional(),
    estimated_cost: money.nullable().optional(),
    actual_cost: money.nullable().optional(),
    owner_notes: text(),
    vendor_name: text(200),
    vendor_contact: text(250),
    service_type: text(150),
    owner_update: text(),
  },
  inspections: {
    ...tenancy,
    inspection_date: date,
    type: z.enum(['MOVE_IN', 'MOVE_OUT', 'ROUTINE', 'OWNER', 'OTHER']),
    status: z
      .enum(['SCHEDULED', 'COMPLETED', 'CANCELLED'])
      .default('SCHEDULED'),
    notes: text(),
    condition_notes: text(),
    meter_notes: text(),
    access_notes: text(),
    next_inspection_date: date.nullable().optional(),
    checklist: z
      .array(
        z
          .object({
            label: required(100),
            condition: z.enum(['GOOD', 'NEEDS_ATTENTION', 'NOT_CHECKED']),
            notes: text(1000),
          })
          .strict(),
      )
      .max(30)
      .default([]),
  },
  finances: {
    ...tenancy,
    kind: z.enum(['INCOME', 'EXPENSE']),
    category: z.enum([
      'RENT',
      'DEPOSIT',
      'UTILITY_REIMBURSEMENT',
      'MAINTENANCE',
      'UTILITIES',
      'INSURANCE',
      'TAX',
      'SERVICE',
      'SUPPLIES',
      'OTHER',
    ]),
    amount: money.positive(),
    record_date: date,
    description: text(),
    vendor: text(200),
    document_id: link,
    maintenance_id: link,
    voided: z.boolean().default(false),
  },
  tasks: {
    ...tenancy,
    title: required(),
    due_date: date,
    status: z.enum(['OPEN', 'COMPLETED', 'CANCELLED']).default('OPEN'),
    notes: text(),
  },
  documents: {
    ...tenancy,
    maintenance_id: link,
    inspection_id: link,
    shared_tenancy_id: link,
    category: z.enum([
      'OWNERSHIP',
      'LEASE',
      'INSPECTION',
      'MAINTENANCE',
      'INSURANCE',
      'RECEIPT',
      'UTILITY',
      'OTHER',
    ]),
    description: text(),
  },
};
export const operationTables = {
  details: 'property_operational_details',
  tenancies: 'tenancies',
  rent: 'rent_ledger_entries',
  maintenance: 'maintenance_requests',
  inspections: 'property_inspections',
  finances: 'property_financial_records',
  tasks: 'property_tasks',
  documents: 'property_documents',
};
export const domainSchema = z.enum(Object.keys(operationTables));
export const operationQuery = z
  .object({
    property_id: z.uuid().optional(),
    owner_id: z.uuid().optional(),
    occupancy: z
      .enum(['OCCUPIED', 'VACANT', 'NOTICE_GIVEN', 'INACTIVE'])
      .optional(),
    location: z.string().trim().max(150).optional(),
    tenancy_id: z.uuid().optional(),
    status: required(40).optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
    from: date.optional(),
    to: date.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict()
  .refine((v) => !v.from || !v.to || v.from <= v.to, 'Invalid date range.');
export function operationInput(domain, update = false, tenant = false) {
  let fields = operationFields[domain];
  if (tenant)
    fields = {
      tenancy_id: z.uuid(),
      title: fields.title,
      description: fields.description,
      category: fields.category,
    };
  if (update)
    fields = Object.fromEntries(
      Object.entries(fields)
        .filter(([k]) => !['application_id', 'tenancy_id'].includes(k))
        .map(([k, v]) => [
          k,
          (v instanceof z.ZodDefault ? v.removeDefault() : v).optional(),
        ]),
    );
  return z
    .object({
      ...fields,
      ...(update && domain === 'documents'
        ? { archived: z.boolean().optional() }
        : {}),
      ...(update
        ? { version: z.number().int().positive() }
        : { property_id: z.uuid() }),
    })
    .strict();
}
export const receiptSchema = z
  .object({
    amount: money.positive(),
    received_on: date,
    reference: text(250),
    request_key: z.uuid(),
  })
  .strict();
export const invitationSchema = z
  .object({ code: z.string().regex(/^[a-f0-9]{64}$/) })
  .strict();
