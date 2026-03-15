import { Queue, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';

export const DEFAULT_FLOW_QUEUE_NAME = process.env.BULLMQ_QUEUE_NAME || 'whatsapp-flows';

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function createRedisConnection(env = process.env, extra = {}) {
  const connection = new IORedis({
    host: env.REDIS_HOST || 'host.docker.internal',
    port: toNumber(env.REDIS_PORT, 6379),
    password: env.REDIS_PASSWORD || undefined,
    db: toNumber(env.REDIS_DB, 0),
    maxRetriesPerRequest: extra.maxRetriesPerRequest ?? null,
    enableReadyCheck: extra.enableReadyCheck ?? true,
    lazyConnect: extra.lazyConnect ?? false
  });

  connection.on('error', (error) => {
    console.error(`[Redis] ${error.message}`);
  });

  return connection;
}

export function createFlowQueue(env = process.env) {
  const connection = createRedisConnection(env, { maxRetriesPerRequest: 1 });
  return new Queue(env.BULLMQ_QUEUE_NAME || DEFAULT_FLOW_QUEUE_NAME, { connection });
}

export function createFlowQueueEvents(env = process.env) {
  const connection = createRedisConnection(env, { maxRetriesPerRequest: null });
  return new QueueEvents(env.BULLMQ_QUEUE_NAME || DEFAULT_FLOW_QUEUE_NAME, { connection });
}
