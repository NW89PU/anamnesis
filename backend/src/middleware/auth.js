const crypto = require('crypto');
const config = require('../config');

// Constant-time сравнение токенов — защита от timing attack
function safeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
}

/**
 * Базовая Bearer-проверка на все /api/* маршруты.
 * Принимает API_TOKEN ИЛИ ADMIN_TOKEN (ADMIN — более сильный,
 * логично пропускать там где достаточно API).
 * Если API_TOKEN в .env не задан — пропускает всех (dev mode).
 */
function authMiddleware(req, res, next) {
  const apiToken = config.API_TOKEN;
  const adminToken = config.ADMIN_TOKEN;

  // Dev mode: токены не настроены — авторизация отключена (только session)
  if (!apiToken && !adminToken) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация' });
  }

  const provided = authHeader.slice(7);
  if (safeEqual(provided, apiToken) || safeEqual(provided, adminToken)) {
    return next();
  }
  return res.status(403).json({ error: 'Неверный токен' });
}

/**
 * Строгая проверка для admin endpoints — только ADMIN_TOKEN.
 * API_TOKEN (если настроен) НЕ даёт доступа к админке чтобы
 * разделить уровни: компрометация API_TOKEN не даёт админ-доступ.
 */
function adminAuthMiddleware(req, res, next) {
  const adminToken = config.ADMIN_TOKEN;

  // Dev mode: токен не настроен — пропускаем
  if (!adminToken) return next();

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация администратора' });
  }

  const provided = authHeader.slice(7);
  if (safeEqual(provided, adminToken)) {
    return next();
  }
  return res.status(403).json({ error: 'Недостаточно прав' });
}

/**
 * v4.0 — middlewares опираются на session, привязанную к user.
 *
 * Применяются ТОЛЬКО к роутам которые уже прошли session-middleware
 * (sess положен в req по token). Если sess.user_id отсутствует (legacy
 * PIN-сессия) — требуют admin-привилегии: легаси PIN = admin (это твоя
 * единственная сессия до миграции на password).
 */

function requireRole(role) {
  return function (req, res, next) {
    const sess = req.session; // ставит session middleware ниже (TODO #6)
    // Пока session middleware не кладёт req.session — берём токен сами.
    const authSession = require('../services/auth-session');
    const token = req.headers['x-session-token'];
    const s = sess || authSession.getSession(token);
    if (!s) return res.status(401).json({ error: 'Требуется авторизация' });

    if (!s.user_id) {
      // Legacy PIN-сессия. По дизайну это admin (твоя сессия). Любой role
      // удовлетворяется.
      if (role === 'admin' || role === 'user') return next();
      return res.status(403).json({ error: 'Недостаточно прав' });
    }

    const user = authSession.getUserById(s.user_id);
    if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
    if (role === 'admin' && user.role !== 'admin') {
      return res.status(403).json({ error: 'Требуются права администратора' });
    }
    next();
  };
}

function requireAiEnabled(req, res, next) {
  const authSession = require('../services/auth-session');
  const token = req.headers['x-session-token'];
  const s = authSession.getSession(token);
  if (!s) return res.status(401).json({ error: 'Требуется авторизация' });

  // Legacy PIN-сессия → ai_enabled (это ты, владелец)
  if (!s.user_id) return next();

  const user = authSession.getUserById(s.user_id);
  if (!user) return res.status(401).json({ error: 'Пользователь не найден' });
  if (!user.ai_enabled) {
    return res.status(403).json({
      error: 'AI-функции отключены для вашего аккаунта. Обратитесь к админу.',
      ai_enabled: false,
    });
  }
  next();
}

module.exports = { authMiddleware, adminAuthMiddleware, requireRole, requireAiEnabled };
