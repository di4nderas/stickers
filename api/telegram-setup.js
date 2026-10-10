const crypto = require('node:crypto');
const { getTelegramConfig, sendJson, telegramRequest } = require('../lib/stickers');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendJson(res, 405, { error: 'Método no permitido.' });
  }

  const expected = process.env.TELEGRAM_SETUP_KEY || '';
  const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!expected || !provided) return sendJson(res, 401, { error: 'Autorización requerida.' });
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
    return sendJson(res, 401, { error: 'Autorización inválida.' });
  }

  try {
    const config = getTelegramConfig();
    const params = new URLSearchParams({
      limit: '100',
      allowed_updates: JSON.stringify(['message'])
    });
    const updates = await telegramRequest(config, `getUpdates?${params}`);
    const chats = new Map();
    for (const update of updates) {
      const message = update.message;
      if (!message || message.chat?.type !== 'private') continue;
      chats.set(String(message.chat.id), {
        chatId: String(message.chat.id),
        firstName: message.chat.first_name || '',
        username: message.chat.username || '',
        lastMessage: message.text || ''
      });
    }
    return sendJson(res, 200, { privateChats: Array.from(chats.values()) });
  } catch (error) {
    console.error('No se pudieron consultar los chats privados del bot:', error.message);
    return sendJson(res, 502, {
      error: 'Telegram no devolvió las actualizaciones. Inicia el bot con /start y comprueba que no haya otro webhook o lector getUpdates activo.'
    });
  }
};
