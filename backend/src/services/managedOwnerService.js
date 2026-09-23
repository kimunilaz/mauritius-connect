import { AppError } from '../middleware/AppError.js';
import { managedOwnerRepository } from '../repositories/managedOwnerRepository.js';
import { profileService } from './profileService.js';
export function createManagedOwnerService({
  repository = managedOwnerRepository,
  profiles = profileService,
} = {}) {
  const manager = async (user) => {
    const m = await profiles.ensurePropertyManager(user);
    if (m.role !== 'AGENT')
      throw new AppError({
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'Owners are available to property agents.',
      });
    return m.id;
  };
  const missing = () =>
    new AppError({
      statusCode: 404,
      code: 'OWNER_NOT_FOUND',
      message: 'Owner record not found.',
    });
  const get = async (m, id) => {
    const r = await repository.get(m, id);
    if (!r) throw missing();
    return r;
  };
  return {
    async list(user, q) {
      return repository.list(await manager(user), q);
    },
    async get(user, id) {
      return get(await manager(user), id);
    },
    async create(user, fields) {
      return repository.create(await manager(user), fields);
    },
    async update(user, id, { version, ...fields }, archive = false) {
      const m = await manager(user);
      await get(m, id);
      const r = await repository.update(
        m,
        id,
        version,
        archive ? { archived_at: new Date().toISOString() } : fields,
      );
      if (!r)
        throw new AppError({
          statusCode: 409,
          code: 'OWNER_CONFLICT',
          message:
            'This owner was changed or archived. Refresh before editing.',
        });
      return r;
    },
  };
}
export const managedOwnerService = createManagedOwnerService();
