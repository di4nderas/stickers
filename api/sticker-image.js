const { getConfig, sendJson, supabaseRequest, telegramRequest } = require('../lib/stickers');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Método no permitido.' });
  }

  const id = typeof req.query.id === 'string' ? req.query.id : '';
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return sendJson(res, 400, { error: 'Identificador de sticker inválido.' });
  }

  try {
    const config = getConfig();
    const rows = await supabaseRequest(
      config,
      `stickers?${new URLSearchParams({
        select: 'telegram_file_id,filename',
        id: `eq.${id}`,
        status: 'eq.approved',
        limit: '1'
      })}`
    );
    if (!rows.length) return sendJson(res, 404, { error: 'Sticker no encontrado.' });
    if (!rows[0].telegram_file_id) return sendJson(res, 404, { error: 'El archivo de este sticker todavía no está disponible.' });

    const file = await telegramRequest(config, 'getFile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: rows[0].telegram_file_id })
    });
    const imageResponse = await fetch(
      `https://api.telegram.org/file/bot${config.telegramToken}/${file.file_path}`
    );
    if (!imageResponse.ok) throw new Error(`No se pudo descargar el sticker (${imageResponse.status}).`);

    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=300');
    if (file.file_size) res.setHeader('Content-Length', String(file.file_size));
    return res.status(200).send(Buffer.from(await imageResponse.arrayBuffer()));
  } catch (error) {
    console.error('No se pudo servir el sticker:', error.message);
    return sendJson(res, 502, { error: 'No se pudo recuperar el sticker desde Telegram.' });
  }
};
