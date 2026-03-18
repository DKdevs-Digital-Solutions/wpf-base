import { Router } from 'express';

function extractApiKey(req) {
  return String(req.headers['x-api-key'] || '').trim();
}

function requireApiKey(req, res, next) {
  const expectedKey = String(process.env.API_KEY || '').trim();

  if (!expectedKey) {
    return next();
  }

  const informedKey = extractApiKey(req);
  if (informedKey && informedKey === expectedKey) {
    return next();
  }

  return res.status(401).json({
    ok: false,
    error: 'unauthorized',
    message: 'x-api-key inválida ou ausente.'
  });
}

export function createAppRouter({ flowController, statusController, proxyController, docsController }) {
  const router = Router();
  const publicProxyRouter = Router();

  router.post('/whatsapp/flows', flowController.handleFlowWebhook);
  router.get('/health', statusController.health);
  router.get('/status/:protocolNumber', statusController.getProtocolStatus);
  router.get('/status/job/:jobId', statusController.getJobStatus);
  router.get('/openapi.json', docsController.openApiJson);

  publicProxyRouter.use(requireApiKey);
  publicProxyRouter.get('/token', proxyController.token);
  publicProxyRouter.post('/service-order/schedule', proxyController.schedule);
  publicProxyRouter.get('/capacity/availabilities', proxyController.getAvailabilities);
  publicProxyRouter.put('/ticket/customer/:ticketId', proxyController.updateTicketCustomer);
  publicProxyRouter.get('/ticket', proxyController.getTicketByDocument);
  publicProxyRouter.get('/cadastro-unico-verification', proxyController.cadastroUnicoVerification);
  router.use('/proxy', publicProxyRouter);

  return router;
}
