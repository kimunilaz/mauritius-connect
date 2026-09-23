import { useState } from 'react';
import { configurations, label } from './operationConfig.js';
const checklistLabels = [
  'Walls',
  'Floors',
  'Doors/windows',
  'Kitchen',
  'Bathroom',
  'Electrical',
  'Plumbing',
  'Furniture',
  'Exterior',
];
export default function OperationForm({
  domain,
  initial = {},
  related = {},
  onSave,
  onCancel,
  tenant = false,
}) {
  const [values, setValues] = useState(initial),
    [file, setFile] = useState(null),
    [error, setError] = useState(''),
    [saving, setSaving] = useState(false);
  const [checklist, setChecklist] = useState(
    initial.checklist ??
      checklistLabels.map((label) => ({
        label,
        condition: 'NOT_CHECKED',
        notes: '',
      })),
  );
  const editing = Boolean(initial.id);
  let fields = configurations[domain].fields;
  if (tenant)
    fields = fields.filter((f) =>
      ['title', 'description', 'category'].includes(f.key),
    );
  if (editing)
    fields = fields.filter(
      (f) => !['tenancy_id', 'application_id'].includes(f.key),
    );
  if (editing && ['rent', 'finances'].includes(domain))
    fields = fields.filter((f) =>
      ['notes', 'waived', 'voided'].includes(f.key),
    );
  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {};
      for (const f of fields) {
        const v = values[f.key];
        if (f.type === 'checkbox') payload[f.key] = Boolean(v);
        else if (v !== undefined && v !== '')
          payload[f.key] = f.type === 'number' ? Number(v) : v;
        else if (f.type === 'select') payload[f.key] = f.options[0];
        else if (editing) payload[f.key] = null;
      }
      if (domain === 'inspections') payload.checklist = checklist;
      if (editing) payload.version = initial.version;
      await onSave(payload, file);
    } catch (err) {
      setError(err.message ?? 'Unable to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }
  return (
    <form className="operation-form" onSubmit={submit}>
      <h3>
        {editing
          ? 'Edit record'
          : domain === 'documents'
            ? 'Upload document'
            : `Add ${label(domain === 'tenancies' ? 'tenancy' : domain === 'rent' ? 'rent record' : domain)}`}
      </h3>
      {domain === 'tenancies' && (
        <p>
          Confirm the dates and terms. An application is optional for an
          existing tenant.
        </p>
      )}
      {domain === 'finances' && (
        <p>
          Record rent receipts in the rent ledger. Do not enter the same receipt
          again as income.
        </p>
      )}
      {domain === 'documents' && (
        <p>
          Private by default. Only explicitly shared files are visible to the
          selected current or upcoming tenancy. Use this area for inspection,
          move-in/out photos and receipts.
        </p>
      )}
      <div className="operation-form-grid">
        {fields.map((f) => {
          const linked = {
            tenancy: 'tenancies',
            application: 'applications',
            maintenance: 'maintenance',
            inspection: 'inspections',
            document: 'documents',
          }[f.type];
          return (
            <label key={f.key}>
              {f.title}
              {f.required ? ' *' : ''}
              {f.type === 'textarea' ? (
                <textarea
                  value={values[f.key] ?? ''}
                  maxLength={4000}
                  required={f.required}
                  onChange={(e) =>
                    setValues({ ...values, [f.key]: e.target.value })
                  }
                />
              ) : f.type === 'select' || linked ? (
                <select
                  value={values[f.key] ?? (linked ? '' : f.options[0])}
                  required={f.required}
                  onChange={(e) => {
                    const selected =
                      f.key === 'application_id'
                        ? related.applications?.find(
                            (a) => a.id === e.target.value,
                          )
                        : null;
                    const name = selected?.tenant?.profile;
                    setValues({
                      ...values,
                      [f.key]: e.target.value,
                      ...(name
                        ? {
                            tenant_name: [name.first_name, name.last_name]
                              .filter(Boolean)
                              .join(' '),
                          }
                        : {}),
                    });
                  }}
                >
                  {linked ? (
                    <>
                      <option value="">None</option>
                      {(related[linked] ?? []).map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.tenant_name ??
                            r.title ??
                            r.filename ??
                            `${r.type ?? 'Application'} ${r.start_date ?? r.inspection_date ?? r.id.slice(0, 8)}`}
                        </option>
                      ))}
                    </>
                  ) : (
                    f.options.map((v) => (
                      <option key={v} value={v}>
                        {label(v)}
                      </option>
                    ))
                  )}
                </select>
              ) : (
                <input
                  type={f.type}
                  value={
                    f.type === 'checkbox' ? undefined : (values[f.key] ?? '')
                  }
                  checked={
                    f.type === 'checkbox' ? Boolean(values[f.key]) : undefined
                  }
                  required={f.required}
                  min={f.type === 'number' ? 0 : undefined}
                  step={f.type === 'number' ? '0.01' : undefined}
                  maxLength={f.type === 'text' ? 250 : undefined}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      [f.key]:
                        f.type === 'checkbox'
                          ? e.target.checked
                          : e.target.value,
                    })
                  }
                />
              )}
            </label>
          );
        })}
      </div>
      {domain === 'inspections' && (
        <fieldset>
          <legend>Condition checklist</legend>
          {checklist.map((item, i) => (
            <div className="inspection-item" key={item.label}>
              <label>
                {item.label}
                <select
                  value={item.condition}
                  onChange={(e) =>
                    setChecklist(
                      checklist.map((v, j) =>
                        j === i ? { ...v, condition: e.target.value } : v,
                      ),
                    )
                  }
                >
                  {['NOT_CHECKED', 'GOOD', 'NEEDS_ATTENTION'].map((v) => (
                    <option key={v} value={v}>
                      {label(v)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {item.label} notes
                <input
                  value={item.notes ?? ''}
                  onChange={(e) =>
                    setChecklist(
                      checklist.map((v, j) =>
                        j === i ? { ...v, notes: e.target.value } : v,
                      ),
                    )
                  }
                />
              </label>
            </div>
          ))}
        </fieldset>
      )}
      {domain === 'documents' && !editing && (
        <label>
          File *
          <input
            required
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files[0])}
          />
        </label>
      )}
      {error && <p role="alert">{error}</p>}
      <div className="owner-actions">
        <button disabled={saving}>
          {saving
            ? 'Saving...'
            : domain === 'documents' && !editing
              ? 'Upload file'
              : 'Save record'}
        </button>
        <button type="button" className="secondary-button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
