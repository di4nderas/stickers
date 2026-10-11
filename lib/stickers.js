const crypto = require('node:crypto');

function getTelegramConfig() {
  const { TELEGRAM_BOT_TOKEN } = process.env;
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error('Falta configurar TELEGRAM_BOT_TOKEN en las variables de entorno de Vercel.');
  }
  return { telegramToken: TELEGRAM_BOT_TOKEN };
}

function getConfig() {
  const {
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID,
    GITHUB_TOKEN,
    GITHUB_OWNER,
    GITHUB_REPO,
    GITHUB_BRANCH = 'main',
    GITHUB_CATALOG_PATH = 'stickers.json'
  } = process.env;
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID || !GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
    throw new Error('Falta configurar Telegram o el catálogo GitHub en las variables de entorno de Vercel.');
  }
  return {
    telegramToken: TELEGRAM_BOT_TOKEN,
    telegramChatId: TELEGRAM_CHAT_ID,
    githubToken: GITHUB_TOKEN,
    githubOwner: GITHUB_OWNER,
    githubRepo: GITHUB_REPO,
    githubBranch: GITHUB_BRANCH,
    githubCatalogPath: GITHUB_CATALOG_PATH
  };
}

function sendJson(res, status, body) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

function getAdminPassword() {
  const password = process.env.STICKER_ADMIN_PASSWORD || '';
  if (password.length < 16) {
    throw new Error('Configura STICKER_ADMIN_PASSWORD con al menos 16 caracteres en Vercel.');
  }
  return password;
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function getCookie(req, name) {
  const cookies = String(req.headers.cookie || '').split(';');
  const prefix = `${name}=`;
  const cookie = cookies.find(value => value.trim().startsWith(prefix));
  return cookie ? cookie.trim().slice(prefix.length) : '';
}

function adminSessionSignature(payload, password) {
  return crypto.createHmac('sha256', password).update(`sticker-admin:${payload}`).digest('base64url');
}

function createAdminSession(password) {
  const expiresAt = Date.now() + 8 * 60 * 60 * 1000;
  const payload = `${expiresAt}.${crypto.randomBytes(16).toString('hex')}`;
  return `${payload}.${adminSessionSignature(payload, password)}`;
}

function isAdminAuthenticated(req) {
  const password = getAdminPassword();
  const token = getCookie(req, 'sticker_admin');
  const parts = token.split('.');
  if (parts.length !== 3 || !/^\d+$/.test(parts[0]) || !/^[0-9a-f]{32}$/.test(parts[1])) return false;
  const expiresAt = Number(parts[0]);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return false;
  const payload = `${parts[0]}.${parts[1]}`;
  return safeEqual(parts[2], adminSessionSignature(payload, password));
}

function setAdminSessionCookie(res, token, maxAge = 8 * 60 * 60) {
  res.setHeader(
    'Set-Cookie',
    `sticker_admin=${encodeURIComponent(token)}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`
  );
}

function requireAdmin(req, res) {
  try {
    if (isAdminAuthenticated(req)) return true;
  } catch (error) {
    console.error('No está configurado el acceso de administración:', error.message);
    sendJson(res, 503, { error: error.message });
    return false;
  }
  sendJson(res, 401, { error: 'Inicia sesión para administrar los stickers.' });
  return false;
}

function requireBrowserOrigin(req, res) {
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (!origin || !host) {
    sendJson(res, 403, { error: 'La solicitud de administración requiere un origen válido.' });
    return false;
  }
  try {
    if (new URL(origin).host.toLowerCase() === host.toLowerCase()) return true;
  } catch (_) {
    // Reject malformed Origin headers below.
  }
  sendJson(res, 403, { error: 'Origen de solicitud no permitido.' });
  return false;
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

function catalogUrl(config) {
  const path = config.githubCatalogPath.split('/').map(encodeURIComponent).join('/');
  return `https://api.github.com/repos/${encodeURIComponent(config.githubOwner)}/${encodeURIComponent(config.githubRepo)}/contents/${path}`;
}

async function githubRequest(config, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${config.githubToken}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_) {
      throw new Error('GitHub devolvió una respuesta que no es JSON.');
    }
  }
  return { response, data };
}

async function readStickerCatalog(config) {
  const url = `${catalogUrl(config)}?ref=${encodeURIComponent(config.githubBranch)}`;
  const { response, data } = await githubRequest(config, url);
  if (response.status === 404) {
    return { sha: null, catalog: { version: 1, stickers: [], uploadLimits: [] } };
  }
  if (!response.ok) {
    throw new Error((data && data.message) || `Error al leer el catálogo GitHub (${response.status}).`);
  }
  if (!data || data.type !== 'file' || data.encoding !== 'base64' || !data.content) {
    throw new Error('GitHub no devolvió el contenido del catálogo en base64.');
  }

  let catalog;
  try {
    catalog = JSON.parse(Buffer.from(data.content.replace(/\s/g, ''), 'base64').toString('utf8'));
  } catch (_) {
    throw new Error('El archivo del catálogo no contiene JSON válido.');
  }
  if (!catalog || !Array.isArray(catalog.stickers)) {
    throw new Error('El catálogo debe contener una lista stickers válida.');
  }
  if (!Array.isArray(catalog.uploadLimits)) catalog.uploadLimits = [];
  return { sha: data.sha, catalog };
}

async function updateStickerCatalog(config, commitMessage, update) {
  const url = catalogUrl(config);
  for (let attempt = 0; attempt < 5; attempt++) {
    const { sha, catalog } = await readStickerCatalog(config);
    update(catalog);
    const payload = {
      message: commitMessage,
      content: Buffer.from(JSON.stringify(catalog, null, 2)).toString('base64'),
      branch: config.githubBranch
    };
    if (sha) payload.sha = sha;

    const { response, data } = await githubRequest(config, url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (response.ok) return catalog;
    if (response.status !== 409 || attempt === 4) {
      throw new Error((data && data.message) || `Error al actualizar el catálogo GitHub (${response.status}).`);
    }
    await new Promise(resolve => setTimeout(resolve, 150 * (attempt + 1)));
  }
  throw new Error('No se pudo actualizar el catálogo después de varios conflictos.');
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
  requireBrowserOrigin,
  getAdminPassword,
  safeEqual,
  createAdminSession,
  setAdminSessionCookie,
  isAdminAuthenticated,
  requireAdmin,
  sendJson,
  readStickerCatalog,
  updateStickerCatalog,
  telegramRequest
};
