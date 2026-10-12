const { getTelegramConfig, sendJson, telegramRequest } = require('../lib/stickers');

const MAX_STICKER_BYTES = 10 * 1024 * 1024;

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Método no permitido.' });
  }

  const fileId = typeof req.query.fileId === 'string' ? req.query.fileId : '';
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(fileId)) {
    return sendJson(res, 400, { error: 'Identificador de archivo Telegram inválido.' });
  }

  try {
    const config = getTelegramConfig();
    const file = await telegramRequest(config, 'getFile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: fileId })
    });
    if (file.file_size > MAX_STICKER_BYTES) {
      return sendJson(res, 413, { error: 'El archivo del sticker supera el límite de descarga.' });
    }

    const telegramResponse = await fetch(
      `https://api.telegram.org/file/bot${config.telegramToken}/${file.file_path}`
    );
    if (!telegramResponse.ok) {
      throw new Error(`No se pudo descargar el archivo desde Telegram (${telegramResponse.status}).`);
    }
    const bytes = Buffer.from(await telegramResponse.arrayBuffer());
    if (bytes.length > MAX_STICKER_BYTES) {
      return sendJson(res, 413, { error: 'El archivo del sticker supera el límite de descarga.' });
    }

    const extension = file.file_path.split('.').pop().toLowerCase();
    const contentType = extension === 'webp'
      ? 'image/webp'
      : extension === 'jpg' || extension === 'jpeg'
        ? 'image/jpeg'
        : extension === 'png'
          ? 'image/png'
      : extension === 'webm'
        ? 'video/webm'
        : extension === 'tgs'
          ? 'application/gzip'
          : 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Content-Length', String(bytes.length));
    return res.status(200).send(bytes);
  } catch (error) {
    console.error('No se pudo recuperar un archivo de Telegram:', error.message);
    return sendJson(res, 502, { error: error.message || 'No se pudo descargar el sticker.' });
  }
};

module.exports.config = {
  api: { bodyParser: false }
};
