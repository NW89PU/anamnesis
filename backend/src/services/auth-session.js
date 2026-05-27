// Session management (v4.1, Google-only).
//
// Identity провайдер: Cloudflare Access JWT с verified email-claim'ом.
// Юзер upsert-ится лениво при первом cf-bootstrap. Этот модуль отвечает
// только за: session token CRUD, sliding expiry, audit log, и upsert
// user-а по cfEmail.
//
// Что выкинуто из v3/v4.0:
//   - PIN-flow (hashPin, verifyPin, setPin, getStoredPinHash)
//   - Security questions (per-patient в app_settings)
//   - Known devices + device trust
//   - Lockout backoff (он защищал PIN — теперь идентичность валидирует CF Access)
//   - Password (hashPassword, verifyPassword, createUser-with-password)
//   - WebAuthn (отдельный routes/webauthn.js был удалён)

const crypto = require('crypto');
const { rawDb } = require('../db');

// ─── Sessions ───────────────────────────────────────────────

const SESSION_MAX_AGE_DAYS = 14;
const SESSION_MS = SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
const SESSION_SLIDING_THRESHOLD_MS = 24 * 60 * 60 * 1000; // продлеваем если осталось < 1 дня

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createSession(patientId, ip, userAgent, deviceId = null, userId = null) {
  const token = generateSessionToken();
  const now = Date.now();
  const expires = new Date(now + SESSION_MS).toISOString().replace('T', ' ').slice(0, 19);
  // sessions.patient_id NOT NULL (исторический artifact). 0 = sentinel
  // «активный пациент не выбран». /api/me и middleware трактуют 0 как null.
  const pid = patientId == null ? 0 : patientId;
  rawDb.prepare(
    "INSERT INTO sessions (token, patient_id, expires_at, ip, user_agent, device_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(token, pid, expires, ip || null, userAgent || null, deviceId || null, userId || null);
  return token;
}

function getSession(token) {
  if (!token) return null;
  const row = rawDb.prepare(
    "SELECT * FROM sessions WHERE token = ? AND revoked = 0 AND expires_at > datetime('now')"
  ).get(token);
  return row || null;
}

function touchSession(token, ip) {
  // Sliding: если до expiry осталось меньше порога — продлеваем ещё на полный срок
  const sess = getSession(token);
  if (!sess) return false;
  const expiresTs = Date.parse(sess.expires_at.replace(' ', 'T') + 'Z');
  const remaining = expiresTs - Date.now();
  if (remaining < SESSION_SLIDING_THRESHOLD_MS) {
    const newExpires = new Date(Date.now() + SESSION_MS).toISOString().replace('T', ' ').slice(0, 19);
    rawDb.prepare(
      "UPDATE sessions SET last_seen_at = datetime('now'), expires_at = ?, ip = COALESCE(?, ip) WHERE token = ?"
    ).run(newExpires, ip || null, token);
  } else {
    rawDb.prepare(
      "UPDATE sessions SET last_seen_at = datetime('now'), ip = COALESCE(?, ip) WHERE token = ?"
    ).run(ip || null, token);
  }
  return true;
}

function revokeSession(token) {
  rawDb.prepare('UPDATE sessions SET revoked = 1 WHERE token = ?').run(token);
}

function revokeAllSessions(patientId, exceptToken = null) {
  // Используется только для admin-tools. Non-admin /api/auth/logout-all
  // делает прямой SQL по user_id (см. index.js).
  if (exceptToken) {
    rawDb.prepare('UPDATE sessions SET revoked = 1 WHERE patient_id = ? AND token != ?').run(patientId, exceptToken);
  } else {
    rawDb.prepare('UPDATE sessions SET revoked = 1 WHERE patient_id = ?').run(patientId);
  }
}

function cleanupExpiredSessions() {
  const r = rawDb.prepare(
    "DELETE FROM sessions WHERE expires_at < datetime('now') OR (revoked = 1 AND last_seen_at < datetime('now','-30 days'))"
  ).run();
  return r.changes;
}

// ─── Audit log ─────────────────────────────────────────────

function logAuthEvent(event, ip, userAgent, detail = null) {
  try {
    rawDb.prepare(
      "INSERT INTO auth_log (event, ip, user_agent, detail) VALUES (?, ?, ?, ?)"
    ).run(event, ip || null, userAgent || null, detail ? JSON.stringify(detail) : null);
  } catch (e) {
    console.error('[auth] log event error:', e.message);
  }
}

// Периодическая чистка раз в час
setInterval(() => {
  try {
    const n = cleanupExpiredSessions();
    if (n > 0) console.log(`[auth] Cleaned ${n} expired sessions`);
  } catch (e) { /* */ }
}, 60 * 60 * 1000).unref();

// ─── Users (v4.1 Google-only) ───────────────────────────────

function getUserById(id) {
  if (!id) return null;
  return rawDb.prepare(
    "SELECT id, email, role, ai_enabled, created_at, last_login_at FROM users WHERE id = ?"
  ).get(id) || null;
}

/**
 * Upsert юзера на основе email из CF Access JWT.
 * Если новый — role/ai_enabled выставляются по совпадению с
 * config.ANAMNESIS_ADMIN_EMAIL. Всегда обновляет last_login_at.
 */
function findOrCreateUserFromCfEmail(cfEmail, config) {
  if (!cfEmail) throw new Error('cfEmail required');
  const emailNorm = String(cfEmail).trim().toLowerCase();

  const existing = rawDb.prepare(
    "SELECT id FROM users WHERE email = ?"
  ).get(emailNorm);

  if (existing) {
    rawDb.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(existing.id);
    return getUserById(existing.id);
  }

  const adminEmail = (config?.ANAMNESIS_ADMIN_EMAIL || '').trim().toLowerCase();
  const isAdmin = !!adminEmail && emailNorm === adminEmail;
  const role = isAdmin ? 'admin' : 'user';
  const ai_enabled = isAdmin ? 1 : 0;

  const r = rawDb.prepare(
    "INSERT INTO users (email, role, ai_enabled, last_login_at) VALUES (?, ?, ?, datetime('now'))"
  ).run(emailNorm, role, ai_enabled);
  const newUser = getUserById(Number(r.lastInsertRowid));
  console.log(`[users] Created user id=${newUser.id} email=${newUser.email} role=${newUser.role}${isAdmin ? ' (admin from ANAMNESIS_ADMIN_EMAIL)' : ''}`);
  logAuthEvent('user_created', null, null, { user_id: newUser.id, email: newUser.email, role: newUser.role });
  return newUser;
}

module.exports = {
  createSession,
  getSession,
  touchSession,
  revokeSession,
  revokeAllSessions,
  cleanupExpiredSessions,
  logAuthEvent,
  SESSION_MAX_AGE_DAYS,
  getUserById,
  findOrCreateUserFromCfEmail,
};
