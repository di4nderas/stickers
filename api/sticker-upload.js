const crypto = require('node:crypto');
const {
  getConfig,
  getIpHash,
  requireSameOrigin,
  sendJson,
  updateStickerCatalog,
  telegramRequest
} = require('../lib/stickers');

const MAX_BYTES = 490 * 1024;

function getRequestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return {};
}

function sanitizeName(value, fallback) {
  const name = typeof value === 'string' ? value.trim() : '';
  return (name || fallback).replace(/[\r\n]/g, ' ').slice(0, 120);
}

function uploadError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function isAnimatedWebp(bytes) {
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunk = bytes.toString('ascii', offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    if (chunk === 'ANIM' || chunk === 'ANMF') return true;
    const next = offset + 8 + size + (size & 1);
    if (next > bytes.length) return false;
    offset = next;
  }
  return false;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { error: 'Método no permitido.' });
  }
  if (!requireSameOrigin(req, res)) return;

  let stickerId = null;
  let config;
  let reservationCreated = false;
  let telegramStored = false;
  try {
    config = getConfig();
    const body = getRequestBody(req);
    if (typeof body.image !== 'string' || body.image.length > Math.ceil(MAX_BYTES * 4 / 3) + 8) {
      return sendJson(res, 413, { error: 'El sticker supera el límite permitido.' });
    }

    const bytes = Buffer.from(body.image, 'base64');
    if (!bytes.length || bytes.length > MAX_BYTES) {
      return sendJson(res, 413, { error: 'El sticker debe pesar como máximo 490 KB.' });
    }
    if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') {
      return sendJson(res, 415, { error: 'Solo se admiten stickers WebP.' });
    }

    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    stickerId = crypto.randomUUID();
    const filename = sanitizeName(body.filename, `sticker-${digest.slice(0, 12)}.webp`)
      .replace(/[\\/:*?"<>|]/g, '_');
    const packTitle = sanitizeName(body.packTitle, 'Pack sin nombre');
    const author = sanitizeName(body.author, 'Anónimo');
    const createdAt = new Date().toISOString();
    const ipHash = getIpHash(req, config.githubToken);

    await updateStickerCatalog(config, `Registrar sticker pendiente ${stickerId}`, catalog => {
      reservationCreated = false;
      if (catalog.stickers.some(sticker => sticker.content_sha256 === digest)) {
        throw uploadError('DUPLICATE', 'Este sticker ya existe en el historial.');
      }

      const now = Date.now();
      catalog.uploadLimits = catalog.uploadLimits.filter(limit =>
        now - Date.parse(limit.window_started_at) < 24 * 60 * 60 * 1000
      );
      let limit = catalog.uploadLimits.find(item => item.ip_hash === ipHash);
      if (!limit || now - Date.parse(limit.window_started_at) >= 60 * 60 * 1000) {
        limit = { ip_hash: ipHash, window_started_at: createdAt, request_count: 0 };
        catalog.uploadLimits = catalog.uploadLimits.filter(item => item.ip_hash !== ipHash);
        catalog.uploadLimits.push(limit);
      }
      if (limit.request_count >= 120) {
        throw uploadError('RATE_LIMIT', 'Se alcanzó el límite temporal de cargas. Inténtalo más tarde.');
      }
      limit.request_count++;

      catalog.stickers.push({
        id: stickerId,
        content_sha256: digest,
        telegram_file_id: null,
        telegram_message_id: null,
        filename,
        pack_title: packTitle,
        author,
        is_animated: isAnimatedWebp(bytes),
        status: 'uploading',
        created_at: createdAt
      });
      reservationCreated = true;
    });

    const document = new FormData();
    document.append('chat_id', config.telegramChatId);
    document.append('document', new Blob([bytes], { type: 'image/webp' }), filename);
    document.append('caption', `Sticker pendiente de revisión\nPack: ${packTitle}`);
    const telegramMessage = await telegramRequest(config, 'sendDocument', {
      method: 'POST',
      body: document
    });
    const fileId = telegramMessage.document?.file_id || telegramMessage.sticker?.file_id;
    if (!fileId) throw new Error('Telegram no devolvió el identificador del archivo.');
    telegramStored = true;

    await updateStickerCatalog(config, `Guardar archivo Telegram del sticker ${stickerId}`, catalog => {
      const sticker = catalog.stickers.find(item => item.id === stickerId);
      if (!sticker) throw new Error('El sticker reservado no aparece en el catálogo.');
      sticker.telegram_file_id = fileId;
      sticker.telegram_message_id = telegramMessage.message_id;
      sticker.status = 'pending';
    });

    return sendJson(res, 201, { id: stickerId, status: 'pending' });
  } catch (error) {
    if (stickerId && config && reservationCreated && !telegramStored) {
      try {
        await updateStickerCatalog(config, `Quitar carga fallida ${stickerId}`, catalog => {
          catalog.stickers = catalog.stickers.filter(sticker => sticker.id !== stickerId);
        });
      } catch (cleanupError) {
        console.error('No se pudo limpiar el registro de carga fallida:', cleanupError.message);
      }
    }
    console.error('No se pudo archivar el sticker:', error.message);
    const status = error.code === 'DUPLICATE' ? 409 : error.code === 'RATE_LIMIT' ? 429 : 502;
    return sendJson(res, status, { error: error.message || 'No se pudo guardar el sticker.' });
  }
};

module.exports.config = {
  api: { bodyParser: { sizeLimit: '1mb' } }
};
