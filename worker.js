import path from "path";
import { fetchAndDecryptFlowMedia } from "./media.js";
import { uploadBufferToR2 } from "./r2.js";

function pickMediaFields(data) {
  return Object.entries(data || {}).filter(([, value]) => {
    return Array.isArray(value) && value.every((item) => item?.cdn_url && item?.encryption_metadata);
  });
}

function buildOutputFileName(media, extension, index) {
  const original = (media.file_name || "").normalize("NFKC").replace(/[^\w.\-]+/g, "_");
  if (original && original.includes(".")) {
    return original;
  }
  return `imagem_${index + 1}.${extension || "bin"}`;
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
      const { buffer, extension, sanitizedFileName, mimeType } = await fetchAndDecryptFlowMedia(media);

      const finalFileName = buildOutputFileName(
        { ...media, file_name: sanitizedFileName },
        extension,
        index
      );

      const upload = await uploadBufferToR2(payload.r2, {
        protocolNumber,
        fieldName,
        fileName: finalFileName,
        buffer,
        contentType: guessContentType(path.extname(finalFileName).slice(1), mimeType)
      });

      uploadedFiles.push({
        fieldName,
        originalFileName: media.file_name,
        mediaId: media.media_id,
        key: upload.key,
        publicUrl: upload.publicUrl
      });
    }
  }

  return {
    protocolNumber,
    uploadedCount: uploadedFiles.length,
    uploadedFiles
  };
}
