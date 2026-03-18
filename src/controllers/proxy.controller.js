function normalizeAxiosError(error) {
  if (error?.response) {
    return {
      status: error.response.status,
      body: {
        ok: false,
        error: 'upstream_error',
        upstreamStatus: error.response.status,
        details: error.response.data || null
      }
    };
  }

  return {
    status: 500,
    body: {
      ok: false,
      error: 'internal_error',
      message: error?.message || 'Erro interno ao processar requisição.'
    }
  };
}

export function createProxyController({ proxyService }) {
  return {
    token: async (req, res) => {
      try {
        const forceRefresh = String(req.query.forceRefresh || '').toLowerCase() === 'true';
        const data = await proxyService.getToken({ forceRefresh });
        return res.status(200).json({ ok: true, data });
      } catch (error) {
        console.error('Erro ao obter token:', error.response?.data || error.message);
        const normalized = normalizeAxiosError(error);
        return res.status(normalized.status).json(normalized.body);
      }
    },

    schedule: async (req, res) => {
      try {
        const data = await proxyService.schedule(req.body || {});
        return res.status(200).json({ ok: true, data });
      } catch (error) {
        console.error('Erro ao agendar serviço:', error.response?.data || error.message);
        const normalized = normalizeAxiosError(error);
        return res.status(normalized.status).json(normalized.body);
      }
    },

    getAvailabilities: async (req, res) => {
      const postalCode = String(req.query.postalCode || req.query['postal-code'] || '').trim();
      const protocol = String(req.query.protocol || '').trim();

      if (!postalCode || !protocol) {
        return res.status(400).json({
          ok: false,
          error: 'validation_error',
          message: 'postalCode (ou postal-code) e protocol são obrigatórios.'
        });
      }

      try {
        const data = await proxyService.getAvailabilities({ postalCode, protocol });
        return res.status(200).json({ ok: true, data });
      } catch (error) {
        console.error('Erro ao consultar availabilities:', error.response?.data || error.message);
        const normalized = normalizeAxiosError(error);
        return res.status(normalized.status).json(normalized.body);
      }
    },

    updateTicketCustomer: async (req, res) => {
      const ticketId = String(req.params.ticketId || '').trim();

      if (!ticketId) {
        return res.status(400).json({
          ok: false,
          error: 'validation_error',
          message: 'ticketId é obrigatório.'
        });
      }

      try {
        const data = await proxyService.updateTicketCustomer(ticketId, req.body || {});
        return res.status(200).json({ ok: true, data });
      } catch (error) {
        console.error('Erro ao atualizar ticket customer:', error.response?.data || error.message);
        const normalized = normalizeAxiosError(error);
        return res.status(normalized.status).json(normalized.body);
      }
    },

    getTicketByDocument: async (req, res) => {
      const document = String(req.query.document || '').trim();

      if (!document) {
        return res.status(400).json({
          ok: false,
          error: 'validation_error',
          message: 'document (CPF) é obrigatório.'
        });
      }

      try {
        const data = await proxyService.getTicketByDocument({
          document,
          documentType: 'CPF'
        });
        return res.status(200).json({ ok: true, data });
      } catch (error) {
        console.error('Erro ao consultar ticket por documento:', error.response?.data || error.message);
        const normalized = normalizeAxiosError(error);
        return res.status(normalized.status).json(normalized.body);
      }
    },
}
  };

