import crypto from "crypto";

export function decryptRequest(body, privateKey) {
  const encryptedKey = Buffer.from(body.encrypted_aes_key, "base64");
  const iv = Buffer.from(body.initial_vector, "base64");

  const flowData = Buffer.from(body.encrypted_flow_data, "base64");

  // últimos 16 bytes = auth tag do GCM
  const encrypted_flow_data_body = flowData.subarray(0, flowData.length - 16);
  const encrypted_flow_data_tag = flowData.subarray(flowData.length - 16);

  const decryptedAesKey = crypto.privateDecrypt(
    {
      key: privateKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    encryptedKey
  );

  const decipher = crypto.createDecipheriv(
    "aes-128-gcm",
    decryptedAesKey,
    iv
  );

  decipher.setAuthTag(encrypted_flow_data_tag);

  const decryptedJSONString = Buffer.concat([
    decipher.update(encrypted_flow_data_body),
    decipher.final(),
  ]).toString("utf8");

  return {
    decryptedBody: JSON.parse(decryptedJSONString),
    aesKeyBuffer: decryptedAesKey,
    initialVectorBuffer: iv,
  };
}

export function encryptResponse(payload, aesKey, iv) {
  const cipher = crypto.createCipheriv("aes-128-gcm", aesKey, iv);

  const encryptedJSON = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return {
    encrypted_flow_data: Buffer.concat([encryptedJSON, authTag]).toString("base64"),
    initial_vector: iv.toString("base64"),
  };
}
