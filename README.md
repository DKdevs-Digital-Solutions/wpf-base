# WhatsApp Flows endpoint com fila em Node + Cloudflare R2

Projeto pronto para:

- validar endpoint do WhatsApp Flows
- receber fotos por `PhotoPicker`
- responder rápido ao `data_exchange`
- processar upload em segundo plano
- salvar arquivos no Cloudflare R2 usando o número de protocolo como pasta

## Como funciona

1. O endpoint `/whatsapp/flows` recebe o payload criptografado do Flow.
2. No `data_exchange`, o projeto grava um job em `data/jobs/pending`.
3. Um worker interno do Node consome os jobs com concorrência configurável.
4. Cada imagem é baixada do `cdn_url`, validada, descriptografada e enviada ao R2.
5. As chaves do bucket ficam assim:

```text
flows/NUMERO_DO_PROTOCOLO/foto_frente/arquivo.jpg
flows/NUMERO_DO_PROTOCOLO/foto_verso/arquivo.jpg
```

## Variáveis de ambiente

### Obrigatórias
- `PRIVATE_KEY` ou `PRIVATE_KEY_BASE64`
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

### Opcionais
- `PORT` default `3005`
- `JOB_CONCURRENCY` default `4`
- `JOB_POLL_INTERVAL_MS` default `1500`
- `JOB_MAX_ATTEMPTS` default `5`
- `R2_REGION` default `auto`
- `R2_KEY_PREFIX` default `flows`
- `R2_PUBLIC_BASE_URL` opcional, usada para montar URL pública

## Portainer

No Portainer, você pode usar `PRIVATE_KEY` com `\n` ou `PRIVATE_KEY_BASE64`.
Se o `PRIVATE_KEY` com `\n` quebrar, prefira `PRIVATE_KEY_BASE64`.

### Base64 no PowerShell

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("private.pem"))
```

## Subida local

```bash
npm install
npm start
```

Health:
```bash
GET /health
```

Flow endpoint:
```bash
POST /whatsapp/flows
```

## Persistência da fila

Monte um volume em `./data:/app/data` para manter os jobs entre reinícios.

Estrutura:
- `data/jobs/pending`
- `data/jobs/processing`
- `data/jobs/completed`
- `data/jobs/failed`

## Observações

- O endpoint responde rápido ao Flow e o processamento pesado fica na fila.
- O protocolo precisa ser enviado pelo Flow no campo `protocolo`.
- O projeto salva cada campo de foto em uma subpasta separada dentro da pasta do protocolo.
