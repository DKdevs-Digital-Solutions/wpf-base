import express from "express";
import dotenv from "dotenv";
import crypto from "crypto";
import { decryptRequest, encryptResponse } from "./encryption.js";
import { createFlowQueue, createFlowQueueEvents } from "./bullmq.js";
import { handleFlowStep } from "./flow-service.js";

dotenv.config();

const app = express();
app.use(express.json({ limit: "20mb" }));

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
const flowQueue = createFlowQueue(process.env);
const queueEvents = createFlowQueueEvents(process.env);

queueEvents.on("completed", ({ jobId }) => {
  console.log(`[BullMQ] evento completed para job ${jobId}`);
});

queueEvents.on("failed", ({ jobId, failedReason }) => {
  console.error(`[BullMQ] evento failed para job ${jobId}: ${failedReason}`);
});

async function enqueueJob(payload) {
  return flowQueue.add("processar-cadastro", payload, {
    attempts: Number(process.env.JOB_MAX_ATTEMPTS || 5),
    backoff: {
      type: process.env.JOB_BACKOFF_TYPE || "exponential",
      delay: Number(process.env.JOB_BACKOFF_DELAY_MS || 5000)
    },
    removeOnComplete: false,
    removeOnFail: false
  });
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
      const responsePayload = await handleFlowStep({
        screen: "INIT",
        data,
        flowToken: flow_token,
        enqueueJob
      });
      const encryptedResponse = encryptResponse(responsePayload, aesKeyBuffer, initialVectorBuffer);
      return res.status(200).type("text/plain").send(encryptedResponse);
    }

    if (action === "data_exchange") {
      console.log("Flow token:", flow_token);
      console.log("Screen:", screen);
      console.log("Payload recebido:", JSON.stringify(data, null, 2));

      const responsePayload = await handleFlowStep({
        screen,
        data,
        flowToken: flow_token,
        enqueueJob
      });

      const encryptedResponse = encryptResponse(responsePayload, aesKeyBuffer, initialVectorBuffer);
      return res.status(200).type("text/plain").send(encryptedResponse);
    }

    const encryptedResponse = encryptResponse({ version: version || "3.0", data: { status: "active" } }, aesKeyBuffer, initialVectorBuffer);
    return res.status(200).type("text/plain").send(encryptedResponse);
  } catch (error) {
    console.error("Erro endpoint flow:", error);
    return res.status(500).send("internal_error");
  }
});

app.get("/health", async (_req, res) => {
  const counts = await flowQueue.getJobCounts("waiting", "active", "completed", "failed", "delayed", "paused");
  res.json({ ok: true, queue: counts });
});

app.get("/status/:protocolNumber", async (req, res) => {
  const protocolo = String(req.params.protocolNumber || "").trim();
  if (!protocolo) {
    return res.status(400).json({ ok: false, error: "protocolNumber é obrigatório" });
  }

  const jobs = await flowQueue.getJobs(["waiting", "active", "completed", "failed", "delayed"], 0, 200, false);
  const job = jobs.find((item) => String(item.data?.protocolo || "") === protocolo);

  if (!job) {
    return res.status(404).json({ ok: false, error: "protocolo não encontrado" });
  }

  const state = await job.getState();
  const returnValue = job.returnvalue || null;
  const failedReason = job.failedReason || null;

  return res.json({
    ok: true,
    protocolo,
    jobId: job.id,
    status: state,
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
    processedOn: job.processedOn || null,
    finishedOn: job.finishedOn || null,
    failedReason,
    result: returnValue
  });
});

app.get("/status/job/:jobId", async (req, res) => {
  const job = await flowQueue.getJob(String(req.params.jobId || ""));
  if (!job) {
    return res.status(404).json({ ok: false, error: "job não encontrado" });
  }

  return res.json({
    ok: true,
    jobId: job.id,
    protocolo: job.data?.protocolo || null,
    status: await job.getState(),
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason || null,
    result: job.returnvalue || null
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Flow endpoint rodando na porta ${PORT}`);
});
