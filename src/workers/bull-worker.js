import { getEnv } from '../config/env.js';
import { createRedisConnection } from '../queues/bullmq.js';
import { createR2ClientFromEnv } from '../lib/r2.js';
import { Worker } from 'bullmq';
import { processFlowUploadJob } from '../services/worker.service.js';

const env = getEnv();
const connection = createRedisConnection(process.env, { maxRetriesPerRequest: null });
const r2 = createR2ClientFromEnv(process.env);

const worker = new Worker(
  process.env.BULLMQ_QUEUE_NAME || 'whatsapp-flows',
  async (job) => processFlowUploadJob({ ...job.data, r2 }),
  {
    connection,
    concurrency: env.JOB_CONCURRENCY
  }
);

worker.on('active', (job) => {
  console.log(`[BullMQ] job ativo: ${job.id} protocolo=${job.data?.protocolo || ''}`);
});

worker.on('completed', (job, result) => {
  console.log(`[BullMQ] job concluído: ${job.id} protocolo=${job.data?.protocolo || ''} uploads=${result?.uploadedCount || 0}`);
});

worker.on('failed', (job, error) => {
  console.error(`[BullMQ] job falhou: ${job?.id || 'desconhecido'}`, error.message);
});

process.on('SIGTERM', async () => {
  await worker.close();
  await connection.quit();
  process.exit(0);
});
