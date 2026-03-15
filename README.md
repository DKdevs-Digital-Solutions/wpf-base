
WhatsApp Flows Endpoint Example

1. Coloque sua private.pem na raiz do projeto.
2. Instale dependências:

npm install

3. Rode o servidor:

npm start

Endpoint:
POST /whatsapp/flows

Use a URL pública deste endpoint como `endpoint_uri` no Flow.

Esse projeto inclui:
- decryptRequest (RSA + AES)
- encryptResponse
- exemplo de Flow com upload de foto
