import { AppError } from '../middleware/AppError.js';
import { adminRepository as r } from '../repositories/adminRepository.js';
const e = (s, c, m) => new AppError({ statusCode: s, code: c, message: m });
export const adminService = {
  async listings(o) {
    const x = await r.listings(o);
    return { items: x.data, total: x.count };
  },
  async listing(id) {
    const x = await r.listing(id);
    if (!x) throw e(404, 'LISTING_NOT_FOUND', 'Listing not found.');
    return x;
  },
  async review(uid, id, a, reason) {
    const x = await r.review(uid, id, a, reason);
    if (x?.outcome === 'NOT_FOUND')
      throw e(404, 'LISTING_NOT_FOUND', 'Listing not found.');
    if (x?.outcome === 'NOT_READY')
      throw e(409, 'LISTING_NOT_READY', 'Listing is not publication-ready.');
    if (x?.outcome === 'INVALID_TRANSITION')
      throw e(409, 'INVALID_LISTING_TRANSITION', 'Invalid listing transition.');
    return {
      status: x.listing_status,
      transitioned: x.outcome === 'TRANSITIONED',
    };
  },
  async users(o) {
    const x = await r.users(o);
    return { items: x.data, total: x.count };
  },
  async user(id) {
    const x = await r.user(id);
    if (!x) throw e(404, 'USER_NOT_FOUND', 'User not found.');
    return x;
  },
  async account(uid, id, a) {
    const x = await r.account(uid, id, a);
    if (x?.outcome === 'NOT_FOUND')
      throw e(404, 'USER_NOT_FOUND', 'User not found.');
    if (x?.outcome === 'PROTECTED')
      throw e(
        409,
        'ADMIN_ACCOUNT_PROTECTED',
        'This administrator cannot be suspended.',
      );
    if (x?.outcome === 'INVALID_TRANSITION')
      throw e(409, 'INVALID_ACCOUNT_TRANSITION', 'Invalid account transition.');
    return {
      account_status: x.account_status,
      transitioned: x.outcome === 'TRANSITIONED',
    };
  },
};
