import axios from "axios";
import crypto from "crypto";

function b64(value) {
  return Buffer.from(value, "base64");
}

function sanitizeFilename(name = "") {
  return name
    .normalize("NFKC")
    .replace(/[^\w.\-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "arquivo";
}

function detectExtension(media) {
  const safe = sanitizeFilename(media.file_name || "");
  const fromName = safe.includes(".") ? safe.split(".").pop().toLowerCase() : "";
  if (fromName) {
    return fromName;
  }

  const mime = (media.mime_type || "").toLowerCase();
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg";
  if (mime.includes("png")) return "png";
  if (mime.includes("webp")) return "webp";
  return "bin";
}

function decryptFlowMediaBuffer(encryptedBuffer, metadata) {
  const encryptedHash = crypto.createHash("sha256").update(encryptedBuffer).digest("base64");
  if (metadata.encrypted_hash && encryptedHash !== metadata.encrypted_hash) {
    throw new Error("encrypted_hash inválido");
  }

  const encKey = b64(metadata.encryption_key);
  const iv = b64(metadata.iv);
  const hmacKey = b64(metadata.hmac_key);
  const expectedHmac = b64(metadata.hmac);

  const calculatedHmac = crypto.createHmac("sha256", hmacKey).update(encryptedBuffer).digest();

  if (
    expectedHmac.length !== calculatedHmac.length ||
    !crypto.timingSafeEqual(expectedHmac, calculatedHmac)
  ) {
    throw new Error("HMAC inválido");
  }

  const decipher = crypto.createDecipheriv("aes-256-cbc", encKey, iv);
  const decrypted = Buffer.concat([
    decipher.update(encryptedBuffer),
    decipher.final()
  ]);

  const plaintextHash = crypto.createHash("sha256").update(decrypted).digest("base64");
  if (metadata.plaintext_hash && plaintextHash !== metadata.plaintext_hash) {
    throw new Error("plaintext_hash inválido");
  }

  return decrypted;
}

export async function fetchAndDecryptFlowMedia(media) {
  if (!media?.cdn_url || !media?.encryption_metadata) {
    throw new Error("Objeto de mídia inválido");
  }

  const response = await axios.get(media.cdn_url, {
    responseType: "arraybuffer",
    timeout: 30000,
    maxContentLength: 25 * 1024 * 1024,
    maxBodyLength: 25 * 1024 * 1024
  });

  const encryptedBuffer = Buffer.from(response.data);
  const decrypted = decryptFlowMediaBuffer(encryptedBuffer, media.encryption_metadata);

  return {
    buffer: decrypted,
    sanitizedFileName: sanitizeFilename(media.file_name || "arquivo"),
    extension: detectExtension(media),
    mimeType: media.mime_type || "application/octet-stream"
  };
}
