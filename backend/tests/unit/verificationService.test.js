import { describe, expect, it, vi } from 'vitest';
import { createVerificationService } from '../../src/services/verificationService.js';

const USER_ID = '10000000-0000-4000-8000-000000000001';
const PROPERTY_ID = '20000000-0000-4000-8000-000000000001';

function propertyVerification() {
  return {
    id: '30000000-0000-4000-8000-000000000001',
    subject_type: 'PROPERTY',
    subject_id: PROPERTY_ID,
    verification_type: 'PROPERTY_AUTHORITY',
    status: 'PENDING',
    created_at: '2026-08-25T00:00:00.000Z',
    updated_at: '2026-08-25T00:00:00.000Z',
    evidence_count: 0,
  };
}

describe('verification service ownership', () => {
  it('allows a landlord to read an owned property verification', async () => {
    const repository = {
      get: vi.fn().mockResolvedValue(propertyVerification()),
      ownsProperty: vi.fn().mockResolvedValue(true),
    };
    const service = createVerificationService({
      repository,
      storage: {},
    });

    await expect(
      service.get(USER_ID, propertyVerification().id),
    ).resolves.toEqual(
      expect.objectContaining({
        id: propertyVerification().id,
        type: 'PROPERTY_AUTHORITY',
      }),
    );
    expect(repository.ownsProperty).toHaveBeenCalledWith(USER_ID, PROPERTY_ID);
  });

  it('keeps another landlord property verification privacy-safe', async () => {
    const service = createVerificationService({
      repository: {
        get: vi.fn().mockResolvedValue(propertyVerification()),
        ownsProperty: vi.fn().mockResolvedValue(false),
      },
      storage: {},
    });

    await expect(
      service.get(USER_ID, propertyVerification().id),
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'VERIFICATION_NOT_FOUND',
    });
  });
});
