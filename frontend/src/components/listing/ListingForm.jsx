import { useState } from 'react';
import FormField from '../auth/FormField.jsx';

const emptyListing = {
  property_id: '',
  title: '',
  description: '',
  monthly_rent: '',
  deposit_amount: '',
  available_from: '',
  minimum_lease_months: '',
  maximum_occupants: '',
  pets_allowed: false,
};

function initialForm(listing, propertyId) {
  if (!listing) return { ...emptyListing, property_id: propertyId ?? '' };
  return {
    property_id: listing.property_id,
    title: listing.title,
    description: listing.description,
    monthly_rent: String(listing.monthly_rent),
    deposit_amount: listing.deposit_amount ?? '',
    available_from: listing.available_from,
    minimum_lease_months: listing.minimum_lease_months ?? '',
    maximum_occupants: listing.maximum_occupants ?? '',
    pets_allowed: listing.pets_allowed,
  };
}

function optionalNumber(value) {
  return value === '' ? null : Number(value);
}

function validate(form, creating) {
  const errors = {};
  if (creating && !form.property_id) errors.property_id = 'Choose a property.';
  if (!form.title.trim()) errors.title = 'Enter a listing title.';
  if (!form.description.trim()) errors.description = 'Enter a description.';
  if (!(Number(form.monthly_rent) > 0))
    errors.monthly_rent = 'Monthly rent must be greater than zero.';
  if (form.deposit_amount !== '' && Number(form.deposit_amount) < 0)
    errors.deposit_amount = 'Deposit cannot be negative.';
  if (!form.available_from)
    errors.available_from = 'Choose an availability date.';
  if (form.minimum_lease_months !== '' && Number(form.minimum_lease_months) < 1)
    errors.minimum_lease_months = 'Minimum lease must be at least one month.';
  if (form.maximum_occupants !== '' && Number(form.maximum_occupants) < 1)
    errors.maximum_occupants = 'Maximum occupants must be at least one.';
  return errors;
}

function payload(form, creating) {
  return {
    ...(creating ? { property_id: form.property_id } : {}),
    title: form.title.trim(),
    description: form.description.trim(),
    monthly_rent: Number(form.monthly_rent),
    deposit_amount: optionalNumber(form.deposit_amount),
    available_from: form.available_from,
    minimum_lease_months: optionalNumber(form.minimum_lease_months),
    maximum_occupants: optionalNumber(form.maximum_occupants),
    pets_allowed: form.pets_allowed,
  };
}

export default function ListingForm({
  initialListing,
  selectedPropertyId,
  properties = [],
  onSubmit,
  submitting,
  submitLabel,
  serverErrors = {},
}) {
  const creating = !initialListing;
  const [form, setForm] = useState(() =>
    initialForm(initialListing, selectedPropertyId),
  );
  const [clientErrors, setClientErrors] = useState({});
  const errors = { ...serverErrors, ...clientErrors };

  function update(event) {
    const { checked, name, type, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setClientErrors((current) => ({ ...current, [name]: undefined }));
  }

  function submit(event) {
    event.preventDefault();
    const nextErrors = validate(form, creating);
    setClientErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) {
      onSubmit(payload(form, creating));
    }
  }

  const describedBy = (name) => (errors[name] ? `${name}-error` : undefined);

  return (
    <form className="listing-form" onSubmit={submit} noValidate>
      {creating ? (
        <FormField
          id="property_id"
          label="Property *"
          error={errors.property_id}
          hint="Only your non-archived properties are available."
        >
          <select
            id="property_id"
            name="property_id"
            value={form.property_id}
            required
            onChange={update}
            aria-invalid={Boolean(errors.property_id)}
            aria-describedby={describedBy('property_id')}
          >
            <option value="">Choose a property</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.locality}, {property.district} —{' '}
                {property.property_type.toLowerCase()}
              </option>
            ))}
          </select>
        </FormField>
      ) : null}
      <FormField id="title" label="Title *" error={errors.title}>
        <input
          id="title"
          name="title"
          maxLength={200}
          required
          value={form.title}
          onChange={update}
          aria-invalid={Boolean(errors.title)}
          aria-describedby={describedBy('title')}
        />
      </FormField>
      <FormField
        id="description"
        label="Description *"
        error={errors.description}
      >
        <textarea
          id="description"
          name="description"
          rows="7"
          maxLength={5000}
          required
          value={form.description}
          onChange={update}
          aria-invalid={Boolean(errors.description)}
          aria-describedby={describedBy('description')}
        />
      </FormField>
      <FormField
        id="monthly_rent"
        label="Monthly rent (Rs) *"
        error={errors.monthly_rent}
      >
        <input
          id="monthly_rent"
          name="monthly_rent"
          type="number"
          min="0.01"
          step="0.01"
          required
          value={form.monthly_rent}
          onChange={update}
          aria-invalid={Boolean(errors.monthly_rent)}
          aria-describedby={describedBy('monthly_rent')}
        />
      </FormField>
      <FormField
        id="deposit_amount"
        label="Deposit (Rs)"
        error={errors.deposit_amount}
      >
        <input
          id="deposit_amount"
          name="deposit_amount"
          type="number"
          min="0"
          step="0.01"
          value={form.deposit_amount}
          onChange={update}
          aria-invalid={Boolean(errors.deposit_amount)}
          aria-describedby={describedBy('deposit_amount')}
        />
      </FormField>
      <FormField
        id="available_from"
        label="Available from *"
        error={errors.available_from}
      >
        <input
          id="available_from"
          name="available_from"
          type="date"
          required
          value={form.available_from}
          onChange={update}
          aria-invalid={Boolean(errors.available_from)}
          aria-describedby={describedBy('available_from')}
        />
      </FormField>
      <FormField
        id="minimum_lease_months"
        label="Minimum lease (months)"
        error={errors.minimum_lease_months}
      >
        <input
          id="minimum_lease_months"
          name="minimum_lease_months"
          type="number"
          min="1"
          step="1"
          value={form.minimum_lease_months}
          onChange={update}
          aria-invalid={Boolean(errors.minimum_lease_months)}
          aria-describedby={describedBy('minimum_lease_months')}
        />
      </FormField>
      <FormField
        id="maximum_occupants"
        label="Maximum occupants"
        error={errors.maximum_occupants}
      >
        <input
          id="maximum_occupants"
          name="maximum_occupants"
          type="number"
          min="1"
          step="1"
          value={form.maximum_occupants}
          onChange={update}
          aria-invalid={Boolean(errors.maximum_occupants)}
          aria-describedby={describedBy('maximum_occupants')}
        />
      </FormField>
      <label className="checkbox-field">
        <input
          name="pets_allowed"
          type="checkbox"
          checked={form.pets_allowed}
          onChange={update}
        />
        Pets allowed
      </label>
      <button className="primary-button" type="submit" disabled={submitting}>
        {submitting ? 'Saving...' : submitLabel}
      </button>
    </form>
  );
}
