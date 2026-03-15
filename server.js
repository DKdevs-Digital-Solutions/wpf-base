import express from "express";
import dotenv from "dotenv";
import crypto from "crypto";
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

crypto.createPrivateKey({
  key: PRIVATE_KEY,
  format: "pem"
});

const PORT = Number(process.env.PORT || 3005);
const r2 = createR2ClientFromEnv(process.env);

const queue = new FileJobQueue({
  baseDir: path.resolve("data/jobs"),
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

function successResponse(aesKeyBuffer, initialVectorBuffer, protocolNumber) {
  const responsePayload = {
    screen: "SUCCESS",
    data: {
      received: true,
      protocolo: protocolNumber || ""
    }
  };

  return encryptResponse(responsePayload, aesKeyBuffer, initialVectorBuffer);
}

app.post("/whatsapp/flows", async (req, res) => {
  try {
    const { decryptedBody, aesKeyBuffer, initialVectorBuffer } =
      decryptRequest(req.body, PRIVATE_KEY);

    const { action, version, screen, data, flow_token } = decryptedBody;

    if (action === "ping") {
      const responsePayload = {
        version: version || "3.0",
        data: {
          status: "active",
        },
      };

      const encryptedResponse = encryptResponse(
        responsePayload,
        aesKeyBuffer,
        initialVectorBuffer
      );

      return res.status(200).type("text/plain").send(encryptedResponse);
    }

    if (action === "INIT") {
      const responsePayload = {
        screen: "FORM_MAIN",
        data: {
          protocolo: data?.protocolo || "",
        },
      };

      const encryptedResponse = encryptResponse(
        responsePayload,
        aesKeyBuffer,
        initialVectorBuffer
      );

      return res.status(200).type("text/plain").send(encryptedResponse);
    }

    if (action === "data_exchange") {
      console.log("Flow token:", flow_token);
      console.log("Screen:", screen);
      console.log("Payload recebido:", JSON.stringify(data, null, 2));

      // Aqui entra sua lógica:
      // - salvar no banco
      // - criar job
      // - enviar imagem para bucket
      // - usar data.protocolo como pasta

      const responsePayload = {
        screen: "FINISH",
        data: {
          extension_message_response: {
            params: {
              flow_token,
              protocolo: data?.protocolo || "",
              nome: data?.nome || "",
              descricao: data?.descricao || ""
            }
          }
        }
      };

      console.log("Response payload:", JSON.stringify(responsePayload, null, 2));

      const encryptedResponse = encryptResponse(
        responsePayload,
        aesKeyBuffer,
        initialVectorBuffer
      );

      return res.status(200).type("text/plain").send(encryptedResponse);
    }

    const fallbackPayload = {
      version: version || "3.0",
      data: {
        status: "active",
      },
    };

    const encryptedResponse = encryptResponse(
      fallbackPayload,
      aesKeyBuffer,
      initialVectorBuffer
    );

    return res.status(200).type("text/plain").send(encryptedResponse);
  } catch (err) {
    console.error("Erro endpoint flow:", err);
    return res.status(500).send("internal_error");
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Flow endpoint rodando na porta ${PORT}`);
});
