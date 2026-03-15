import express from "express";
import dotenv from "dotenv";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { decryptRequest, encryptResponse } from "./encryption.js";
import { FileJobQueue } from "./queue.js";
import { createR2ClientFromEnv } from "./r2.js";
import { processFlowUploadJob } from "./worker.js";

dotenv.config();

const app = express();
app.use(express.json({ limit: "15mb" }));

function loadPrivateKey() {
  if (process.env.PRIVATE_KEY_BASE64) {
    return Buffer.from(process.env.PRIVATE_KEY_BASE64, "base64").toString("utf8");
  }
  return process.env.PRIVATE_KEY?.replace(/\\n/g, "\n");
}

const PRIVATE_KEY = loadPrivateKey();
if (!PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY ou PRIVATE_KEY_BASE64 não definida nas variáveis de ambiente");
}
crypto.createPrivateKey({ key: PRIVATE_KEY, format: "pem" });

const PORT = Number(process.env.PORT || 3005);
const r2 = createR2ClientFromEnv(process.env);
const JOBS_BASE_DIR = path.resolve("data/jobs");

const queue = new FileJobQueue({
  baseDir: JOBS_BASE_DIR,
  pollIntervalMs: Number(process.env.JOB_POLL_INTERVAL_MS || 1500),
  concurrency: Number(process.env.JOB_CONCURRENCY || 4),
  maxAttempts: Number(process.env.JOB_MAX_ATTEMPTS || 5),
  handler: async (payload, job) => processFlowUploadJob({ ...payload, r2 }, job)
});

await queue.init();
queue.start().catch((error) => {
  console.error("Fila encerrada com erro:", error);
  process.exit(1);
});

async function findJobByProtocol(protocolNumber) {
  const folders = ["pending", "processing", "completed", "failed"];
  for (const folder of folders) {
    const dir = path.join(JOBS_BASE_DIR, folder);
    let files = [];
    try { files = await fs.readdir(dir); } catch { continue; }
    for (const file of files.filter((f) => f.endsWith('.json')).sort().reverse()) {
      const filePath = path.join(dir, file);
      const raw = await fs.readFile(filePath, 'utf8');
      const job = JSON.parse(raw);
      if (String(job?.payload?.protocolNumber || '') === String(protocolNumber)) {
        return { folder, job };
      }
    }
  }
  return null;
}

function buildFinalResponse(flow_token, data) {
  return {
    screen: "FINISH",
    data: {
      extension_message_response: {
        params: {
          flow_token,
          protocolo: data?.protocolo || "",
          nome: data?.nome || "",
          descricao: data?.descricao || "",
          upload_status: "queued"
        }
      }
    }
  };
}

app.post("/whatsapp/flows", async (req, res) => {
  try {
    const { decryptedBody, aesKeyBuffer, initialVectorBuffer } = decryptRequest(req.body, PRIVATE_KEY);
    const { action, version, screen, data, flow_token } = decryptedBody;

    if (action === "ping") {
      const encryptedResponse = encryptResponse({ version: version || "3.0", data: { status: "active" } }, aesKeyBuffer, initialVectorBuffer);
      return res.status(200).type("text/plain").send(encryptedResponse);
    }

    if (action === "INIT") {
      const encryptedResponse = encryptResponse({
        screen: "FORM_MAIN",
        data: { protocolo: data?.protocolo || "" }
      }, aesKeyBuffer, initialVectorBuffer);
      return res.status(200).type("text/plain").send(encryptedResponse);
    }

    if (action === "data_exchange") {
      console.log("Flow token:", flow_token);
      console.log("Screen:", screen);
      console.log("Payload recebido:", JSON.stringify(data, null, 2));

      const protocolNumber = String(data?.protocolo || "").trim();
      if (!protocolNumber) {
        throw new Error("protocolo não informado no Flow");
      }

      const job = await queue.enqueue({
        protocolNumber,
        flowToken: flow_token,
        data
      });

      console.log(`Job enfileirado: ${job.id} para protocolo ${protocolNumber}`);

      const encryptedResponse = encryptResponse(
        buildFinalResponse(flow_token, data),
        aesKeyBuffer,
        initialVectorBuffer
      );
      return res.status(200).type("text/plain").send(encryptedResponse);
    }

    const encryptedResponse = encryptResponse({ version: version || "3.0", data: { status: "active" } }, aesKeyBuffer, initialVectorBuffer);
    return res.status(200).type("text/plain").send(encryptedResponse);
  } catch (err) {
    console.error("Erro endpoint flow:", err);
    return res.status(500).send("internal_error");
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/status/:protocolNumber", async (req, res) => {
  const protocolNumber = String(req.params.protocolNumber || "").trim();
  if (!protocolNumber) {
    return res.status(400).json({ ok: false, error: "protocolNumber é obrigatório" });
  }

  const result = await findJobByProtocol(protocolNumber);
  if (!result) {
    return res.status(404).json({ ok: false, error: "protocolo não encontrado" });
  }

  const { folder, job } = result;
  return res.json({
    ok: true,
    protocolNumber,
    queueFolder: folder,
    jobId: job.id,
    status: job.status,
    attempts: job.attempts,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    lastError: job.lastError || null,
    uploadedCount: job.result?.uploadedCount || 0,
    uploadedFiles: job.result?.uploadedFiles || []
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Flow endpoint rodando na porta ${PORT}`);
});
