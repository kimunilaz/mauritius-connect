import '../../marketplace.css';

export default function RentalSearchForm({
  onSubmit,
  values,
  onChange,
  idPrefix = 'home',
}) {
  return (
    <form onSubmit={onSubmit} aria-label="Search rentals">
      <div>
        <label htmlFor={`${idPrefix}-locality`}>Location</label>
        <input
          id={`${idPrefix}-locality`}
          name="locality"
          list={`${idPrefix}-areas`}
          placeholder="Town or locality"
          maxLength={100}
          value={values?.locality}
          onChange={onChange}
        />
        <datalist id={`${idPrefix}-areas`}>
          {[
            'Quatre Bornes',
            'Rose Hill',
            'Moka',
            'Ebene',
            'Vacoas',
            'Curepipe',
          ].map((area) => (
            <option key={area} value={area} />
          ))}
        </datalist>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-budget`}>Maximum rent · MUR / month</label>
        <input
          id={`${idPrefix}-budget`}
          name="max_rent"
          type="number"
          min="0"
          placeholder="Any budget"
          value={values?.max_rent}
          onChange={onChange}
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}-bedrooms`}>Bedrooms</label>
        <select
          id={`${idPrefix}-bedrooms`}
          name="bedrooms"
          value={values?.bedrooms}
          onChange={onChange}
        >
          <option value="">Any</option>
          <option value="1">1+</option>
          <option value="2">2+</option>
          <option value="3">3+</option>
          {values?.bedrooms && !['1', '2', '3'].includes(values.bedrooms) && (
            <option value={values.bedrooms}>{values.bedrooms}+</option>
          )}
        </select>
      </div>
      <button className="primary-button" type="submit">
        Search rentals
      </button>
    </form>
  );
}
