const {
  createAdminSession,
  getAdminPassword,
  isAdminAuthenticated,
  requireBrowserOrigin,
  safeEqual,
  sendJson,
  setAdminSessionCookie
} = require('../lib/stickers');

function getRequestBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return {};
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      return sendJson(res, 200, { authenticated: isAdminAuthenticated(req) });
    } catch (error) {
      console.error('No está configurado el acceso de administración:', error.message);
      return sendJson(res, 503, { error: error.message });
    }
  }

  if (req.method !== 'POST' && req.method !== 'DELETE') {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return sendJson(res, 405, { error: 'Método no permitido.' });
  }
  if (!requireBrowserOrigin(req, res)) return;

  if (req.method === 'DELETE') {
    setAdminSessionCookie(res, '', 0);
    return sendJson(res, 200, { authenticated: false });
  }

  try {
    const password = getAdminPassword();
    const body = getRequestBody(req);
    if (typeof body.password !== 'string' || !safeEqual(body.password, password)) {
      return sendJson(res, 401, { error: 'Contraseña incorrecta.' });
    }
    setAdminSessionCookie(res, createAdminSession(password));
    return sendJson(res, 200, { authenticated: true });
  } catch (error) {
    console.error('No se pudo iniciar sesión en administración:', error.message);
    return sendJson(res, 503, { error: error.message || 'No se pudo iniciar sesión.' });
  }
};

module.exports.config = {
  api: { bodyParser: { sizeLimit: '8kb' } }
};
