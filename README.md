# whatsapp-flows-endpoint

Projeto Node.js com:
- proxy para APIs do CRM
- gerenciamento de token
- Swagger/OpenAPI
- worker com BullMQ
- Redis via Docker Compose

## Subida rápida

1. Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

2. Preencha pelo menos estas variáveis no `.env`:

```env
CRM_BASE_URL=https://crm-bot-stg.sigaantenado.com.br/crm/bot/api/v1
AUTH_URL=https://crm-bot-stg.sigaantenado.com.br/crm/bot/api/v1/authorization/get-token
AUTH_USERNAME=seu_usuario
AUTH_PASSWORD=sua_senha
```

3. Suba os containers:

```bash
docker compose up -d --build
```

## Serviços

- API: `http://localhost:3005`
- Swagger: `http://localhost:3005/docs`
- OpenAPI: `http://localhost:3005/openapi.json`
- Redis: `localhost:6379`

## Endpoints principais

- `GET /proxy/token`
- `GET /proxy/token?forceRefresh=true`
- `POST /proxy/service-order/schedule`
- `GET /proxy/capacity/availabilities?postalCode=...&protocol=...`
- `PUT /proxy/ticket/customer/:ticketId`

## Observações

- O consumer externo pode chamar a sua API e não precisa conhecer a URL real do CRM.
- O token é obtido internamente e reutilizado com cache.
- O compose já sobe `app`, `worker` e `redis`.
- Se não for usar o worker agora, pode comentar o serviço `worker` no `docker-compose.yml`.

## Comandos úteis

```bash
docker compose logs -f app
docker compose logs -f worker
docker compose down
docker compose down -v
```


## Segurança das rotas públicas

As rotas em `/proxy` aceitam um chave geral de acesso definido em `API_KEY`.

Envie de um destes jeitos:
- header `x-api-key: SEU_TOKEN`
- header `Authorization: Bearer SEU_TOKEN`
- querystring ``

## Nova rota adicionada

- `GET /proxy/ticket?document=00165120304&document-type=CPF`


## Ajustes aplicados no Flow

- Adicionado schema `data` com `__example__` em todas as telas do `flow.json`.
- Alinhado o backend para responder apenas com os campos esperados por cada tela.
- Removida a validação de telefone principal na tela inicial.
- Incluído campo de `telefone_principal` na tela `CONTATOS`, permitindo seguir mesmo quando a abertura do Flow envia o telefone vazio.
- Mantido o suporte a uploads de mídia como arrays nas telas de foto.
