export function operationalOverview(role, empty = false) {
  const queue = (items) => ({
    total: empty ? 0 : 6,
    items: empty ? [] : items,
  });
  if (role === 'ADMIN')
    return {
      listings: queue([
        {
          id: 'listing-review',
          title: 'Apartment awaiting approval',
          status: 'PENDING_REVIEW',
        },
      ]),
      reports: queue([
        {
          id: 'report-review',
          reason: 'INCORRECT_INFORMATION',
          status: 'UNDER_REVIEW',
        },
      ]),
      verifications: queue([
        {
          id: 'verification-review',
          verification_type: 'LANDLORD_IDENTITY',
          status: 'PENDING',
        },
      ]),
      users: queue([
        {
          id: 'suspended-user',
          first_name: 'Sam',
          last_name: 'Example',
          account_status: 'SUSPENDED',
        },
      ]),
    };
  return {
    applications: {
      ...queue([
        {
          id: 'submitted-application',
          title: 'Application for Moka apartment',
          status: 'SUBMITTED',
        },
      ]),
      waiting: empty ? 0 : 2,
    },
    viewings: queue([
      {
        id: 'viewing',
        application_id: 'submitted-application',
        title: 'Moka apartment viewing',
        status: 'PROPOSED',
        start_time: '2099-10-01T10:00:00Z',
      },
    ]),
  };
}

export function ownerOperations(empty = false) {
  const property = {
    id: '00000000-0000-4000-a000-000000000002',
    name: 'Moka apartment',
    locality: 'Moka',
    property_type: 'APARTMENT',
    occupancy: 'OCCUPIED',
    tenant_name: 'Jamie Tenant',
    tenancy_id: '31000000-0000-4000-8000-000000000031',
    monthly_rent: 18000,
    listing_status: null,
    open_maintenance: 1,
  };
  return {
    period: { from: '2026-09-01', to: '2026-09-30' },
    totals: {
      properties: empty ? 0 : 8,
      occupied: empty ? 0 : 4,
      vacant: empty ? 0 : 4,
      advertised: 0,
      maintenance: empty ? 0 : 1,
      overdue: empty ? 0 : 1,
    },
    finances: {
      expected: 18000,
      received: 12000,
      outstanding: 6000,
      overdue: 6000,
      income: 12000,
      expenses: 800,
      maintenance_cost: 800,
    },
    portfolio: empty ? [] : [property],
    total_properties: empty ? 0 : 8,
    attention: empty
      ? []
      : [
          {
            id: 'rent-overdue',
            property_id: property.id,
            property_name: property.name,
            title: 'Rent overdue',
            date: '2026-09-01',
            domain: 'rent',
          },
        ],
    upcoming: empty
      ? []
      : [
          {
            id: 'inspection',
            property_id: property.id,
            property_name: property.name,
            title: 'Routine inspection',
            date: '2026-09-25',
            domain: 'inspections',
          },
        ],
    activity: [],
    tenancy_history: [],
  };
}
