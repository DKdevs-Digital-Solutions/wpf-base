import { decryptRequest, encryptResponse } from '../lib/encryption.js';
import { handleFlowStep } from '../services/flow.service.js';

function activeResponse(version) {
  return { version: version || '3.0', data: { status: 'active' } };
}

export function createFlowController({ privateKey, enqueueJob }) {
  return {
    handleFlowWebhook: async (req, res) => {
      try {
        const { decryptedBody, aesKeyBuffer, initialVectorBuffer } = decryptRequest(req.body, privateKey);
        const { action, version, screen, data } = decryptedBody;

        if (action === 'ping') {
          const encryptedResponse = encryptResponse(activeResponse(version), aesKeyBuffer, initialVectorBuffer);
          return res.status(200).type('text/plain').send(encryptedResponse);
        }

        if (action === 'INIT') {
          const responsePayload = await handleFlowStep({
            screen: 'INIT',
            data,
            enqueueJob
          });

          const encryptedResponse = encryptResponse(responsePayload, aesKeyBuffer, initialVectorBuffer);
          return res.status(200).type('text/plain').send(encryptedResponse);
        }

        if (action === 'data_exchange') {
          console.log('Screen:', screen);
          console.log('Payload recebido:', JSON.stringify(data, null, 2));

          const responsePayload = await handleFlowStep({ screen, data, enqueueJob });
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
