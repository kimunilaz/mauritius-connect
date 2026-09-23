export const label = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^./, (c) => c.toUpperCase());
export const money = (value) =>
  new Intl.NumberFormat('en-MU', { style: 'currency', currency: 'MUR' }).format(
    Number(value ?? 0),
  );
const field = (key, title, type = 'text', required = false, options) => ({
  key,
  title,
  type,
  required,
  options,
});
const status = (options) => field('status', 'Status', 'select', true, options);
const tenancy = field('tenancy_id', 'Related tenancy', 'tenancy');
export const configurations = {
  details: {
    title: 'Private property details',
    fields: [
      field('reference_name', 'Property reference name'),
      field('floor_area', 'Floor area (m²)', 'number'),
      field('acquisition_notes', 'Acquisition / reference notes', 'textarea'),
      field('utilities_notes', 'Utilities notes', 'textarea'),
      field('access_notes', 'Access notes (private)', 'textarea'),
      field('owner_notes', 'Owner notes (private)', 'textarea'),
    ],
  },
  tenancies: {
    title: 'Tenancies',
    fields: [
      field('tenant_name', 'Tenant name', 'text', true),
      field('tenant_contact', 'Tenant contact (private)'),
      field('application_id', 'Accepted application (optional)', 'application'),
      field('start_date', 'Start date', 'date', true),
      field('expected_end_date', 'Expected end date', 'date'),
      field('monthly_rent', 'Monthly rent (MUR)', 'number', true),
      field('deposit_amount', 'Deposit record (MUR)', 'number'),
      status(['UPCOMING', 'ACTIVE', 'ENDING', 'ENDED', 'CANCELLED']),
      field('end_date', 'Actual end date', 'date'),
      field('move_in_date', 'Move-in date', 'date'),
      field(
        'move_in_notes',
        'Move-in condition, meters, keys and checklist notes',
        'textarea',
      ),
      field('move_out_date', 'Move-out date', 'date'),
      field('move_out_notes', 'Move-out condition and final notes', 'textarea'),
    ],
  },
  rent: {
    title: 'Rent ledger',
    fields: [
      { ...tenancy, required: true },
      field('period', 'Rent month (first day)', 'date', true),
      field('due_date', 'Due date', 'date', true),
      field('amount_due', 'Amount due (MUR)', 'number', true),
      field('waived', 'Waived', 'checkbox'),
      field('notes', 'Private record notes', 'textarea'),
    ],
  },
  finances: {
    title: 'Income & expenses',
    fields: [
      tenancy,
      field('kind', 'Record type', 'select', true, ['INCOME', 'EXPENSE']),
      field('category', 'Category', 'select', true, [
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
      field('amount', 'Amount (MUR)', 'number', true),
      field('record_date', 'Record date', 'date', true),
      field('vendor', 'Vendor / payee'),
      field('description', 'Description', 'textarea'),
      field(
        'maintenance_id',
        'Completed maintenance (optional)',
        'maintenance',
      ),
      field('document_id', 'Receipt document (optional)', 'document'),
      field('voided', 'Void record', 'checkbox'),
    ],
  },
  maintenance: {
    title: 'Maintenance',
    fields: [
      tenancy,
      field('title', 'Issue title', 'text', true),
      field('description', 'Description', 'textarea', true),
      field('category', 'Category', 'select', true, [
        'PLUMBING',
        'ELECTRICAL',
        'APPLIANCE',
        'STRUCTURAL',
        'GENERAL',
        'OTHER',
      ]),
      field('priority', 'Priority', 'select', true, [
        'NORMAL',
        'LOW',
        'HIGH',
        'URGENT',
      ]),
      status([
        'NEW',
        'ACKNOWLEDGED',
        'SCHEDULED',
        'IN_PROGRESS',
        'COMPLETED',
        'CANCELLED',
      ]),
      field('scheduled_date', 'Scheduled date', 'date'),
      field('estimated_cost', 'Estimated cost (private, MUR)', 'number'),
      field('actual_cost', 'Actual cost (private, MUR)', 'number'),
      field('vendor_name', 'Vendor name (private)'),
      field('vendor_contact', 'Vendor contact (private)'),
      field('service_type', 'Service type'),
      field('owner_update', 'Update visible to the tenant', 'textarea'),
      field('owner_notes', 'Owner notes (private)', 'textarea'),
    ],
  },
  inspections: {
    title: 'Inspections',
    fields: [
      tenancy,
      field('type', 'Inspection type', 'select', true, [
        'MOVE_IN',
        'MOVE_OUT',
        'ROUTINE',
        'OWNER',
        'OTHER',
      ]),
      field('inspection_date', 'Inspection date', 'date', true),
      status(['SCHEDULED', 'COMPLETED', 'CANCELLED']),
      field('condition_notes', 'Condition observations (private)', 'textarea'),
      field('meter_notes', 'Meter readings / notes', 'textarea'),
      field('access_notes', 'Keys / access notes (private)', 'textarea'),
      field('notes', 'Inspection notes (private)', 'textarea'),
      field('next_inspection_date', 'Next inspection date', 'date'),
    ],
  },
  tasks: {
    title: 'Tasks',
    fields: [
      tenancy,
      field('title', 'Task title', 'text', true),
      field('due_date', 'Due date', 'date', true),
      status(['OPEN', 'COMPLETED', 'CANCELLED']),
      field('notes', 'Private notes', 'textarea'),
    ],
  },
  documents: {
    title: 'Documents',
    fields: [
      tenancy,
      field('category', 'Document category', 'select', true, [
        'OTHER',
        'OWNERSHIP',
        'LEASE',
        'INSPECTION',
        'MAINTENANCE',
        'INSURANCE',
        'RECEIPT',
        'UTILITY',
      ]),
      field('description', 'Description', 'textarea'),
      field('maintenance_id', 'Maintenance attachment', 'maintenance'),
      field('inspection_id', 'Inspection / move photos', 'inspection'),
      field(
        'shared_tenancy_id',
        'Share with this tenancy only (optional)',
        'tenancy',
      ),
    ],
  },
};
