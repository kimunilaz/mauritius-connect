import { Link } from 'react-router-dom';

export default function RentalJourney({ step = 1, propertyId, listingId }) {
  const steps = [
    [
      'Property',
      'Add details & photos',
      propertyId
        ? `/landlord/properties/${propertyId}`
        : '/landlord/properties/new',
    ],
    [
      'Listing',
      'Set terms & submit for review',
      listingId
        ? `/landlord/listings/${listingId}`
        : propertyId
          ? `/landlord/listings/new?propertyId=${propertyId}`
          : null,
    ],
    [
      'Applicants',
      'Review & arrange viewings',
      listingId ? `/landlord/listings/${listingId}/applications` : null,
    ],
  ];
  return (
    <nav className="rental-journey" aria-label="Rental journey">
      <ol>
        {steps.map(([title, description, href], index) => (
          <li
            key={title}
            className={
              step === index + 1
                ? 'journey-current'
                : step > index + 1
                  ? 'journey-complete'
                  : ''
            }
            aria-current={step === index + 1 ? 'step' : undefined}
          >
            <span className="journey-number" aria-hidden="true">
              {step > index + 1 ? '✓' : `0${index + 1}`}
            </span>
            <span>
              {href ? <Link to={href}>{title}</Link> : <strong>{title}</strong>}
              <small>{description}</small>
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
