import { getJobStatusById, getJobStatusByProtocol } from '../services/job.service.js';

export function createStatusController({ flowQueue, bullBoardBasePath }) {
  return {
    health: async (_req, res) => {
      const counts = await flowQueue.getJobCounts('waiting', 'active', 'completed', 'failed', 'delayed', 'paused');
      res.json({ ok: true, queue: counts, bullBoard: bullBoardBasePath });
    },

    getProtocolStatus: async (req, res) => {
      const protocolo = String(req.params.protocolNumber || '').trim();
      if (!protocolo) {
        return res.status(400).json({ ok: false, error: 'protocolNumber é obrigatório' });
      }

      const status = await getJobStatusByProtocol(flowQueue, protocolo);
      if (!status) {
        return res.status(404).json({ ok: false, error: 'protocolo não encontrado' });
      }

      return res.json(status);
    },

    getJobStatus: async (req, res) => {
      const status = await getJobStatusById(flowQueue, req.params.jobId);
      if (!status) {
        return res.status(404).json({ ok: false, error: 'job não encontrado' });
      }

      return res.json(status);
    }
  };
}
