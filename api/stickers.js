const { getConfig, sendJson, supabaseRequest } = require('../lib/stickers');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Método no permitido.' });
  }

  try {
    const config = getConfig();
    const limit = Math.min(60, Math.max(1, Number.parseInt(req.query.limit, 10) || 30));
    const offset = Math.min(10000, Math.max(0, Number.parseInt(req.query.offset, 10) || 0));
    const query = new URLSearchParams({
      select: 'id,filename,pack_title,author,is_animated,created_at',
      status: 'eq.approved',
      order: 'created_at.desc,id.desc',
      limit: String(limit),
      offset: String(offset)
    });
    const stickers = await supabaseRequest(config, `stickers?${query}`);
    return sendJson(res, 200, {
      stickers: stickers.map(sticker => ({
        ...sticker,
        imageUrl: `/api/sticker-image?id=${encodeURIComponent(sticker.id)}`
      })),
      hasMore: stickers.length === limit && offset + stickers.length < 10000,
      nextOffset: offset + stickers.length
    });
  } catch (error) {
    console.error('No se pudo consultar la galería:', error.message);
    return sendJson(res, 503, { error: error.message || 'No se pudo cargar la galería.' });
  }
};
