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
  sendJson,
  readStickerCatalog,
  updateStickerCatalog,
  telegramRequest
};
