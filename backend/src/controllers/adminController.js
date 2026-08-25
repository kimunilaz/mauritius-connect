import { adminService as s } from '../services/adminService.js';
export const adminController = {
  listings: async (req, res) => {
    const result = await s.listings(req.validatedQuery);
    res.json({
      success: true,
      data: result.items,
      meta: {
        page: req.validatedQuery.page,
        limit: req.validatedQuery.limit,
        total: result.total,
        total_pages: Math.ceil(result.total / req.validatedQuery.limit),
      },
    });
  },
  listing: async (req, res) =>
    res.json({ success: true, data: await s.listing(req.params.id) }),
  approve: async (req, res) =>
    res.json({
      success: true,
      data: await s.review(req.auth.userId, req.params.id, 'APPROVE'),
    }),
  returnDraft: async (req, res) =>
    res.json({
      success: true,
      data: await s.review(
        req.auth.userId,
        req.params.id,
        'RETURN',
        req.body.reason,
      ),
    }),
  users: async (req, res) => {
    const result = await s.users(req.validatedQuery);
    res.json({
      success: true,
      data: result.items,
      meta: {
        page: req.validatedQuery.page,
        limit: req.validatedQuery.limit,
        total: result.total,
        total_pages: Math.ceil(result.total / req.validatedQuery.limit),
      },
    });
  },
  user: async (req, res) =>
    res.json({ success: true, data: await s.user(req.params.id) }),
  suspend: async (req, res) =>
    res.json({
      success: true,
      data: await s.account(req.auth.userId, req.params.id, 'SUSPEND'),
    }),
  reactivate: async (req, res) =>
    res.json({
      success: true,
      data: await s.account(req.auth.userId, req.params.id, 'REACTIVATE'),
    }),
};
