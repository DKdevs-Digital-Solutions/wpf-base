import path from "path";
import { fetchAndDecryptFlowMedia } from "./media.js";
import { uploadBufferToR2 } from "./r2.js";

function pickMediaFields(data) {
  return Object.entries(data || {}).filter(([, value]) => {
    return Array.isArray(value) && value.every((item) => item?.cdn_url && item?.encryption_metadata);
  });
}

function sanitizeStageName(value = "") {
  return String(value)
    .normalize("NFKC")
    .replace(/[^\w\-.]+/g, "_")
    .replace(/^_+|_+$/g, "") || "etapa";
}

function guessContentType(extension, fallbackMime) {
  const ext = (extension || "").toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return fallbackMime || "application/octet-stream";
}

export async function processFlowUploadJob(payload, context) {
  const protocolNumber = String(payload.protocolNumber || "").trim();
  if (!protocolNumber) {
    throw new Error("protocolNumber não informado");
  }

  const uploadedFiles = [];

  for (const [fieldName, mediaItems] of pickMediaFields(payload.data)) {
    for (let index = 0; index < mediaItems.length; index += 1) {
      const media = mediaItems[index];
      const { buffer, extension, mimeType } = await fetchAndDecryptFlowMedia(media);
      const safeStageName = sanitizeStageName(fieldName);
      const finalFileName = mediaItems.length > 1
        ? `${safeStageName}_${index + 1}.${extension || "bin"}`
        : `${safeStageName}.${extension || "bin"}`;

      const upload = await uploadBufferToR2(payload.r2, {
        protocolNumber,
        fieldName: safeStageName,
        fileName: finalFileName,
        buffer,
        contentType: guessContentType(path.extname(finalFileName).slice(1), mimeType)
      });

      uploadedFiles.push({
        fieldName: safeStageName,
        originalFileName: media.file_name,
        mediaId: media.media_id,
        key: upload.key,
        publicUrl: upload.publicUrl,
        status: "uploaded"
      });
    }
  }

  return {
    protocolNumber,
    uploadedCount: uploadedFiles.length,
    uploadedFiles,
    status: "completed"
  };
}
