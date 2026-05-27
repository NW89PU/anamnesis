// Auth middlewares (v4.1).
//
// Используются:
//   - adminAuthMiddleware на /api/admin/* — bearer ADMIN_TOKEN. Это путь
//     для AI Coordinator (Claude Code дёргает admin-tools через curl).
//   - requireAiEnabled на /api/ai-requests POST — гейт по users.ai_enabled.
//
// Session-based auth и patient_id resolution живут в index.js + middleware/patientId.js.

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
 * Bearer ADMIN_TOKEN. Если токен в .env не задан — пропускает всех (dev mode).
 * Используется на /api/admin/* для AI Coordinator (Claude Code) и admin-tools.
 */
function adminAuthMiddleware(req, res, next) {
  const adminToken = config.ADMIN_TOKEN;
  if (!adminToken) return next(); // dev mode

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Требуется авторизация администратора' });
  }

  const provided = authHeader.slice(7);
  if (safeEqual(provided, adminToken)) return next();
  return res.status(403).json({ error: 'Недостаточно прав' });
}

/**
 * Гейт по users.ai_enabled. Опирается на req.session (ставит session middleware
 * в index.js). Для admin-token (нет req.session) — пропускает.
 */
function requireAiEnabled(req, res, next) {
  const authSession = require('../services/auth-session');
  const token = req.headers['x-session-token'];
  const s = authSession.getSession(token);
  if (!s) {
    // Возможно admin-token bearer — пропускаем (защита на /api/admin/* отдельная)
    if (!s && req.headers.authorization?.startsWith('Bearer ')) return next();
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  if (!s.user_id) return res.status(401).json({ error: 'Сессия устарела' });

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

module.exports = { adminAuthMiddleware, requireAiEnabled };
