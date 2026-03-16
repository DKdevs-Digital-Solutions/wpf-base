import crypto from 'crypto';

export function getPrivateKey(env) {
  if (env.PRIVATE_KEY_BASE64) {
    return Buffer.from(env.PRIVATE_KEY_BASE64, "base64").toString("utf8");
  }

  if (env.PRIVATE_KEY) {
    return env.PRIVATE_KEY.replace(/\\n/g, "\n");
  }

  throw new Error("PRIVATE_KEY ou PRIVATE_KEY_BASE64 não informado.");
}

export function validatePrivateKey(privateKey) {
  if (!privateKey) {
    throw new Error('PRIVATE_KEY ou PRIVATE_KEY_BASE64 não definida nas variáveis de ambiente');
  }

  crypto.createPrivateKey({ key: privateKey, format: 'pem' });
  return privateKey;
}
