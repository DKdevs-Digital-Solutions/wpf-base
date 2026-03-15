import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

function normalizePrefix(value = "") {
  return value.replace(/^\/+|\/+$/g, "");
}

function sanitizeFolder(value = "") {
  return String(value)
    .normalize("NFKC")
    .replace(/[^\w\-./]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function createR2ClientFromEnv(env = process.env) {
  const required = [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET"
  ];

  for (const key of required) {
    if (!env[key]) {
      throw new Error(`Variável ${key} não definida`);
    }
  }

  const region = env.R2_REGION || "auto";
  const endpoint = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

  return {
    bucket: env.R2_BUCKET,
    publicBaseUrl: env.R2_PUBLIC_BASE_URL || "",
    keyPrefix: normalizePrefix(env.R2_KEY_PREFIX || "flows"),
    client: new S3Client({
      region,
      endpoint,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY
      }
    })
  };
}

export async function uploadBufferToR2(r2, params) {
  const protocolFolder = sanitizeFolder(params.protocolNumber);
  if (!protocolFolder) {
    throw new Error("protocolNumber inválido para pasta do bucket");
  }

  const fileName = sanitizeFolder(params.fileName || "arquivo.bin") || "arquivo.bin";
  const key = [r2.keyPrefix, protocolFolder, fileName].filter(Boolean).join("/");

  const putResult = await r2.client.send(
    new PutObjectCommand({
      Bucket: r2.bucket,
      Key: key,
      Body: params.buffer,
      ContentType: params.contentType || "application/octet-stream",
      Metadata: {
        protocol: protocolFolder,
        field: sanitizeFolder(params.fieldName || "arquivo")
      }
    })
  );

  await r2.client.send(new HeadObjectCommand({ Bucket: r2.bucket, Key: key }));

  const publicUrl = r2.publicBaseUrl
    ? `${r2.publicBaseUrl.replace(/\/+$/g, "")}/${key}`
    : null;

  return { key, publicUrl, etag: putResult.ETag || null };
}
