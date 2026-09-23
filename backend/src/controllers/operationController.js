import { z } from 'zod';
import {
  operationInput,
  operationQuery,
  domainSchema,
  receiptSchema,
  invitationSchema,
} from '../validators/operationValidators.js';
import { AppError } from '../middleware/AppError.js';
function parse(schema, input) {
  const r = schema.safeParse(input);
  if (!r.success)
    throw new AppError({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
      message: r.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; '),
    });
  return r.data;
}
const id = (v) => parse(z.uuid(), v);
export function createOperationController(service) {
  const domain = (req) => parse(domainSchema, req.params.domain);
  const user = (req) => req.auth.userId;
  const send = (res, data, status = 200) =>
    res.status(status).json({ success: true, data });
  return {
    async conversation(req, res) {
      send(res, await service.conversation(user(req), id(req.params.id)));
    },
    async list(req, res) {
      const q = parse(operationQuery, req.query);
      const r = await service.list(user(req), domain(req), q);
      res.json({
        success: true,
        data: r.items,
        meta: {
          total: r.total,
          page: q.page,
          limit: q.limit,
          total_pages: Math.ceil(r.total / q.limit),
        },
      });
    },
    async get(req, res) {
      send(res, await service.get(user(req), domain(req), id(req.params.id)));
    },
    async create(req, res) {
      const d = domain(req);
      if (d === 'documents')
        throw new AppError({
          statusCode: 422,
          code: 'UPLOAD_REQUIRED',
          message: 'Use the document upload action.',
        });
      send(
        res,
        await service.create(user(req), d, parse(operationInput(d), req.body)),
        201,
      );
    },
    async update(req, res) {
      const d = domain(req);
      send(
        res,
        await service.update(
          user(req),
          d,
          id(req.params.id),
          parse(operationInput(d, true), req.body),
        ),
      );
    },
    async receipt(req, res) {
      send(
        res,
        await service.receipt(
          user(req),
          id(req.params.id),
          parse(receiptSchema, req.body),
        ),
        201,
      );
    },
    async invite(req, res) {
      send(res, await service.invite(user(req), id(req.params.id)));
    },
    async claim(req, res) {
      send(
        res,
        await service.claim(user(req), parse(invitationSchema, req.body).code),
      );
    },
    async homes(req, res) {
      send(res, await service.homes(user(req)));
    },
    async tenantList(req, res) {
      const d = parse(
        z.enum(['rent', 'maintenance', 'documents']),
        req.params.domain,
      );
      const q = parse(operationQuery, req.query);
      id(q.tenancy_id);
      const r = await service.tenantList(user(req), d, q);
      res.json({
        success: true,
        data: r.items,
        meta: {
          total: r.total,
          page: q.page,
          limit: q.limit,
          total_pages: Math.ceil(r.total / q.limit),
        },
      });
    },
    async tenantMaintenance(req, res) {
      send(
        res,
        await service.tenantMaintenance(
          user(req),
          parse(operationInput('maintenance', false, true), req.body),
        ),
        201,
      );
    },
    async upload(req, res) {
      const tenant = req.profile.role === 'TENANT';
      const schema = tenant
        ? z
            .object({
              property_id: z.uuid(),
              tenancy_id: z.uuid(),
              maintenance_id: z.uuid(),
            })
            .strict()
        : operationInput('documents');
      send(
        res,
        await service.upload(
          user(req),
          parse(schema, req.body),
          req.file,
          tenant,
        ),
        201,
      );
    },
    async url(req, res) {
      const tenancyId =
        req.profile.role === 'TENANT' ? id(req.query.tenancy_id) : undefined;
      send(
        res,
        await service.documentUrl(user(req), id(req.params.id), tenancyId),
      );
    },
    async leasing(req, res) {
      const q = parse(operationQuery, req.query);
      send(
        res,
        await service.leasing(
          user(req),
          req.params.propertyId ? id(req.params.propertyId) : q.property_id,
          q,
        ),
      );
    },
    async summary(req, res) {
      send(
        res,
        await service.summary(user(req), parse(operationQuery, req.query)),
      );
    },
  };
}
