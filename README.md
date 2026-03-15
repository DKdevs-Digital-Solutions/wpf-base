# WhatsApp Flows + BullMQ

Projeto atualizado para o fluxo:

- CPF_INPUT
- TELEFONE_PRINCIPAL
- TELEFONE_RECADO
- CEP_INPUT
- CONFIRMA_ENDERECO_CEP
- COMPLEMENTA_ENDERECO
- PONTO_REFERENCIA
- TIPO_DOCUMENTO
- DOC_FRENTE
- DOC_VERSO
- SELFIE_COM_DOC
- COMPROVANTE
- FACHADA
- TV_LIGADA
- RESUMO_FINAL
- CONFIRMACAO_FINAL
- FINISH

## O que mudou

- troca da fila em arquivo por **BullMQ + Redis**
- separação entre API (`server.js`) e worker (`bull-worker.js`)
- retorno padronizado no Flow para encerramentos fora do comum:
  - `status = failure`
  - `reason_code = ...`
  - `reason = ...`
- revalidação de **CEP + viabilidade + fase extra** sempre que o CEP for informado novamente
- endpoint de status por protocolo e por job

## Subida local

```bash
cp env.example .env
docker compose up --build
```

## Serviços

- API: `http://localhost:3005`
- Redis: `localhost:6379`
- endpoint do flow: `POST /whatsapp/flows`
- health: `GET /health`
- status por protocolo: `GET /status/:protocolNumber`
- status por job: `GET /status/job/:jobId`

## Como saber se o job executou ou falhou

Consultar:

```bash
GET /status/PROTOCOLO_123456
```

Exemplo:

```json
{
  "ok": true,
  "protocolo": "PROTOCOLO_123456",
  "jobId": "12",
  "status": "completed",
  "attemptsMade": 1,
  "failedReason": null,
  "result": {
    "uploadedCount": 6
  }
}
```

Status possíveis mais comuns:

- `waiting`
- `active`
- `completed`
- `failed`
- `delayed`

## Variáveis extras para integrações

```env
ELIGIBILITY_API_URL=
EXTRA_PHASE_FAMILY_API_URL=
FAMILY_CODE_VERIFICATION_API_URL=
CITY_AVAILABILITY_API_URL=
EXTRA_PHASE_IBGE_API_URL=
CEP_API_URL=
```

Sem essas URLs, o projeto usa validações locais e fallback de CEP via ViaCEP.

## Observação sobre falhas de negócio

Quando o backend identificar casos como:

- CPF inválido
- não elegível
- sem fase extra
- cidade não atendida
- já possui instalação
- já possui agendamento
- confirmação negada

o Flow é encerrado em `FINISH` com `status=failure`, `reason_code` e `reason`, para você continuar fora do Flow.
