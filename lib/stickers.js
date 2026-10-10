const crypto = require('node:crypto');

function getTelegramConfig() {
  const { TELEGRAM_BOT_TOKEN } = process.env;
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('Falta configurar TELEGRAM_BOT_TOKEN en las variables de entorno de Vercel.');
  }
  return { telegramToken: TELEGRAM_BOT_TOKEN };
}

function getConfig() {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    throw new Error('Falta configurar Supabase o Telegram en las variables de entorno de Vercel.');
  }
  return {
    supabaseUrl: SUPABASE_URL.replace(/\/+$/, ''),
    supabaseKey: SUPABASE_SERVICE_ROLE_KEY,
    telegramToken: TELEGRAM_BOT_TOKEN,
    telegramChatId: TELEGRAM_CHAT_ID
  };
}

function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

function requireSameOrigin(req, res) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host) return true;
  try {
    if (new URL(origin).host.toLowerCase() === host.toLowerCase()) return true;
  } catch (_) {
    // Reject malformed Origin headers below.
  }
  sendJson(res, 403, { error: 'Origen de solicitud no permitido.' });
  return false;
}

function getIpHash(req, secret) {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded || '').split(',')[0].trim();
  return crypto.createHash('sha256').update(`${secret}:${ip || 'unknown'}`).digest('hex');
}

async function supabaseRequest(config, path, options = {}) {
  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.supabaseKey,
      Authorization: `Bearer ${config.supabaseKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_) {
      throw new Error('Supabase devolvió una respuesta que no es JSON.');
    }
  }
  if (!response.ok) {
    const detail = data && (data.message || data.details || data.hint);
    throw new Error(detail || `Error de Supabase (${response.status}).`);
  }
  return data;
}

async function telegramRequest(config, method, options = {}) {
  const response = await fetch(`https://api.telegram.org/bot${config.telegramToken}/${method}`, options);
  const data = await response.json();
  if (!response.ok || !data.ok) {
    throw new Error(data.description || `Telegram devolvió un error (${response.status}).`);
  }
  return data.result;
}

module.exports = {
  getConfig,
  getTelegramConfig,
  getIpHash,
  requireSameOrigin,
  sendJson,
  supabaseRequest,
  telegramRequest
};
