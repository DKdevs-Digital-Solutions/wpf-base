import express from 'express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { createFlowController } from '../controllers/flow.controller.js';
import { createStatusController } from '../controllers/status.controller.js';
import { createAppRouter } from '../routes/index.js';
import { enqueueFlowJob } from '../services/job.service.js';

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

  app.use(createAppRouter({ flowController, statusController }));

  return app;
}
