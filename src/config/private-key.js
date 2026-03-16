import crypto from 'node:crypto';

export function loadPrivateKey(env) {
  if (env.PRIVATE_KEY_BASE64?.trim()) {
    return Buffer.from(env.PRIVATE_KEY_BASE64, 'base64').toString('utf8');
  }

  if (env.PRIVATE_KEY?.trim()) {
    return env.PRIVATE_KEY.replace(/\\n/g, '\n').trim();
  }

  throw new Error('PRIVATE_KEY ou PRIVATE_KEY_BASE64 não informado.');
}

export function validatePrivateKey(privateKey) {
  try {
    crypto.createPrivateKey({
      key: privateKey,
      format: 'pem',
    });
    return true;
  } catch (error) {
    throw new Error(`PRIVATE_KEY inválida: ${error.message}`);
  }
}