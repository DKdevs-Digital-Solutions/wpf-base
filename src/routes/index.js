import { Router } from 'express';

export function createAppRouter({ flowController, statusController, proxyController, docsController }) {
  const router = Router();

  router.post('/whatsapp/flows', flowController.handleFlowWebhook);
  router.get('/health', statusController.health);
  router.get('/status/:protocolNumber', statusController.getProtocolStatus);
  router.get('/status/job/:jobId', statusController.getJobStatus);
  router.get('/openapi.json', docsController.openApiJson);

  router.get('/proxy/token', proxyController.token);
  router.post('/proxy/service-order/schedule', proxyController.schedule);
  router.get('/proxy/capacity/availabilities', proxyController.getAvailabilities);
  router.put('/proxy/ticket/customer/:ticketId', proxyController.updateTicketCustomer);

  return router;
}
