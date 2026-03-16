import crypto from 'crypto';

export function loadPrivateKey(env = process.env) {
  if (env.PRIVATE_KEY_BASE64) {
    return Buffer.from(env.PRIVATE_KEY_BASE64, 'base64').toString('utf8').trim();
  }

  if (env.PRIVATE_KEY) {
    return env.PRIVATE_KEY.replace(/\\n/g, '\n').trim();
  }

  return '';
}

export function validatePrivateKey(privateKey) {
  if (!privateKey) {
    throw new Error('PRIVATE_KEY ou PRIVATE_KEY_BASE64 não definida nas variáveis de ambiente');
  }

  try {
    crypto.createPrivateKey({ key: privateKey, format: 'pem' });
  } catch {
    throw new Error('Chave privada inválida. Verifique se a PEM está completa e se os \\n foram convertidos corretamente.');
  }

  return privateKey;
}
