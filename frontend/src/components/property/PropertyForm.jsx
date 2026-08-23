import { useState } from 'react';
import FormField from '../auth/FormField.jsx';

const emptyProperty = {
  property_type: 'APARTMENT',
  address_line_1: '',
  address_line_2: '',
  district: '',
  locality: '',
  neighbourhood: '',
  latitude: '',
  longitude: '',
  bedrooms: '',
  bathrooms: '',
  furnished: false,
  parking_spaces: '0',
};

function formValue(value) {
  return value ?? '';
}

function initialForm(property) {
  if (!property) return emptyProperty;
  return {
    property_type: property.property_type,
    address_line_1: formValue(property.address_line_1),
    address_line_2: formValue(property.address_line_2),
    district: property.district,
    locality: property.locality,
    neighbourhood: formValue(property.neighbourhood),
    latitude: formValue(property.latitude),
    longitude: formValue(property.longitude),
    bedrooms: String(property.bedrooms),
    bathrooms: String(property.bathrooms),
    furnished: property.furnished,
    parking_spaces: String(property.parking_spaces),
  };
}

function optionalNumber(value) {
  return value === '' ? null : Number(value);
}

function validate(form) {
  const errors = {};
  if (!form.district.trim()) errors.district = 'Enter a district.';
  if (!form.locality.trim()) errors.locality = 'Enter a locality.';
  if (form.bedrooms === '' || Number(form.bedrooms) < 0)
    errors.bedrooms = 'Bedrooms must be zero or more.';
  if (form.bathrooms === '' || Number(form.bathrooms) < 0)
    errors.bathrooms = 'Bathrooms must be zero or more.';
  if (Number(form.parking_spaces) < 0)
    errors.parking_spaces = 'Parking spaces must be zero or more.';
  if (form.latitude !== '' && Math.abs(Number(form.latitude)) > 90)
    errors.latitude = 'Latitude must be between -90 and 90.';
  if (form.longitude !== '' && Math.abs(Number(form.longitude)) > 180)
    errors.longitude = 'Longitude must be between -180 and 180.';
  return errors;
}

function payload(form) {
  return {
    property_type: form.property_type,
    address_line_1: form.address_line_1.trim() || null,
    address_line_2: form.address_line_2.trim() || null,
    district: form.district.trim(),
    locality: form.locality.trim(),
    neighbourhood: form.neighbourhood.trim() || null,
    latitude: optionalNumber(form.latitude),
    longitude: optionalNumber(form.longitude),
    bedrooms: Number(form.bedrooms),
    bathrooms: Number(form.bathrooms),
    furnished: form.furnished,
    parking_spaces: Number(form.parking_spaces || 0),
  };
}

export default function PropertyForm({
  initialProperty,
  onSubmit,
  submitting,
  submitLabel,
  serverErrors = {},
}) {
  const [form, setForm] = useState(() => initialForm(initialProperty));
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
    const nextErrors = validate(form);
    setClientErrors(nextErrors);
    if (Object.keys(nextErrors).length === 0) onSubmit(payload(form));
  }

  const describedBy = (name) => (errors[name] ? `${name}-error` : undefined);

  return (
    <form className="property-form" onSubmit={submit} noValidate>
      <fieldset className="property-form-section">
        <legend>Property basics</legend>
        <FormField
          id="property_type"
          label="Property type *"
          error={errors.property_type}
        >
          <select
            id="property_type"
            name="property_type"
            value={form.property_type}
            onChange={update}
            aria-invalid={Boolean(errors.property_type)}
            aria-describedby={describedBy('property_type')}
          >
            <option value="APARTMENT">Apartment</option>
            <option value="HOUSE">House</option>
            <option value="STUDIO">Studio</option>
            <option value="ROOM">Room</option>
            <option value="TOWNHOUSE">Townhouse</option>
            <option value="VILLA">Villa</option>
            <option value="OTHER">Other</option>
          </select>
        </FormField>
        <FormField id="bedrooms" label="Bedrooms *" error={errors.bedrooms}>
          <input
            id="bedrooms"
            name="bedrooms"
            type="number"
            min="0"
            step="1"
            required
            value={form.bedrooms}
            onChange={update}
            aria-invalid={Boolean(errors.bedrooms)}
            aria-describedby={describedBy('bedrooms')}
          />
        </FormField>
        <FormField id="bathrooms" label="Bathrooms *" error={errors.bathrooms}>
          <input
            id="bathrooms"
            name="bathrooms"
            type="number"
            min="0"
            step="0.5"
            required
            value={form.bathrooms}
            onChange={update}
            aria-invalid={Boolean(errors.bathrooms)}
            aria-describedby={describedBy('bathrooms')}
          />
        </FormField>
      </fieldset>

      <fieldset className="property-form-section">
        <legend>Location</legend>
        <FormField
          id="address_line_1"
          label="Address line 1"
          error={errors.address_line_1}
        >
          <input
            id="address_line_1"
            name="address_line_1"
            maxLength={250}
            autoComplete="address-line1"
            value={form.address_line_1}
            onChange={update}
            aria-invalid={Boolean(errors.address_line_1)}
            aria-describedby={describedBy('address_line_1')}
          />
        </FormField>
        <FormField
          id="address_line_2"
          label="Address line 2"
          error={errors.address_line_2}
        >
          <input
            id="address_line_2"
            name="address_line_2"
            maxLength={250}
            autoComplete="address-line2"
            value={form.address_line_2}
            onChange={update}
            aria-invalid={Boolean(errors.address_line_2)}
            aria-describedby={describedBy('address_line_2')}
          />
        </FormField>
        <FormField id="district" label="District *" error={errors.district}>
          <input
            id="district"
            name="district"
            maxLength={100}
            required
            value={form.district}
            onChange={update}
            aria-invalid={Boolean(errors.district)}
            aria-describedby={describedBy('district')}
          />
        </FormField>
        <FormField id="locality" label="Locality *" error={errors.locality}>
          <input
            id="locality"
            name="locality"
            maxLength={150}
            required
            value={form.locality}
            onChange={update}
            aria-invalid={Boolean(errors.locality)}
            aria-describedby={describedBy('locality')}
          />
        </FormField>
        <FormField
          id="neighbourhood"
          label="Neighbourhood"
          error={errors.neighbourhood}
        >
          <input
            id="neighbourhood"
            name="neighbourhood"
            maxLength={150}
            value={form.neighbourhood}
            onChange={update}
            aria-invalid={Boolean(errors.neighbourhood)}
            aria-describedby={describedBy('neighbourhood')}
          />
        </FormField>
        <FormField
          id="latitude"
          label="Latitude (optional)"
          error={errors.latitude}
        >
          <input
            id="latitude"
            name="latitude"
            type="number"
            min="-90"
            max="90"
            step="any"
            value={form.latitude}
            onChange={update}
            aria-invalid={Boolean(errors.latitude)}
            aria-describedby={describedBy('latitude')}
          />
        </FormField>
        <FormField
          id="longitude"
          label="Longitude (optional)"
          error={errors.longitude}
        >
          <input
            id="longitude"
            name="longitude"
            type="number"
            min="-180"
            max="180"
            step="any"
            value={form.longitude}
            onChange={update}
            aria-invalid={Boolean(errors.longitude)}
            aria-describedby={describedBy('longitude')}
          />
        </FormField>
      </fieldset>

      <fieldset className="property-form-section">
        <legend>Features</legend>
        <label className="checkbox-field">
          <input
            name="furnished"
            type="checkbox"
            checked={form.furnished}
            onChange={update}
          />{' '}
          Furnished
        </label>
        <FormField
          id="parking_spaces"
          label="Parking spaces"
          error={errors.parking_spaces}
        >
          <input
            id="parking_spaces"
            name="parking_spaces"
            type="number"
            min="0"
            step="1"
            value={form.parking_spaces}
            onChange={update}
            aria-invalid={Boolean(errors.parking_spaces)}
            aria-describedby={describedBy('parking_spaces')}
          />
        </FormField>
      </fieldset>

      <button className="primary-button" type="submit" disabled={submitting}>
        {submitting ? 'Saving property...' : submitLabel}
      </button>
    </form>
  );
}
