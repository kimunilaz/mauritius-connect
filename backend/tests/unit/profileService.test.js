import { describe, expect, it, vi } from 'vitest';
import { RoleProfileRepositoryError } from '../../src/repositories/roleProfileRepository.js';
import { createProfileService } from '../../src/services/profileService.js';

describe('role profile initialization', () => {
  it('recovers from a concurrent unique-key insert and remains idempotent', async () => {
    const created = { id: 'role-profile', has_pets: false };
    const tenantProfiles = {
      findByUserId: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValue(created),
      create: vi
        .fn()
        .mockRejectedValue(new RoleProfileRepositoryError('DUPLICATE')),
    };
    const profiles = {
      findByUserId: vi.fn().mockResolvedValue({ role: 'TENANT' }),
    };
    const service = createProfileService({ tenantProfiles, profiles });

    await expect(service.ensureTenantProfile('tenant-user')).resolves.toBe(
      created,
    );
    expect(tenantProfiles.findByUserId).toHaveBeenCalledTimes(2);
  });

  it('refuses cross-role initialization at the service boundary', async () => {
    const tenantProfiles = {
      findByUserId: vi.fn(),
      create: vi.fn(),
    };
    const service = createProfileService({
      tenantProfiles,
      profiles: {
        findByUserId: vi.fn().mockResolvedValue({ role: 'LANDLORD' }),
      },
    });

    await expect(
      service.ensureTenantProfile('landlord-user'),
    ).rejects.toMatchObject({ statusCode: 403, code: 'FORBIDDEN' });
    expect(tenantProfiles.findByUserId).not.toHaveBeenCalled();
    expect(tenantProfiles.create).not.toHaveBeenCalled();
  });
});
