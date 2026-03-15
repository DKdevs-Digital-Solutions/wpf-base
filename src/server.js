import { getEnv } from './config/env.js';
import { loadPrivateKey, validatePrivateKey } from './config/private-key.js';
import { createFlowQueue, createFlowQueueEvents } from './queues/bullmq.js';
import { createApp } from './app/create-app.js';

const env = getEnv();
const privateKey = validatePrivateKey(loadPrivateKey(process.env));
const flowQueue = createFlowQueue(process.env);
const queueEvents = createFlowQueueEvents(process.env);

queueEvents.on('completed', ({ jobId }) => {
  console.log(`[BullMQ] evento completed para job ${jobId}`);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`[BullMQ] evento failed para job ${jobId}: ${failedReason}`);
});

const app = createApp({
  flowQueue,
  bullBoardBasePath: env.BULL_BOARD_BASE_PATH,
  privateKey,
  env: process.env
});

app.listen(env.PORT, '0.0.0.0', () => {
  console.log(`Flow endpoint rodando na porta ${env.PORT}`);
  console.log(`Bull Board disponível em ${env.BULL_BOARD_BASE_PATH}`);
});
