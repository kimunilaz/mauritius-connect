import { Router } from 'express';
import multer from 'multer';
import { createAuthenticateUser } from '../middleware/authenticateUser.js';
import { createLoadApplicationProfile } from '../middleware/loadApplicationProfile.js';
import { requireActiveAccount } from '../middleware/requireActiveAccount.js';
import { requireRole } from '../middleware/requireRole.js';
import { authService as defaultAuth } from '../services/authService.js';
import { operationService as defaultService } from '../services/operationService.js';
import { createOperationController } from '../controllers/operationController.js';
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10485760, files: 1, fields: 10 },
}).single('file');
function routerFor(role, auth) {
  const r = Router();
  r.use(
    createAuthenticateUser(auth),
    createLoadApplicationProfile(auth),
    requireActiveAccount,
    requireRole(...(role === 'LANDLORD' ? ['LANDLORD', 'AGENT'] : [role])),
  );
  return r;
}
export function createOwnerOperationRouter(
  auth = defaultAuth,
  service = defaultService,
) {
  const r = routerFor('LANDLORD', auth),
    c = createOperationController(service);
  r.post('/tenancies/:id/conversation', c.conversation);
  r.get('/summary', c.summary);
  r.get('/leasing', c.leasing);
  r.get('/properties/:propertyId/leasing', c.leasing);
  r.post('/rent/:id/receipts', c.receipt);
  r.post('/tenancies/:id/invitation', c.invite);
  r.post('/documents/upload', upload, c.upload);
  r.get('/documents/:id/url', c.url);
  r.get('/:domain', c.list);
  r.post('/:domain', c.create);
  r.get('/:domain/:id', c.get);
  r.patch('/:domain/:id', c.update);
  return r;
}
export function createTenantOperationRouter(
  auth = defaultAuth,
  service = defaultService,
) {
  const r = routerFor('TENANT', auth),
    c = createOperationController(service);
  r.post('/tenancies/:id/conversation', c.conversation);
  r.get('/home', c.homes);
  r.post('/claim', c.claim);
  r.post('/maintenance', c.tenantMaintenance);
  r.post('/documents/upload', upload, c.upload);
  r.get('/documents/:id/url', c.url);
  r.get('/:domain', c.tenantList);
  return r;
}
