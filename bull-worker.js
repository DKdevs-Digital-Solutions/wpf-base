import dotenv from "dotenv";
import { Worker } from "bullmq";
import { createRedisConnection, FLOW_QUEUE_NAME } from "./bullmq.js";
import { createR2ClientFromEnv } from "./r2.js";
import { processFlowUploadJob } from "./worker.js";

dotenv.config();

const connection = createRedisConnection(process.env, { maxRetriesPerRequest: null });
const r2 = createR2ClientFromEnv(process.env);

const worker = new Worker(
  FLOW_QUEUE_NAME,
  async (job) => processFlowUploadJob({ ...job.data, r2 }),
  {
    connection,
    concurrency: Number(process.env.JOB_CONCURRENCY || 4)
  }
);

worker.on("active", (job) => {
  console.log(`[BullMQ] job ativo: ${job.id} protocolo=${job.data?.protocolo || ""}`);
});

worker.on("completed", (job, result) => {
  console.log(`[BullMQ] job concluído: ${job.id} protocolo=${job.data?.protocolo || ""} uploads=${result?.uploadedCount || 0}`);
});

worker.on("failed", (job, error) => {
  console.error(`[BullMQ] job falhou: ${job?.id || "desconhecido"}`, error.message);
});

process.on("SIGTERM", async () => {
  await worker.close();
  await connection.quit();
  process.exit(0);
});
