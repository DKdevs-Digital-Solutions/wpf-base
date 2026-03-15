import crypto from "crypto";

function flipIV(iv) {
  const flipped = Buffer.alloc(iv.length);
  for (let i = 0; i < iv.length; i += 1) {
    flipped[i] = iv[i] ^ 0xff;
  }
  return flipped;
}

export function decryptRequest(body, privateKey) {
  const encryptedKey = Buffer.from(body.encrypted_aes_key, "base64");
  const iv = Buffer.from(body.initial_vector, "base64");
  const flowData = Buffer.from(body.encrypted_flow_data, "base64");

  const encryptedBody = flowData.subarray(0, flowData.length - 16);
  const authTag = flowData.subarray(flowData.length - 16);

  const aesKey = crypto.privateDecrypt(
    {
      key: privateKey,
      format: "pem",
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256"
    },
    encryptedKey
  );

  const decipher = crypto.createDecipheriv("aes-128-gcm", aesKey, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encryptedBody),
    decipher.final()
  ]).toString("utf8");

  return {
    decryptedBody: JSON.parse(decrypted),
    aesKeyBuffer: aesKey,
    initialVectorBuffer: iv
  };
}

export function encryptResponse(payload, aesKey, iv) {
  const flippedIV = flipIV(iv);
  const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, flippedIV);

  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final()
  ]);

  const authTag = cipher.getAuthTag();
  return Buffer.concat([encrypted, authTag]).toString("base64");
}
