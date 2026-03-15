# WhatsApp Flows endpoint com fila em Node + Cloudflare R2

Projeto pronto para:

- validar endpoint do WhatsApp Flows
- receber fotos por `PhotoPicker`
- responder rápido ao `data_exchange`
- processar upload em segundo plano
- salvar arquivos no Cloudflare R2 usando o número de protocolo como pasta
- usar o nome da etapa como nome do arquivo
- consultar depois se funcionou pelo protocolo

## Como funciona

1. O endpoint `/whatsapp/flows` recebe o payload criptografado do Flow.
2. No `data_exchange`, o projeto grava um job em `data/jobs/pending`.
3. O Flow finaliza e devolve a resposta ao chat com `extension_message_response`.
4. Um worker interno do Node consome os jobs com concorrência configurável.
5. Cada imagem é baixada, validada, descriptografada e enviada ao R2.
6. Você consulta o resultado em `GET /status/:protocolNumber`.

## Estrutura no bucket

```text
flows/NUMERO_DO_PROTOCOLO/foto_frente.jpg
flows/NUMERO_DO_PROTOCOLO/foto_verso.jpg
```

Se houver mais de um arquivo na mesma etapa:

```text
flows/NUMERO_DO_PROTOCOLO/foto_frente_1.jpg
flows/NUMERO_DO_PROTOCOLO/foto_frente_2.jpg
```

## Endpoint de status

```bash
GET /status/123456
```

Exemplo de resposta:

```json
{
  "ok": true,
  "protocolNumber": "123456",
  "queueFolder": "completed",
  "jobId": "...",
  "status": "completed",
  "uploadedCount": 2,
  "uploadedFiles": [
    {
      "fieldName": "foto_frente",
      "key": "flows/123456/foto_frente.jpg",
      "publicUrl": null,
      "status": "uploaded"
    }
  ]
}
```
