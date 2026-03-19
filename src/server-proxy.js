import { getEnv } from './config/env.js';
import { createFlowQueue } from './queues/bullmq.js';
import { createProxyApp } from './app/create-proxy-app.js';

const env = getEnv();
const flowQueue = createFlowQueue(process.env);
const port = Number(process.env.PROXY_PORT || 3006);

const app = createProxyApp({
  flowQueue,
  env: process.env
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Proxy endpoint rodando na porta ${port}`);
  console.log(`Swagger disponível em /docs`);
});
