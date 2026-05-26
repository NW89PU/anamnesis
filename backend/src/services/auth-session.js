// Auth + Session management — переезд с in-memory Map на SQLite.
//
// Почему так:
// 1. Sessions выживают рестарты сервиса (раньше теряли всех пользователей
//    каждый раз при deploy)
// 2. Sliding expiry — продлеваем last_seen_at при каждом запросе
// 3. Revocation — можно дропнуть конкретную сессию или все сессии
// 4. Audit log — auth_log записывает все попытки login/logout
// 5. PIN хешируется с помощью Argon2id — если БД утечёт, PIN не восстановить
//
// Rotate:
// - Session expires: default 14 дней (было 30), продлевается при активности
// - PIN можно менять через POST /api/auth/change-pin (с старым PIN)

const crypto = require('crypto');
const config = require('../config');
const { rawDb } = require('../db');

// Argon2 — можно через npm или fallback на scrypt из node crypto.
// scrypt в node стандартный, без доп. зависимостей → используем его.
// Argon2 формально лучше, но scrypt с нормальными параметрами тоже
// безопасен для защиты PIN (цель — замедлить брут, а не абсолютная
// криптостойкость).

const SCRYPT_PARAMS = {
  N: 16384,      // 2^14 — ~50ms на современном CPU
  r: 8,
  p: 1,
  keylen: 64,
  maxmem: 64 * 1024 * 1024,
};

/**
 * Хеширует PIN (или пароль/пэттерн). Возвращает строку "salt$hash" в hex.
 */
function hashPin(pin) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(pin), salt, SCRYPT_PARAMS.keylen, SCRYPT_PARAMS);
  return `${salt.toString('hex')}$${hash.toString('hex')}`;
}

/**
 * Проверяет PIN против сохранённого хеша. constant-time сравнение.
 */
function verifyPin(pin, stored) {
  if (!stored || !stored.includes('$')) return false;
  const [saltHex, hashHex] = stored.split('$');
  const salt = Buffer.from(saltHex, 'hex');
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(String(pin), salt, expected.length, SCRYPT_PARAMS);
  return crypto.timingSafeEqual(expected, actual);
}

/**
 * Получить хеш PIN из app_settings. Если нет — инициализировать из .env APP_PIN.
 * Возвращает stored hash string.
 */
function getStoredPinHash(patientId = 1) {
  const row = rawDb.prepare(
    "SELECT value FROM app_settings WHERE key = ?"
  ).get(`pin_hash_${patientId}`);
  if (row?.value) return row.value;

  // Миграция: если есть APP_PIN в .env и нет хеша в БД — инициализируем
  if (config.APP_PIN) {
    const hash = hashPin(config.APP_PIN);
    rawDb.prepare(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)"
    ).run(`pin_hash_${patientId}`, hash);
    console.log(`[auth] PIN hash initialized for patient ${patientId} from .env`);
    return hash;
  }
  return null;
}

/**
 * Установить новый PIN (через API). Проверяет длину и формат.
 */
function setPin(newPin, patientId = 1) {
  const pinStr = String(newPin);
  if (!/^\d{4,10}$/.test(pinStr)) {
    throw new Error('PIN должен быть 4-10 цифр');
  }
  const hash = hashPin(pinStr);
  rawDb.prepare(
    "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)"
  ).run(`pin_hash_${patientId}`, hash);
  // Ревокация всех старых сессий при смене PIN
  rawDb.prepare('UPDATE sessions SET revoked = 1 WHERE patient_id = ?').run(patientId);
}

// ─── Sessions ───────────────────────────────────────────────

const SESSION_MAX_AGE_DAYS = 14; // вместо 30 — более консервативно
const SESSION_MS = SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
const SESSION_SLIDING_THRESHOLD_MS = 24 * 60 * 60 * 1000; // продлеваем если осталось < 1 дня

function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createSession(patientId, ip, userAgent, deviceId = null, userId = null) {
  const token = generateSessionToken();
  const now = Date.now();
  const expires = new Date(now + SESSION_MS).toISOString().replace('T', ' ').slice(0, 19);
  rawDb.prepare(
    "INSERT INTO sessions (token, patient_id, expires_at, ip, user_agent, device_id, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
  ).run(token, patientId, expires, ip || null, userAgent || null, deviceId || null, userId || null);
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

// Периодическая чистка каждый час
setInterval(() => {
  try {
    const n = cleanupExpiredSessions();
    if (n > 0) console.log(`[auth] Cleaned ${n} expired sessions`);
  } catch (e) {}
}, 60 * 60 * 1000).unref(); // unref чтобы не блокировать shutdown

// ─── Exponential backoff для неудачных попыток ─────────────
//
// Хранится в auth_lockouts, ключ = ip:device_id.
// Формула: 1-2 попытки без задержки, N-я (N≥3) → 2^(N-3) минут, cap 24ч.
// Это server-side enforcement — клиент-сайд (rate-limit.ts) лишь UX.

const LOCKOUT_THRESHOLD = 3;
const LOCKOUT_MAX_MINUTES = 24 * 60;

function getLockoutKey(ip, deviceId) {
  return `${ip || 'unknown'}:${deviceId || '-'}`;
}

/**
 * Проверить залочен ли клиент. Возвращает { locked, remainingMs, attempts }.
 */
function checkLockout(ip, deviceId) {
  const key = getLockoutKey(ip, deviceId);
  const row = rawDb.prepare(
    'SELECT attempts, locked_until FROM auth_lockouts WHERE lockout_key = ?'
  ).get(key);

  if (!row) return { locked: false, remainingMs: 0, attempts: 0 };

  if (row.locked_until) {
    const until = Date.parse(row.locked_until.replace(' ', 'T') + 'Z');
    const remaining = until - Date.now();
    if (remaining > 0) {
      return { locked: true, remainingMs: remaining, attempts: row.attempts };
    }
  }
  return { locked: false, remainingMs: 0, attempts: row.attempts };
}

/**
 * Записать неудачную попытку и вычислить следующий lockout.
 * Возвращает новый статус { locked, remainingMs, attempts }.
 */
function recordAuthFailure(ip, deviceId, patientId) {
  const key = getLockoutKey(ip, deviceId);
  const existing = rawDb.prepare(
    'SELECT attempts FROM auth_lockouts WHERE lockout_key = ?'
  ).get(key);

  const attempts = (existing?.attempts || 0) + 1;
  let lockedUntil = null;
  let remainingMs = 0;

  if (attempts >= LOCKOUT_THRESHOLD) {
    const overshoot = attempts - LOCKOUT_THRESHOLD;
    const minutes = Math.min(Math.pow(2, overshoot), LOCKOUT_MAX_MINUTES);
    const untilMs = Date.now() + minutes * 60_000;
    lockedUntil = new Date(untilMs).toISOString().replace('T', ' ').slice(0, 19);
    remainingMs = untilMs - Date.now();
  }

  rawDb.prepare(`
    INSERT INTO auth_lockouts (lockout_key, ip, device_id, patient_id, attempts, last_fail_at, locked_until, updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'), ?, datetime('now'))
    ON CONFLICT(lockout_key) DO UPDATE SET
      attempts = excluded.attempts,
      last_fail_at = excluded.last_fail_at,
      locked_until = excluded.locked_until,
      updated_at = excluded.updated_at,
      ip = excluded.ip,
      device_id = excluded.device_id
  `).run(key, ip || null, deviceId || null, patientId || null, attempts, lockedUntil);

  return { locked: !!lockedUntil, remainingMs, attempts };
}

/**
 * Сбросить счётчик неудач при успешном входе.
 */
function resetAuthFailures(ip, deviceId) {
  const key = getLockoutKey(ip, deviceId);
  rawDb.prepare('DELETE FROM auth_lockouts WHERE lockout_key = ?').run(key);
}

// ─── Device trust + security question ──────────────────────

/**
 * Нормализация ответа на секретный вопрос — убираем регистр и
 * крайние пробелы, чтобы юзер не промахивался из-за регистра.
 * НЕ убираем внутренние пробелы и не lowercase-им кириллицу для
 * экзотических языков — просто .trim() + .toLowerCase().
 */
function normalizeAnswer(answer) {
  return String(answer || '').trim().toLowerCase();
}

function getSecurityQuestion(patientId = 1) {
  const q = rawDb.prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(`security_question_${patientId}`);
  const h = rawDb.prepare("SELECT value FROM app_settings WHERE key = ?")
    .get(`security_answer_hash_${patientId}`);
  if (!q?.value || !h?.value) return null;
  return { question: q.value, answer_hash: h.value };
}

function setSecurityQuestion(patientId, question, answer) {
  const qTrim = String(question || '').trim();
  const aNorm = normalizeAnswer(answer);
  if (qTrim.length < 5 || qTrim.length > 200) {
    throw new Error('Вопрос должен быть 5-200 символов');
  }
  if (aNorm.length < 2 || aNorm.length > 100) {
    throw new Error('Ответ должен быть 2-100 символов');
  }
  const answerHash = hashPin(aNorm); // переиспользуем scrypt
  rawDb.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)")
    .run(`security_question_${patientId}`, qTrim);
  rawDb.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)")
    .run(`security_answer_hash_${patientId}`, answerHash);
  rawDb.prepare("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)")
    .run(`security_setup_at_${patientId}`, new Date().toISOString());
}

function verifySecurityAnswer(patientId, answer) {
  const data = getSecurityQuestion(patientId);
  if (!data) return false;
  return verifyPin(normalizeAnswer(answer), data.answer_hash);
}

function hasSecurityQuestion(patientId = 1) {
  return getSecurityQuestion(patientId) !== null;
}

/**
 * Проверить знает ли система это устройство для данного пациента.
 */
function isKnownDevice(deviceId, patientId = 1) {
  if (!deviceId) return false;
  const row = rawDb.prepare(
    "SELECT id FROM known_devices WHERE device_id = ? AND patient_id = ? AND revoked = 0"
  ).get(deviceId, patientId);
  return !!row;
}

/**
 * Зарегистрировать устройство как доверенное.
 * Возвращает id записи. Обновляет last_seen если уже есть.
 */
function registerDevice(deviceId, patientId, label, ip, userAgent) {
  if (!deviceId) throw new Error('device_id required');

  const existing = rawDb.prepare(
    "SELECT id, revoked FROM known_devices WHERE device_id = ? AND patient_id = ?"
  ).get(deviceId, patientId);

  if (existing) {
    // КРИТИЧНО: если устройство было отозвано — НЕ ре-активировать автоматически.
    // Раньше был баг: любой успешный verify-device сбрасывал revoked=0,
    // что делало revokeDevice бессмысленным (отозванное устройство снова
    // становилось доверенным при следующем вводе контрольного слова).
    // Теперь отозванные устройства остаются отозванными — бросаем ошибку.
    if (existing.revoked) {
      const err = new Error('Устройство было отозвано владельцем. Доступ запрещён.');
      err.status = 403;
      throw err;
    }
    rawDb.prepare(
      "UPDATE known_devices SET last_seen_at = datetime('now'), last_ip = ?, user_agent = ? WHERE id = ?"
    ).run(ip || null, userAgent || null, existing.id);
    return existing.id;
  }

  const r = rawDb.prepare(
    "INSERT INTO known_devices (device_id, patient_id, label, last_ip, user_agent) VALUES (?, ?, ?, ?, ?)"
  ).run(deviceId, patientId, label || null, ip || null, userAgent || null);
  return Number(r.lastInsertRowid);
}

function touchDevice(deviceId, patientId, ip) {
  if (!deviceId) return;
  rawDb.prepare(
    "UPDATE known_devices SET last_seen_at = datetime('now'), last_ip = COALESCE(?, last_ip) WHERE device_id = ? AND patient_id = ?"
  ).run(ip || null, deviceId, patientId);
}

function listDevices(patientId = 1) {
  return rawDb.prepare(
    "SELECT id, device_id, label, first_seen_at, last_seen_at, last_ip, user_agent, revoked FROM known_devices WHERE patient_id = ? ORDER BY last_seen_at DESC"
  ).all(patientId);
}

function revokeDevice(deviceId, patientId) {
  // 1. Помечаем устройство как отозванное
  const r1 = rawDb.prepare(
    "UPDATE known_devices SET revoked = 1 WHERE device_id = ? AND patient_id = ?"
  ).run(deviceId, patientId);

  // 2. КРИТИЧНО: ревокируем ВСЕ активные сессии этого устройства немедленно.
  // Без этого пользователь с отозванного устройства продолжает пользоваться
  // приложением до истечения session expires_at (до 14 дней).
  // Сессии ищутся по device_id (колонка добавлена в v3.16).
  const r2 = rawDb.prepare(
    "UPDATE sessions SET revoked = 1 WHERE device_id = ? AND patient_id = ? AND revoked = 0"
  ).run(deviceId, patientId);

  return {
    device_marked_revoked: r1.changes > 0,
    sessions_revoked: r2.changes,
  };
}

// ─── v4.0 users (login/password, multi-user) ────────────────
//
// hashPassword/verifyPassword — это те же scrypt-параметры что и для PIN,
// просто отдельные имена для читаемости (PIN ≠ password концептуально).
// При необходимости параметры можно усилить только для password (длиннее
// чем PIN, можно дороже хешировать).

function hashPassword(password) {
  return hashPin(password);
}

function verifyPassword(password, stored) {
  return verifyPin(password, stored);
}

/**
 * Создать нового пользователя. Не проверяет уникальность email — это
 * делает UNIQUE constraint, бросит SqliteError если email занят.
 * Возвращает { id, email, patient_id, role, ai_enabled }.
 */
function createUser({ email, password, patient_id, role = 'user', ai_enabled = 0 }) {
  if (!email || !password || !patient_id) {
    throw new Error('email, password, patient_id are required');
  }
  const emailNorm = String(email).trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(emailNorm)) {
    throw new Error('Invalid email format');
  }
  if (String(password).length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  const hash = hashPassword(password);
  const r = rawDb.prepare(
    "INSERT INTO users (email, password_hash, patient_id, role, ai_enabled) VALUES (?, ?, ?, ?, ?)"
  ).run(emailNorm, hash, patient_id, role, ai_enabled ? 1 : 0);
  return getUserById(Number(r.lastInsertRowid));
}

function findUserByEmail(email) {
  if (!email) return null;
  const emailNorm = String(email).trim().toLowerCase();
  return rawDb.prepare(
    "SELECT id, email, password_hash, patient_id, role, ai_enabled, created_at, last_login_at FROM users WHERE email = ?"
  ).get(emailNorm) || null;
}

function getUserById(id) {
  if (!id) return null;
  return rawDb.prepare(
    "SELECT id, email, patient_id, role, ai_enabled, created_at, last_login_at FROM users WHERE id = ?"
  ).get(id) || null;
}

function updateLastLogin(id) {
  rawDb.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(id);
}

/**
 * One-shot миграция при старте сервиса.
 * Если таблица users пустая И в .env заданы ANAMNESIS_ADMIN_EMAIL/PASSWORD
 * И patient(id=1) существует → создаётся admin-юзер привязанный к patient 1,
 * с role='admin' и ai_enabled=1.
 *
 * Все существующие активные sessions с patient_id=1 получают user_id=новой
 * записи — это значит твоя текущая PIN-сессия не разлогинится и сразу
 * начинает быть «правильной» session-with-user.
 *
 * Если env vars не заданы — пропуск с warning. Существующий PIN-flow
 * продолжает работать как раньше (legacy режим без users).
 */
function backfillFirstAdminIfNeeded(config) {
  try {
    const userCount = rawDb.prepare('SELECT COUNT(*) AS c FROM users').get().c;
    if (userCount > 0) return; // ничего не делаем, юзеры уже есть

    const email = (config.ANAMNESIS_ADMIN_EMAIL || '').trim();
    const password = config.ANAMNESIS_ADMIN_PASSWORD || '';
    if (!email || !password) {
      console.warn('[users] No admin backfill: ANAMNESIS_ADMIN_EMAIL/PASSWORD not set in .env.');
      console.warn('[users] Login/password is unavailable until you set these and restart.');
      console.warn('[users] PIN-based auth continues to work as before.');
      return;
    }

    const patient = rawDb.prepare('SELECT id FROM patient WHERE id = 1').get();
    if (!patient) {
      console.error('[users] Cannot backfill admin: patient(id=1) does not exist.');
      return;
    }

    const user = createUser({
      email, password, patient_id: 1, role: 'admin', ai_enabled: 1,
    });

    // Привязываем уже активные sessions этого patient к новому user_id.
    // Без этого старая PIN-сессия осталась бы без user_id (legacy режим)
    // и /api/me не смог бы сказать кто залогинен.
    const updated = rawDb.prepare(
      'UPDATE sessions SET user_id = ? WHERE patient_id = 1 AND user_id IS NULL AND revoked = 0'
    ).run(user.id);

    console.log(`[users] Created first admin user id=${user.id} email=${user.email} for patient 1`);
    if (updated.changes > 0) {
      console.log(`[users] Linked ${updated.changes} active PIN-session(s) to this user`);
    }

    // Auth log — для аудита когда именно появился первый юзер
    logAuthEvent('first_admin_backfill', null, null, {
      user_id: user.id, email: user.email, sessions_linked: updated.changes,
    });
  } catch (e) {
    console.error('[users] Backfill failed:', e.message);
    // не throw — сервис должен стартовать даже если миграция упала
  }
}

module.exports = {
  hashPin,
  verifyPin,
  hashPassword,
  verifyPassword,
  createUser,
  findUserByEmail,
  getUserById,
  updateLastLogin,
  backfillFirstAdminIfNeeded,
  getStoredPinHash,
  setPin,
  createSession,
  getSession,
  touchSession,
  revokeSession,
  revokeAllSessions,
  cleanupExpiredSessions,
  logAuthEvent,
  SESSION_MAX_AGE_DAYS,
  // v3.11+
  getSecurityQuestion,
  setSecurityQuestion,
  verifySecurityAnswer,
  hasSecurityQuestion,
  isKnownDevice,
  registerDevice,
  touchDevice,
  listDevices,
  revokeDevice,
  // v3.13 backoff
  checkLockout,
  recordAuthFailure,
  resetAuthFailures,
  LOCKOUT_THRESHOLD,
  LOCKOUT_MAX_MINUTES,
};
