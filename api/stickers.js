const { getConfig, readStickerCatalog, sendJson } = require('../lib/stickers');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Método no permitido.' });
  }

  try {
    const config = getConfig();
    const limit = Math.min(60, Math.max(1, Number.parseInt(req.query.limit, 10) || 30));
    const offset = Math.min(10000, Math.max(0, Number.parseInt(req.query.offset, 10) || 0));
    const { catalog } = await readStickerCatalog(config);
    const approved = catalog.stickers
      .filter(sticker => sticker.status === 'approved')
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
    const stickers = approved.slice(offset, offset + limit).map(sticker => ({
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
      hasMore: nextOffset < approved.length,
      nextOffset
    });
  } catch (error) {
    console.error('No se pudo consultar la galería:', error.message);
    return sendJson(res, 503, { error: error.message || 'No se pudo cargar la galería.' });
  }
};
