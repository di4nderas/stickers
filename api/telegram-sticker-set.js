const { getTelegramConfig, sendJson, telegramRequest } = require('../lib/stickers');

function parseStickerSetName(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error('Pega el enlace público de un pack de stickers de Telegram.');
  }

  let name = value.trim();
  if (/^https?:\/\//i.test(name)) {
    let url;
    try {
      url = new URL(name);
    } catch (_) {
      throw new Error('El enlace del pack no es válido.');
    }
    if (url.protocol !== 'https:') {
      throw new Error('El enlace del pack debe usar HTTPS.');
    }
    if (!['t.me', 'www.t.me', 'telegram.me', 'www.telegram.me'].includes(url.hostname.toLowerCase())) {
      throw new Error('Usa un enlace público t.me/addstickers/...');
    }
    const match = url.pathname.match(/^\/addstickers\/([A-Za-z0-9_]+)\/?$/);
    if (!match) throw new Error('El enlace debe apuntar a un pack de stickers: t.me/addstickers/...');
    name = match[1];
  }

  if (!/^[A-Za-z0-9_]{1,64}$/.test(name)) {
    throw new Error('El nombre del pack contiene caracteres no válidos.');
  }
  return name;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Método no permitido.' });
  }

  let name;
  try {
    name = parseStickerSetName(req.query.url || req.query.name);
  } catch (error) {
    return sendJson(res, 400, { error: error.message });
  }

  try {
    const config = getTelegramConfig();
    const stickerSet = await telegramRequest(config, 'getStickerSet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    return sendJson(res, 200, {
      name: stickerSet.name,
      title: stickerSet.title,
      stickers: stickerSet.stickers.map((sticker, index) => ({
        id: `${index}`,
        fileId: sticker.file_id,
        thumbnailFileId: sticker.thumbnail?.file_id || sticker.file_id,
        format: sticker.is_video ? 'video' : sticker.is_animated ? 'animated' : 'static',
        emoji: sticker.emoji || ''
      }))
    });
  } catch (error) {
    console.error('No se pudo consultar el pack de Telegram:', error.message);
    return sendJson(res, 502, {
      error: error.message.includes('STICKERSET_INVALID')
        ? 'No encontramos ese pack. Comprueba que el enlace sea público y correcto.'
        : error.message || 'Telegram no pudo devolver ese pack.'
    });
  }
};

module.exports.config = {
  api: { bodyParser: false }
};
