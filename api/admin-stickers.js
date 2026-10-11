const {
  getConfig,
  readStickerCatalog,
  requireAdmin,
  requireBrowserOrigin,
  sendJson,
  updateStickerCatalog
} = require('../lib/stickers');

function getRequestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return {};
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: 'Método no permitido.' });
  }
  if (req.method === 'POST' && !requireBrowserOrigin(req, res)) return;
  if (!requireAdmin(req, res)) return;

  try {
    const config = getConfig();
    if (req.method === 'GET') {
      const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 60));
      const offset = Math.min(10000, Math.max(0, Number.parseInt(req.query.offset, 10) || 0));
      const { catalog } = await readStickerCatalog(config);
      const pending = catalog.stickers
        .filter(sticker => sticker.status === 'pending')
        .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
      const stickers = pending.slice(offset, offset + limit).map(sticker => ({
        id: sticker.id,
        filename: sticker.filename,
        pack_title: sticker.pack_title,
        author: sticker.author,
        is_animated: sticker.is_animated,
        created_at: sticker.created_at,
        imageUrl: `/api/sticker-image?id=${encodeURIComponent(sticker.id)}`
      }));
      const nextOffset = offset + stickers.length;
      return sendJson(res, 200, {
        stickers,
        total: pending.length,
        hasMore: nextOffset < pending.length,
        nextOffset
      });
    }

    const body = getRequestBody(req);
    if (!Array.isArray(body.ids) || body.ids.length < 1 || body.ids.length > 100) {
      return sendJson(res, 400, { error: 'Envía entre 1 y 100 stickers para aprobar.' });
    }
    if (body.ids.some(id => typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id))) {
      return sendJson(res, 400, { error: 'La selección contiene un identificador inválido.' });
    }
    const ids = Array.from(new Set(body.ids));
    if (ids.length !== body.ids.length) {
      return sendJson(res, 400, { error: 'La selección contiene identificadores repetidos.' });
    }

    let approvedCount = 0;
    await updateStickerCatalog(config, `Aprobar ${ids.length} stickers pendientes`, catalog => {
      approvedCount = 0;
      for (const sticker of catalog.stickers) {
        if (ids.includes(sticker.id) && sticker.status === 'pending') {
          sticker.status = 'approved';
          approvedCount++;
        }
      }
    });
    return sendJson(res, 200, { approved: approvedCount });
  } catch (error) {
    console.error('No se pudo administrar el historial de stickers:', error.message);
    return sendJson(res, 503, { error: error.message || 'No se pudo actualizar el historial.' });
  }
};

module.exports.config = {
  api: { bodyParser: { sizeLimit: '16kb' } }
};
