# WhatsApp Flows + BullMQ + Proxy CRM

Projeto refatorado para uma estrutura mais organizada, com suporte a:

- Swagger em `/docs`
- Spec OpenAPI em `/openapi.json`
- Proxy para APIs externas do CRM
- Gestão automática do token `Bearer`
- Bull Board para acompanhamento da fila

## Endpoints adicionados

### Swagger

- `GET /docs`
- `GET /openapi.json`
- `GET /proxy/token`

### Proxy CRM

- `GET /proxy/token`
- `POST /proxy/service-order/schedule`
- `GET /proxy/capacity/availabilities?postalCode=...&protocol=...`
- `PUT /proxy/ticket/customer/:ticketId`

## Como funciona o proxy

A aplicação recebe a chamada no endpoint local, busca o token no `AUTH_URL`, cacheia esse token em memória e envia a requisição ao CRM com o header `Authorization: Bearer ...`. O mesmo token também pode ser consultado externamente pelo endpoint `GET /proxy/token`.

Com isso:

- a URL original fica oculta do consumidor
- o token não precisa ser gerenciado no cliente
- em caso de `401`, a aplicação limpa o cache e tenta renovar o token automaticamente

## Variáveis importantes

```bash
SWAGGER_BASE_URL=http://localhost:3005
CRM_BASE_URL=https://crm-bot-stg.sigaantenado.com.br/crm/bot/api/v1
AUTH_URL=https://crm-bot-stg.sigaantenado.com.br/crm/bot/api/v1/authorization/get-token
AUTH_USERNAME=
AUTH_PASSWORD=
```

## Exemplos de uso

### Obter token

```bash
curl --location 'http://localhost:3005/proxy/token'
```

Para forçar renovação:

```bash
curl --location 'http://localhost:3005/proxy/token?forceRefresh=true'
```

### Agendar

```bash
curl --location 'http://localhost:3005/proxy/service-order/schedule' \
--header 'Content-Type: application/json' \
--data '{
  "protocol": "2026001234",
  "appointmentDate": "2026-03-20",
  "shift": "MORNING"
}'
```

### Consultar disponibilidades

```bash
curl --location 'http://localhost:3005/proxy/capacity/availabilities?postalCode=60000000&protocol=2026001234'
```

### Atualizar ticket/customer

```bash
curl --location --request PUT 'http://localhost:3005/proxy/ticket/customer/12345' \
--header 'Content-Type: application/json' \
--data '{
  "protocol": "2026001234",
  "customerName": "João da Silva"
}'
```

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
    proxy.controller.js
    status.controller.js
  docs/
    swagger.js
  lib/
    auth.js
    encryption.js
    http.js
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
    proxy.service.js
    worker.service.js
  workers/
    bull-worker.js
  server.js
```

## Subida

```bash
cp env.example .env
npm install
npm start
npm run worker
```

Acesse depois:

- Swagger: `http://localhost:3005/docs`
- OpenAPI JSON: `http://localhost:3005/openapi.json`
- Token: `http://localhost:3005/proxy/token`
