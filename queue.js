import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

export class FileJobQueue {
  constructor(options = {}) {
    this.baseDir = options.baseDir || path.resolve("data/jobs");
    this.pendingDir = path.join(this.baseDir, "pending");
    this.processingDir = path.join(this.baseDir, "processing");
    this.completedDir = path.join(this.baseDir, "completed");
    this.failedDir = path.join(this.baseDir, "failed");
    this.pollIntervalMs = Number(options.pollIntervalMs || 1500);
    this.concurrency = Number(options.concurrency || 4);
    this.maxAttempts = Number(options.maxAttempts || 5);
    this.handler = options.handler;
    this.running = false;
    this.activeCount = 0;
  }

  async init() {
    await Promise.all([
      ensureDir(this.pendingDir),
      ensureDir(this.processingDir),
      ensureDir(this.completedDir),
      ensureDir(this.failedDir)
    ]);
  }

  async enqueue(payload) {
    const id = crypto.randomUUID();
    const job = {
      id,
      status: "pending",
      attempts: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      payload
    };

    const filePath = path.join(this.pendingDir, `${id}.json`);
    await writeJson(filePath, job);
    return job;
  }

  async start() {
    if (this.running) return;
    this.running = true;

    while (this.running) {
      try {
        await this.#tick();
      } catch (error) {
        console.error("Erro no loop da fila:", error);
      }
      await sleep(this.pollIntervalMs);
    }
  }

  stop() {
    this.running = false;
  }

  async #tick() {
    while (this.activeCount < this.concurrency) {
      const next = await this.#claimNextJob();
      if (!next) break;
      this.activeCount += 1;
      this.#processJob(next)
        .catch((error) => {
          console.error("Erro processando job:", error);
        })
        .finally(() => {
          this.activeCount -= 1;
        });
    }
  }

  async #claimNextJob() {
    const files = (await fs.readdir(this.pendingDir))
      .filter((file) => file.endsWith(".json"))
      .sort();

    for (const file of files) {
      const from = path.join(this.pendingDir, file);
      const to = path.join(this.processingDir, file);
      try {
        await fs.rename(from, to);
        return to;
      } catch {
        // outro worker pegou
      }
    }

    return null;
  }

  async #processJob(filePath) {
    const job = await readJson(filePath);
    job.status = "processing";
    job.attempts += 1;
    job.updatedAt = new Date().toISOString();
    await writeJson(filePath, job);

    try {
      if (typeof this.handler !== "function") {
        throw new Error("Handler da fila não configurado");
      }

      const result = await this.handler(job.payload, job);

      job.status = "completed";
      job.result = result;
      job.updatedAt = new Date().toISOString();

      const targetPath = path.join(this.completedDir, path.basename(filePath));
      await writeJson(filePath, job);
      await fs.rename(filePath, targetPath);
    } catch (error) {
      job.status = "failed";
      job.lastError = {
        message: error.message,
        stack: error.stack
      };
      job.updatedAt = new Date().toISOString();

      if (job.attempts < this.maxAttempts) {
        const retryPath = path.join(this.pendingDir, path.basename(filePath));
        await writeJson(filePath, job);
        await fs.rename(filePath, retryPath);
        return;
      }

      const failedPath = path.join(this.failedDir, path.basename(filePath));
      await writeJson(filePath, job);
      await fs.rename(filePath, failedPath);
    }
  }
}
