# WhatsApp Flows + BullMQ

Projeto refatorado para uma estrutura mais organizada, sem concentrar toda a lógica no `server.js`.

## Estrutura

```text
src/
  app/
    create-app.js
  config/
    env.js
    private-key.js
  controllers/
    flow.controller.js
    status.controller.js
  lib/
    encryption.js
    media.js
    r2.js
    validations.js
  queues/
    bullmq.js
  routes/
    index.js
  services/
    flow.service.js
    job.service.js
    worker.service.js
  workers/
    bull-worker.js
  server.js
```

## Responsabilidades

- `server.js`: sobe a API e conecta fila/eventos
- `app/create-app.js`: monta Express + bull-board + rotas
- `controllers/`: recebem HTTP e devolvem resposta
- `services/flow.service.js`: regras do WhatsApp Flow
- `services/job.service.js`: enqueue e consulta de jobs
- `services/worker.service.js`: processamento dos uploads
- `lib/`: criptografia, mídia, R2 e validações
- `queues/bullmq.js`: conexão Redis/BullMQ
- `workers/bull-worker.js`: worker dedicado

## Subida

```bash
cp env.example .env
npm install
npm start
npm run worker
```

ou com Docker Compose.
