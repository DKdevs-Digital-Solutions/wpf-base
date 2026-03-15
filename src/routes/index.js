import { Router } from 'express';

export function createAppRouter({ flowController, statusController }) {
  const router = Router();

  router.post('/whatsapp/flows', flowController.handleFlowWebhook);
  router.get('/health', statusController.health);
  router.get('/status/:protocolNumber', statusController.getProtocolStatus);
  router.get('/status/job/:jobId', statusController.getJobStatus);

  return router;
}
