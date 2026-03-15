export async function enqueueFlowJob(flowQueue, payload, env = process.env) {
  return flowQueue.add('processar-cadastro', payload, {
    attempts: Number(env.JOB_MAX_ATTEMPTS || 5),
    backoff: {
      type: env.JOB_BACKOFF_TYPE || 'exponential',
      delay: Number(env.JOB_BACKOFF_DELAY_MS || 5000)
    },
    removeOnComplete: false,
    removeOnFail: false
  });
}

export async function getJobStatusByProtocol(flowQueue, protocolo) {
  const jobs = await flowQueue.getJobs(['waiting', 'active', 'completed', 'failed', 'delayed'], 0, 200, false);
  const job = jobs.find((item) => String(item.data?.protocolo || '') === protocolo);

  if (!job) {
    return null;
  }

  return {
    ok: true,
    protocolo,
    jobId: job.id,
    status: await job.getState(),
    attemptsMade: job.attemptsMade,
    timestamp: job.timestamp,
    processedOn: job.processedOn || null,
    finishedOn: job.finishedOn || null,
    failedReason: job.failedReason || null,
    result: job.returnvalue || null
  };
}

export async function getJobStatusById(flowQueue, jobId) {
  const job = await flowQueue.getJob(String(jobId || ''));

  if (!job) {
    return null;
  }

  return {
    ok: true,
    jobId: job.id,
    protocolo: job.data?.protocolo || null,
    status: await job.getState(),
    attemptsMade: job.attemptsMade,
    failedReason: job.failedReason || null,
    result: job.returnvalue || null
  };
}
