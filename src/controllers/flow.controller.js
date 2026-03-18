import { decryptRequest, encryptResponse } from '../lib/encryption.js';
import { handleFlowStep } from '../services/flow.service.js';

function activeResponse(version) {
  return { version: version || '3.0', data: { status: 'active' } };
}

function extractFlowData(payload) {
  if (!payload || typeof payload !== 'object') return {};
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) {
    return payload.data;
  }
  return payload;
}

export function createFlowController({ privateKey, enqueueJob }) {
  return {
    handleFlowWebhook: async (req, res) => {
      try {
        const { decryptedBody, aesKeyBuffer, initialVectorBuffer } = decryptRequest(req.body, privateKey);
        const { action, version, screen, data } = decryptedBody;
        const normalizedData = extractFlowData(data);

        if (action === 'ping') {
          const encryptedResponse = encryptResponse(activeResponse(version), aesKeyBuffer, initialVectorBuffer);
          return res.status(200).type('text/plain').send(encryptedResponse);
        }

        if (action === 'INIT') {
          console.log('INIT recebido:', JSON.stringify(decryptedBody, null, 2));

          const responsePayload = await handleFlowStep({
            screen: 'INIT',
            data: normalizedData,
            version,
            enqueueJob
          });

          const encryptedResponse = encryptResponse(responsePayload, aesKeyBuffer, initialVectorBuffer);
          return res.status(200).type('text/plain').send(encryptedResponse);
        }

        if (action === 'data_exchange') {
          console.log('Screen:', screen);
          console.log('Payload recebido:', JSON.stringify(normalizedData, null, 2));

          const responsePayload = await handleFlowStep({ screen, data: normalizedData, version, enqueueJob });
          const encryptedResponse = encryptResponse(responsePayload, aesKeyBuffer, initialVectorBuffer);
          return res.status(200).type('text/plain').send(encryptedResponse);
        }

        const encryptedResponse = encryptResponse(activeResponse(version), aesKeyBuffer, initialVectorBuffer);
        return res.status(200).type('text/plain').send(encryptedResponse);
      } catch (error) {
        console.error('Erro endpoint flow:', error);
        return res.status(500).send('internal_error');
      }
    }
  };
}
