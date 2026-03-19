import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { requireApiKey } from '../middleware/api-key.js';
import { createStatusController } from '../controllers/status.controller.js';
import { createProxyController } from '../controllers/proxy.controller.js';
import { createProxyRouter } from '../routes/proxy.routes.js';
import { createProxyService } from '../services/proxy.service.js';
import { buildOpenApiSpec } from '../docs/swagger.js';

export function createProxyApp({ flowQueue, env }) {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  const statusController = createStatusController({
    flowQueue,
    bullBoardBasePath: env.BULL_BOARD_BASE_PATH || '/admin/queues'
  });

  const proxyService = createProxyService(env);
  const proxyController = createProxyController({ proxyService });
  const openApiSpec = buildOpenApiSpec(env);
  const docsController = {
    openApiJson: (_req, res) => res.json(openApiSpec)
  };

  app.use('/docs', requireApiKey, swaggerUi.serve, swaggerUi.setup(openApiSpec, {
    explorer: true,
    customSiteTitle: 'WPF Base Proxy API Docs'
  }));

  app.use(createProxyRouter({ statusController, proxyController, docsController }));

  return app;
}
