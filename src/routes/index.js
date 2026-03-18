import { Router } from 'express';

function extractApiKey(req) {
  return String(req.headers['x-api-key'] || '').trim();
}

function requireApiKey(req, res, next) {
  const expectedKey = String(process.env.API_KEY || '').trim();

  console.log('[API KEY CHECK]', {
    path: req.path,
    method: req.method,
    hasApiKey: !!req.headers['x-api-key']
  });

  if (!expectedKey) {
    console.log('[API KEY] Nenhuma chave configurada no servidor');
    return next();
  }

  const informedKey = extractApiKey(req);

  if (informedKey && informedKey === expectedKey) {
    console.log('[API KEY] chave válida');
    return next();
  }

  console.log('[API KEY] chave inválida ou ausente');

  return res.status(401).json({
    ok: false,
    error: 'unauthorized',
    message: 'x-api-key inválida ou ausente.'
  });
}

export function createAppRouter({ flowController, statusController, proxyController, docsController }) {
  const router = Router();
  const publicProxyRouter = Router();

  // LOG GLOBAL DO ROUTER
  router.use((req, res, next) => {
    console.log('[ROUTER]', {
      method: req.method,
      path: req.originalUrl,
      time: new Date().toISOString()
    });
    next();
  });

  // FLOW ENDPOINT
  router.post('/whatsapp/flows', (req, res, next) => {
    console.log('[FLOW ENDPOINT HIT]', {
      method: req.method,
      url: req.originalUrl,
      headers: req.headers,
      time: new Date().toISOString()
    });
    next();
  }, flowController.handleFlowWebhook);

  router.get('/health', (req, res, next) => {
    console.log('[HEALTH CHECK]');
    next();
  }, statusController.health);

  router.get('/status/:protocolNumber', (req, res, next) => {
    console.log('[STATUS PROTOCOL]', req.params.protocolNumber);
    next();
  }, statusController.getProtocolStatus);

  router.get('/status/job/:jobId', (req, res, next) => {
    console.log('[STATUS JOB]', req.params.jobId);
    next();
  }, statusController.getJobStatus);

  router.get('/openapi.json', (req, res, next) => {
    console.log('[OPENAPI]');
    next();
  }, docsController.openApiJson);

  publicProxyRouter.use(requireApiKey);

  publicProxyRouter.get('/token', (req, res, next) => {
    console.log('[PROXY TOKEN]');
    next();
  }, proxyController.token);

  publicProxyRouter.post('/service-order/schedule', (req, res, next) => {
    console.log('[PROXY SCHEDULE]');
    next();
  }, proxyController.schedule);

  publicProxyRouter.get('/capacity/availabilities', (req, res, next) => {
    console.log('[PROXY AVAILABILITIES]');
    next();
  }, proxyController.getAvailabilities);

  publicProxyRouter.put('/ticket/customer/:ticketId', (req, res, next) => {
    console.log('[PROXY UPDATE CUSTOMER]', req.params.ticketId);
    next();
  }, proxyController.updateTicketCustomer);

  publicProxyRouter.get('/ticket', (req, res, next) => {
    console.log('[PROXY GET TICKET]');
    next();
  }, proxyController.getTicketByDocument);

  publicProxyRouter.get('/cadastro-unico-verification', (req, res, next) => {
    console.log('[PROXY CADASTRO UNICO]');
    next();
  }, proxyController.cadastroUnicoVerification);

  router.use('/proxy', publicProxyRouter);

  return router;
}