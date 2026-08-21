import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import FormField from '../../components/auth/FormField.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { ApiError } from '../../services/apiClient.js';
import {
  addPreferredLocation,
  deletePreferredLocation,
  getPreferredLocations,
  getTenantProfile,
  updateBaseProfile,
  updateTenantProfile,
} from '../../services/roleProfileService.js';

const emptyRental = {
  occupation_type: '',
  employer_or_school: '',
  income_range: '',
  preferred_move_date: '',
  preferred_lease_duration_months: '',
  number_of_occupants: '',
  has_pets: false,
  bio: '',
};
const emptyLocation = { district: '', locality: '', neighbourhood: '' };

function safeMessage(error) {
  if (error instanceof ApiError && error.fields) {
    return Object.values(error.fields).join(' ');
  }
  return error instanceof ApiError
    ? error.message
    : 'The profile service is temporarily unavailable. Please try again.';
}

function optionalNumber(value) {
  return value === '' ? null : Number(value);
}

export default function TenantProfilePage() {
  const { profile, refreshProfile, session } = useAuth();
  const token = session.access_token;
  const [personal, setPersonal] = useState({
    first_name: profile.first_name,
    last_name: profile.last_name,
    phone: profile.phone ?? '',
  });
  const [rental, setRental] = useState(emptyRental);
  const [location, setLocation] = useState(emptyLocation);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([getTenantProfile(token), getPreferredLocations(token)])
      .then(([tenantProfile, preferredLocations]) => {
        if (!active) return;
        setRental(
          Object.fromEntries(
            Object.entries(tenantProfile).map(([key, value]) => [
              key,
              value ?? '',
            ]),
          ),
        );
        setLocations(preferredLocations);
      })
      .catch((error) => active && setMessage(safeMessage(error)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [token]);

  function change(setter) {
    return (event) => {
      const { checked, name, type, value } = event.target;
      setter((current) => ({
        ...current,
        [name]: type === 'checkbox' ? checked : value,
      }));
    };
  }

  async function savePersonal(event) {
    event.preventDefault();
    setBusy('personal');
    setMessage('');
    try {
      await updateBaseProfile(token, {
        first_name: personal.first_name.trim(),
        last_name: personal.last_name.trim(),
        phone: personal.phone.trim() || null,
      });
      await refreshProfile();
      setMessage('Personal details saved.');
    } catch (error) {
      setMessage(safeMessage(error));
    } finally {
      setBusy('');
    }
  }

  async function saveRental(event) {
    event.preventDefault();
    setBusy('rental');
    setMessage('');
    try {
      const updated = await updateTenantProfile(token, {
        occupation_type: rental.occupation_type || null,
        employer_or_school: rental.employer_or_school || null,
        income_range: rental.income_range || null,
        preferred_move_date: rental.preferred_move_date || null,
        preferred_lease_duration_months: optionalNumber(
          rental.preferred_lease_duration_months,
        ),
        number_of_occupants: optionalNumber(rental.number_of_occupants),
        has_pets: rental.has_pets,
        bio: rental.bio || null,
      });
      setRental(
        Object.fromEntries(
          Object.entries(updated).map(([key, value]) => [key, value ?? '']),
        ),
      );
      setMessage('Rental preferences saved.');
    } catch (error) {
      setMessage(safeMessage(error));
    } finally {
      setBusy('');
    }
  }

  async function createLocation(event) {
    event.preventDefault();
    setBusy('location');
    setMessage('');
    try {
      const created = await addPreferredLocation(token, {
        district: location.district || null,
        locality: location.locality || null,
        neighbourhood: location.neighbourhood || null,
      });
      setLocations((current) => [...current, created]);
      setLocation(emptyLocation);
      setMessage('Preferred location added.');
    } catch (error) {
      setMessage(safeMessage(error));
    } finally {
      setBusy('');
    }
  }

  async function removeLocation(id) {
    setBusy(id);
    setMessage('');
    try {
      await deletePreferredLocation(token, id);
      setLocations((current) => current.filter((item) => item.id !== id));
      setMessage('Preferred location removed.');
    } catch (error) {
      setMessage(safeMessage(error));
    } finally {
      setBusy('');
    }
  }

  if (loading) {
    return (
      <main className="profile-shell" aria-live="polite">
        Loading your tenant profile...
      </main>
    );
  }

  return (
    <main className="profile-shell">
      <header className="profile-header">
        <div>
          <p className="eyebrow">Tenant profile</p>
          <h1>Your rental profile</h1>
        </div>
        <Link to="/account">Back to account</Link>
      </header>
      <p className="privacy-note">
        Share only the information needed for your rental preferences. Do not
        include identity documents or exact salary details.
      </p>
      {message ? (
        <p className="form-message" role="status">
          {message}
        </p>
      ) : null}

      <section className="profile-section" aria-labelledby="personal-title">
        <h2 id="personal-title">Personal details</h2>
        <form className="profile-form" onSubmit={savePersonal}>
          <FormField id="tenant-first-name" label="First name">
            <input
              id="tenant-first-name"
              name="first_name"
              required
              maxLength={100}
              value={personal.first_name}
              onChange={change(setPersonal)}
            />
          </FormField>
          <FormField id="tenant-last-name" label="Last name">
            <input
              id="tenant-last-name"
              name="last_name"
              required
              maxLength={100}
              value={personal.last_name}
              onChange={change(setPersonal)}
            />
          </FormField>
          <FormField id="tenant-phone" label="Phone (optional)">
            <input
              id="tenant-phone"
              name="phone"
              type="tel"
              maxLength={30}
              value={personal.phone}
              onChange={change(setPersonal)}
            />
          </FormField>
          <button className="primary-button" disabled={busy === 'personal'}>
            Save personal details
          </button>
        </form>
      </section>

      <section className="profile-section" aria-labelledby="rental-title">
        <h2 id="rental-title">Rental preferences</h2>
        <form className="profile-form" onSubmit={saveRental}>
          <FormField id="occupation" label="Occupation">
            <select
              id="occupation"
              name="occupation_type"
              value={rental.occupation_type}
              onChange={change(setRental)}
            >
              <option value="">Prefer not to say</option>
              <option value="STUDENT">Student</option>
              <option value="EMPLOYED">Employed</option>
              <option value="SELF_EMPLOYED">Self-employed</option>
              <option value="OTHER">Other</option>
            </select>
          </FormField>
          <FormField id="employer" label="Employer or school (optional)">
            <input
              id="employer"
              name="employer_or_school"
              maxLength={200}
              value={rental.employer_or_school}
              onChange={change(setRental)}
            />
          </FormField>
          <FormField
            id="income"
            label="Income range"
            hint="Optional. This gives rental context and is not used to rank tenants."
          >
            <select
              id="income"
              name="income_range"
              value={rental.income_range}
              onChange={change(setRental)}
              aria-describedby="income-hint"
            >
              <option value="">Prefer not to say</option>
              <option value="BELOW_10000">Below Rs 10,000</option>
              <option value="10000_20000">Rs 10,000-20,000</option>
              <option value="20001_35000">Rs 20,001-35,000</option>
              <option value="35001_50000">Rs 35,001-50,000</option>
              <option value="ABOVE_50000">Above Rs 50,000</option>
            </select>
          </FormField>
          <FormField id="move-date" label="Preferred move date">
            <input
              id="move-date"
              name="preferred_move_date"
              type="date"
              value={rental.preferred_move_date}
              onChange={change(setRental)}
            />
          </FormField>
          <FormField
            id="lease-months"
            label="Preferred lease duration (months)"
          >
            <input
              id="lease-months"
              name="preferred_lease_duration_months"
              type="number"
              min="1"
              value={rental.preferred_lease_duration_months}
              onChange={change(setRental)}
            />
          </FormField>
          <FormField id="occupants" label="Number of occupants">
            <input
              id="occupants"
              name="number_of_occupants"
              type="number"
              min="1"
              value={rental.number_of_occupants}
              onChange={change(setRental)}
            />
          </FormField>
          <label className="checkbox-field">
            <input
              name="has_pets"
              type="checkbox"
              checked={Boolean(rental.has_pets)}
              onChange={change(setRental)}
            />{' '}
            I have pets
          </label>
          <FormField id="tenant-bio" label="About your household (optional)">
            <textarea
              id="tenant-bio"
              name="bio"
              maxLength={1000}
              rows={5}
              value={rental.bio}
              onChange={change(setRental)}
            />
          </FormField>
          <button className="primary-button" disabled={busy === 'rental'}>
            Save rental preferences
          </button>
        </form>
      </section>

      <section className="profile-section" aria-labelledby="locations-title">
        <h2 id="locations-title">Preferred locations</h2>
        {locations.length ? (
          <ul className="location-list">
            {locations.map((item) => (
              <li key={item.id}>
                <span>
                  {[item.district, item.locality, item.neighbourhood]
                    .filter(Boolean)
                    .join(' / ')}
                </span>
                <button
                  type="button"
                  className="text-button"
                  disabled={busy === item.id}
                  onClick={() => removeLocation(item.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p>No preferred locations added yet.</p>
        )}
        <form className="profile-form" onSubmit={createLocation}>
          <FormField id="district" label="District">
            <input
              id="district"
              name="district"
              maxLength={100}
              value={location.district}
              onChange={change(setLocation)}
            />
          </FormField>
          <FormField id="locality" label="Locality">
            <input
              id="locality"
              name="locality"
              maxLength={100}
              value={location.locality}
              onChange={change(setLocation)}
            />
          </FormField>
          <FormField id="neighbourhood" label="Neighbourhood">
            <input
              id="neighbourhood"
              name="neighbourhood"
              maxLength={100}
              value={location.neighbourhood}
              onChange={change(setLocation)}
            />
          </FormField>
          <button className="secondary-button" disabled={busy === 'location'}>
            Add preferred location
          </button>
        </form>
      </section>
    </main>
  );
}
