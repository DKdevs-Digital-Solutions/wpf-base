import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { createFlowController } from '../controllers/flow.controller.js';
import { createStatusController } from '../controllers/status.controller.js';
import { createProxyController } from '../controllers/proxy.controller.js';
import { createAppRouter } from '../routes/index.js';
import { enqueueFlowJob } from '../services/job.service.js';
import { createProxyService } from '../services/proxy.service.js';
import { buildOpenApiSpec } from '../docs/swagger.js';

export function createApp({ flowQueue, bullBoardBasePath, privateKey, env }) {
  const app = express();
  app.use(express.json({ limit: '20mb' }));

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(bullBoardBasePath);

  createBullBoard({
    queues: [new BullMQAdapter(flowQueue)],
    serverAdapter
  });

  app.use(bullBoardBasePath, serverAdapter.getRouter());

  const flowController = createFlowController({
    privateKey,
    enqueueJob: (payload) => enqueueFlowJob(flowQueue, payload, env)
  });

  const statusController = createStatusController({ flowQueue, bullBoardBasePath });
  const proxyService = createProxyService(env);
  const proxyController = createProxyController({ proxyService });
  const openApiSpec = buildOpenApiSpec(env);
  const docsController = {
    openApiJson: (_req, res) => res.json(openApiSpec)
  };

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, {
    explorer: true,
    customSiteTitle: 'WPF Base Proxy API Docs'
  }));

  app.use(createAppRouter({
    flowController,
    statusController,
    proxyController,
    docsController
  }));

  return app;
}
