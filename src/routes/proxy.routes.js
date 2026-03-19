import { Router } from 'express';
import { requireApiKey } from '../middleware/api-key.js';

export function createProxyRouter({ statusController, proxyController, docsController }) {
  const router = Router();
  const protectedRouter = Router();

  router.get('/status/:protocolNumber', requireApiKey, statusController.getProtocolStatus);
  router.get('/status/job/:jobId', requireApiKey, statusController.getJobStatus);
  router.get('/openapi.json', requireApiKey, docsController.openApiJson);
  router.get('/health', statusController.health);

  protectedRouter.use(requireApiKey);
  protectedRouter.get('/token', proxyController.token);
  protectedRouter.post('/service-order/schedule', proxyController.schedule);
  protectedRouter.get('/capacity/availabilities', proxyController.getAvailabilities);
  protectedRouter.put('/ticket/customer/:ticketId', proxyController.updateTicketCustomer);
  protectedRouter.get('/ticket', proxyController.getTicketByDocument);
  protectedRouter.get('/cadastro-unico-verification', proxyController.cadastroUnicoVerification);

  router.use('/proxy', protectedRouter);

  return router;
}
