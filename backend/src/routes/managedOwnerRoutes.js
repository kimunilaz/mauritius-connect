import { Router } from 'express';
import { z } from 'zod';
import { createAuthenticateUser } from '../middleware/authenticateUser.js';
import { createLoadApplicationProfile } from '../middleware/loadApplicationProfile.js';
import { requireActiveAccount } from '../middleware/requireActiveAccount.js';
import { requireRole } from '../middleware/requireRole.js';
import { validateRequest } from '../validators/validateRequest.js';
import { authService as defaultAuth } from '../services/authService.js';
import { managedOwnerService as defaultService } from '../services/managedOwnerService.js';
const optional = (n) => z.string().trim().max(n).nullable().optional();
const fields = {
  name: z.string().trim().min(1).max(200),
  company: optional(200),
  email: z.union([z.email().max(254), z.literal(''), z.null()]).optional(),
  phone: optional(50),
  address: optional(1000),
  notes: optional(5000),
};
export const ownerCreateSchema = z.object(fields).strict();
export const ownerPatchSchema = ownerCreateSchema
  .partial()
  .extend({ version: z.number().int().positive() })
  .strict()
  .refine((v) => Object.keys(v).length > 1, 'Provide a field to update.');
const version = z.object({ version: z.number().int().positive() }).strict();
const params = z.object({ id: z.uuid() }).strict();
const query = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(200).optional(),
    archived: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  })
  .strict();
export function createManagedOwnerRouter(
  auth = defaultAuth,
  service = defaultService,
) {
  const r = Router();
  r.use(
    createAuthenticateUser(auth),
    createLoadApplicationProfile(auth),
    requireActiveAccount,
    requireRole('AGENT'),
  );
  r.get('/', validateRequest(query, 'query'), async (req, res) =>
    res.json({
      success: true,
      data: await service.list(req.auth.userId, req.validatedQuery),
    }),
  );
  r.post('/', validateRequest(ownerCreateSchema), async (req, res) =>
    res.status(201).json({
      success: true,
      data: await service.create(req.auth.userId, req.body),
    }),
  );
  r.get('/:id', validateRequest(params, 'params'), async (req, res) =>
    res.json({
      success: true,
      data: await service.get(req.auth.userId, req.params.id),
    }),
  );
  r.patch(
    '/:id',
    validateRequest(params, 'params'),
    validateRequest(ownerPatchSchema),
    async (req, res) =>
      res.json({
        success: true,
        data: await service.update(req.auth.userId, req.params.id, req.body),
      }),
  );
  r.post(
    '/:id/archive',
    validateRequest(params, 'params'),
    validateRequest(version),
    async (req, res) =>
      res.json({
        success: true,
        data: await service.update(
          req.auth.userId,
          req.params.id,
          req.body,
          true,
        ),
      }),
  );
  return r;
}
