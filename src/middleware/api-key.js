export function extractApiKey(req) {
  return String(req.headers['x-api-key'] || '').trim();
}

export function requireApiKey(req, res, next) {
  const expectedKey = String(process.env.API_KEY || '').trim();

  if (!expectedKey) {
    return next();
  }

  const informedKey = extractApiKey(req);

  if (informedKey && informedKey === expectedKey) {
    return next();
  }

  return res.status(401).json({
    ok: false,
    error: 'unauthorized',
    message: 'x-api-key inválida ou ausente.'
  });
}
