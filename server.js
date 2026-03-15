
import express from "express";
import fs from "fs";
import dotenv from "dotenv";
import { decryptRequest, encryptResponse } from "./encryption.js";

dotenv.config();

const app = express();
app.use(express.json({ limit: "15mb" }));

const PRIVATE_KEY = process.env.PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!PRIVATE_KEY) {
  throw new Error("PRIVATE_KEY não definida nas variáveis de ambiente");
}

const PORT = process.env.PORT || 3000;

app.post("/whatsapp/flows", async (req, res) => {
  try {
    const encryptedBody = req.body;

    const { decryptedBody, aesKeyBuffer, initialVectorBuffer } =
      decryptRequest(encryptedBody, PRIVATE_KEY);

    const { action, version, screen, data, flow_token } = decryptedBody;

    if (action === "ping") {
      const responsePayload = {
        version: version || "3.0",
        data: { status: "active" }
      };

      const encryptedResponse = encryptResponse(
        responsePayload,
        aesKeyBuffer,
        initialVectorBuffer
      );

      return res.status(200).json(encryptedResponse);
    }

    if (action === "INIT") {
      const responsePayload = {
        screen: "FORM_MAIN",
        data: {}
      };

      const encryptedResponse = encryptResponse(
        responsePayload,
        aesKeyBuffer,
        initialVectorBuffer
      );

      return res.status(200).json(encryptedResponse);
    }

    if (action === "data_exchange") {
      console.log("Flow token:", flow_token);
      console.log("Screen:", screen);
      console.log("Payload recebido:", JSON.stringify(data, null, 2));

      const responsePayload = {
        screen: "SUCCESS",
        data: { received: true }
      };

      const encryptedResponse = encryptResponse(
        responsePayload,
        aesKeyBuffer,
        initialVectorBuffer
      );

      return res.status(200).json(encryptedResponse);
    }

    const fallbackPayload = {
      version: version || "3.0",
      data: { status: "active" }
    };

    const encryptedResponse = encryptResponse(
      fallbackPayload,
      aesKeyBuffer,
      initialVectorBuffer
    );

    return res.status(200).send(encryptedResponse);
  } catch (err) {
    console.error("Erro endpoint flow:", err);
    res.status(500).send("internal_error");
  }
});

app.listen(PORT, () => {
  console.log(`Flow endpoint rodando na porta ${PORT}`);
});
