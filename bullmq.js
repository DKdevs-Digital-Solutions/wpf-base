import { Queue, QueueEvents } from "bullmq";
import IORedis from "ioredis";

export const FLOW_QUEUE_NAME = process.env.BULLMQ_QUEUE_NAME || "whatsapp-flows";

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function createRedisConnection(env = process.env, extra = {}) {
  return new IORedis({
    host: env.REDIS_HOST || "redis",
    port: toNumber(env.REDIS_PORT, 6379),
    password: env.REDIS_PASSWORD || undefined,
    db: toNumber(env.REDIS_DB, 0),
    maxRetriesPerRequest: extra.maxRetriesPerRequest ?? null,
    enableReadyCheck: extra.enableReadyCheck ?? true,
    lazyConnect: extra.lazyConnect ?? false
  });
}

export function createFlowQueue(env = process.env) {
  const connection = createRedisConnection(env, { maxRetriesPerRequest: 1 });
  return new Queue(FLOW_QUEUE_NAME, { connection });
}

export function createFlowQueueEvents(env = process.env) {
  const connection = createRedisConnection(env, { maxRetriesPerRequest: null });
  return new QueueEvents(FLOW_QUEUE_NAME, { connection });
}
