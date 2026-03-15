import crypto from "crypto";

export function decryptRequest(body, privateKey) {
  const encryptedKey = Buffer.from(body.encrypted_aes_key, "base64");
  const iv = Buffer.from(body.initial_vector, "base64");
  const encryptedPayload = Buffer.from(body.encrypted_flow_data, "base64");

  const aesKey = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256"
    },
    encryptedKey
  );

  const decipher = crypto.createDecipheriv("aes-256-cbc", aesKey, iv);
  let decrypted = decipher.update(encryptedPayload);
  decrypted = Buffer.concat([decrypted, decipher.final()]);

  const decryptedBody = JSON.parse(decrypted.toString("utf8"));

  return {
    decryptedBody,
    aesKeyBuffer: aesKey,
    initialVectorBuffer: iv
  };
}

export function encryptResponse(payload, aesKey, iv) {
  const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);

  let encrypted = cipher.update(JSON.stringify(payload), "utf8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  return {
    encrypted_flow_data: encrypted.toString("base64"),
    initial_vector: iv.toString("base64")
  };
}
