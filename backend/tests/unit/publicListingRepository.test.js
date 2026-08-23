import { describe, expect, it } from 'vitest';
import { PUBLIC_LISTING_COLUMNS } from '../../src/repositories/publicListingRepository.js';

describe('public listing repository projection contract', () => {
  it('selects status for the shared public-eligibility presentation guard', () => {
    expect(PUBLIC_LISTING_COLUMNS).toContain('status');
  });
});
