import dotenv from 'dotenv';

dotenv.config();

export function getEnvNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

export function getEnv() {
  return {
    PORT: getEnvNumber('PORT', 3005),
    PRIVATE_KEY: process.env.PRIVATE_KEY || '',
    PRIVATE_KEY_BASE64: process.env.PRIVATE_KEY_BASE64 || '',
    BULL_BOARD_BASE_PATH: process.env.BULL_BOARD_BASE_PATH || '/admin/queues',
    JOB_CONCURRENCY: getEnvNumber('JOB_CONCURRENCY', 4),
    JOB_MAX_ATTEMPTS: getEnvNumber('JOB_MAX_ATTEMPTS', 5),
    JOB_BACKOFF_DELAY_MS: getEnvNumber('JOB_BACKOFF_DELAY_MS', 5000),
    JOB_BACKOFF_TYPE: process.env.JOB_BACKOFF_TYPE || 'exponential',
    BULLMQ_QUEUE_NAME: process.env.BULLMQ_QUEUE_NAME || 'whatsapp-flows'
  };
}
