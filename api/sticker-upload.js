const crypto = require('node:crypto');
const {
  getConfig,
  getIpHash,
  requireSameOrigin,
  sendJson,
  supabaseRequest,
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

  let rowId = null;
  let config;
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
    const rateLimit = await supabaseRequest(config, 'rpc/claim_sticker_upload', {
      method: 'POST',
      body: JSON.stringify({ p_ip_hash: getIpHash(req, config.supabaseKey), p_limit: 120, p_window_seconds: 3600 })
    });
    if (rateLimit !== true) {
      return sendJson(res, 429, { error: 'Se alcanzó el límite temporal de cargas. Inténtalo más tarde.' });
    }

    const filename = sanitizeName(body.filename, `sticker-${digest.slice(0, 12)}.webp`)
      .replace(/[\\/:*?"<>|]/g, '_');
    const insertRows = await supabaseRequest(config, 'stickers?on_conflict=content_sha256', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify({
        content_sha256: digest,
        filename,
        pack_title: sanitizeName(body.packTitle, 'Pack sin nombre'),
        author: sanitizeName(body.author, 'Anónimo'),
        is_animated: isAnimatedWebp(bytes),
        status: 'uploading'
      })
    });
    if (!insertRows.length) {
      return sendJson(res, 409, { error: 'Este sticker ya existe en el historial.' });
    }
    rowId = insertRows[0].id;

    const document = new FormData();
    document.append('chat_id', config.telegramChatId);
    document.append('document', new Blob([bytes], { type: 'image/webp' }), filename);
    document.append('caption', `Sticker pendiente de revisión\nPack: ${sanitizeName(body.packTitle, 'Pack sin nombre')}`);
    const telegramMessage = await telegramRequest(config, 'sendDocument', {
      method: 'POST',
      body: document
    });
    const fileId = telegramMessage.document && telegramMessage.document.file_id;
    if (!fileId) throw new Error('Telegram no devolvió el identificador del archivo.');

    await supabaseRequest(config, `stickers?id=eq.${rowId}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        telegram_file_id: fileId,
        telegram_message_id: telegramMessage.message_id,
        status: 'pending'
      })
    });

    return sendJson(res, 201, { id: rowId, status: 'pending' });
  } catch (error) {
    if (rowId && config) {
      try {
        await supabaseRequest(config, `stickers?id=eq.${rowId}`, { method: 'DELETE' });
      } catch (cleanupError) {
        console.error('No se pudo limpiar el registro de carga fallida:', cleanupError.message);
      }
    }
    console.error('No se pudo archivar el sticker:', error.message);
    const status = error.message && error.message.includes('claim_sticker_upload') ? 503 : 502;
    return sendJson(res, status, { error: error.message || 'No se pudo guardar el sticker.' });
  }
};

module.exports.config = {
  api: { bodyParser: { sizeLimit: '1mb' } }
};
