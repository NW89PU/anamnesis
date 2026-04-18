const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const config = require('./config');
const { initScheduler } = require('./services/scheduler');
const { initBackupScheduler, telegramSend } = require('./services/backup');
const telegram = require('./services/telegram');
const authSession = require('./services/auth-session');
const { authMiddleware, adminAuthMiddleware } = require('./middleware/auth');
const { patientIdMiddleware } = require('./middleware/patientId');
const { rawDb } = require('./db');

const patientRoutes = require('./routes/patient');
const diagnosesRoutes = require('./routes/diagnoses');
const medicationsRoutes = require('./routes/medications');
const specialistsRoutes = require('./routes/specialists');
const documentsRoutes = require('./routes/documents');
const timelineRoutes = require('./routes/timeline');
const planRoutes = require('./routes/plan');
const errorsRoutes = require('./routes/errors');
const remindersRoutes = require('./routes/reminders');
const dashboardRoutes = require('./routes/dashboard');
const exportRoutes = require('./routes/export');
const commentsRoutes = require('./routes/comments');
const adminRoutes = require('./routes/admin');
const vaccinationsRoutes = require('./routes/vaccinations');
const growthRoutes = require('./routes/growth');
const labResultsRoutes = require('./routes/lab-results');
const searchRoutes = require('./routes/search');
const aiRequestsRoutes = require('./routes/ai-requests');
const prescriptionsRoutes = require('./routes/prescriptions');
const visitDiagnosesRoutes = require('./routes/visit-diagnoses');
const patientContextRoutes = require('./routes/patient-context');
const adminToolsRoutes = require('./routes/admin-tools');
const webauthnRoutes = require('./routes/webauthn');
const historyRoutes = require('./routes/history');

const app = express();

// CORS — restrict to configured origins
const corsOrigins = config.CORS_ORIGINS;
app.use(cors({
  origin: corsOrigins === '*' ? true : corsOrigins.split(',').map(s => s.trim()),
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));

// Rate limiting — два уровня:
// 1) Общий для всех /api/*: 1000 запросов / 15 минут (щедро, но защита от DOS).
//    Нужно потому что с refetchOnMount:'always' PWA делает много запросов
//    при каждом открытии, свёртывании, возврате из другого app.
// 2) Строгий для /api/auth/login: 20 попыток / 15 минут (анти-brute-force PIN).
//    Плюс на клиенте ещё есть локальная rate-limit с экспоненциальным локаутом.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Слишком много запросов, попробуйте позже' },
  standardHeaders: true,
  legacyHeaders: false,
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Слишком много попыток входа, попробуйте позже' },
  standardHeaders: true,
  legacyHeaders: false,
});
// Отдельный строгий лимитер для /api/admin/tools/sql — защита от спам-запросов
// произвольным SQL (даже с правильным токеном — нельзя жарить сотни запросов/сек)
const sqlLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 60, // 60 SQL запросов в минуту
  message: { error: 'Слишком частые SQL запросы' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/verify-device', authLimiter);
app.use('/api/auth/change-pin', authLimiter);
app.use('/api/webauthn/login/verify', authLimiter);
app.use('/api/admin/tools/sql', sqlLimiter);
app.use('/api/', apiLimiter);

app.use('/uploads', express.static(config.UPLOAD_DIR));

// Frontend static files
const frontendDir = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendDir));

// Health check with DB verification
app.get('/api/health', (_req, res) => {
  try {
    rawDb.prepare('SELECT 1').get();
    res.json({ status: 'ok', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' });
  }
});

// ── PIN-based session auth (v3: БД + sliding + revocation + audit) ──

function clientIp(req) {
  return (req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.socket?.remoteAddress || null;
}
function userAgent(req) {
  return req.headers['user-agent']?.slice(0, 300) || null;
}

// POST /api/auth/login — двухфазный login:
//   1. Верифицируем PIN
//   2. Если security question настроен И device_id незнаком → возвращаем
//      {requires_answer: true, question: "..."} вместо токена
//   3. Клиент показывает форму, отправляет ответ в /api/auth/verify-device
//   4. Там уже создаётся session token и device регистрируется
app.post('/api/auth/login', (req, res) => {
  const { pin } = req.body || {};
  const ip = clientIp(req);
  const ua = userAgent(req);
  const deviceId = req.headers['x-device-id'] || req.body?.device_id || null;
  const patientId = parseInt(req.headers['x-patient-id'] || '1', 10);

  try {
    // Exponential backoff check ДО проверки PIN
    const lockout = authSession.checkLockout(ip, deviceId);
    if (lockout.locked) {
      authSession.logAuthEvent('login_locked_out', ip, ua, {
        patient_id: patientId, device_id: deviceId, remaining_ms: lockout.remainingMs,
      });
      return res.status(429).json({
        error: 'Слишком много попыток. Попробуйте позже.',
        locked_until: new Date(Date.now() + lockout.remainingMs).toISOString(),
        remaining_sec: Math.ceil(lockout.remainingMs / 1000),
        attempts: lockout.attempts,
      });
    }

    // No PIN configured — auto-login (dev mode)
    if (!config.APP_PIN && !authSession.getStoredPinHash(patientId)) {
      const token = authSession.createSession(patientId, ip, ua, deviceId);
      if (deviceId) authSession.registerDevice(deviceId, patientId, null, ip, ua);
      authSession.resetAuthFailures(ip, deviceId);
      authSession.logAuthEvent('login_success', ip, ua, { reason: 'no_pin_configured', patient_id: patientId });
      return res.json({ token, expires_days: authSession.SESSION_MAX_AGE_DAYS });
    }

    const stored = authSession.getStoredPinHash(patientId);
    if (!stored) {
      authSession.logAuthEvent('login_fail', ip, ua, { reason: 'no_hash_stored', patient_id: patientId });
      return res.status(500).json({ error: 'PIN не настроен' });
    }

    if (!authSession.verifyPin(pin, stored)) {
      const newLockout = authSession.recordAuthFailure(ip, deviceId, patientId);
      authSession.logAuthEvent('login_fail', ip, ua, {
        reason: 'wrong_pin', patient_id: patientId, device_id: deviceId, attempts: newLockout.attempts,
      });
      return res.status(401).json({
        error: 'Неверный PIN-код',
        attempts: newLockout.attempts,
        next_lockout_sec: newLockout.locked ? Math.ceil(newLockout.remainingMs / 1000) : 0,
      });
    }

    // PIN верный. Проверяем device trust.
    const hasQuestion = authSession.hasSecurityQuestion(patientId);
    const deviceKnown = deviceId ? authSession.isKnownDevice(deviceId, patientId) : false;

    if (hasQuestion && !deviceKnown) {
      // Security question настроен и устройство неизвестное → challenge
      const q = authSession.getSecurityQuestion(patientId);
      authSession.logAuthEvent('login_challenge', ip, ua, { patient_id: patientId, device_id: deviceId });

      // Выдаём временный "pending_challenge_token" который действует 5 минут
      // и только для endpoint verify-device. Без него challenge нельзя верифицировать.
      const challengeToken = require('crypto').randomBytes(32).toString('hex');
      rawDb.prepare(
        "INSERT INTO app_settings (key, value) VALUES (?, ?)"
      ).run(
        `pending_challenge_${challengeToken}`,
        JSON.stringify({ patient_id: patientId, device_id: deviceId, expires: Date.now() + 5 * 60 * 1000, ip })
      );

      return res.json({
        requires_answer: true,
        question: q.question,
        challenge_token: challengeToken,
      });
    }

    // Либо security question не настроен, либо device знакомый → выдаём session
    // ВАЖНО: registerDevice может бросить 403 если устройство было отозвано
    // владельцем. В этом случае PIN верный, но вход запрещён.
    try {
      if (deviceId) {
        authSession.registerDevice(deviceId, patientId, null, ip, ua);
      }
    } catch (regErr) {
      if (regErr.status === 403) {
        authSession.logAuthEvent('login_blocked_revoked', ip, ua, { patient_id: patientId, device_id: deviceId });
        return res.status(403).json({
          error: 'Это устройство было отозвано владельцем. Обратитесь к нему для восстановления доступа.',
          device_revoked: true,
        });
      }
      throw regErr;
    }
    const token = authSession.createSession(patientId, ip, ua, deviceId);
    authSession.resetAuthFailures(ip, deviceId);
    authSession.logAuthEvent('login_success', ip, ua, { patient_id: patientId, device_known: deviceKnown });
    res.json({
      token,
      expires_days: authSession.SESSION_MAX_AGE_DAYS,
      device_trusted: deviceKnown || !hasQuestion,
      needs_security_setup: !hasQuestion,
    });
  } catch (err) {
    console.error('[auth] login error:', err);
    authSession.logAuthEvent('login_error', ip, ua, { error: err.message });
    res.status(500).json({ error: 'Ошибка авторизации' });
  }
});

// POST /api/auth/verify-device — ответ на секретный вопрос для нового device
// Принимает {challenge_token, answer, device_label?}
// Проверяет challenge не истёк, PIN уже был принят, ответ правильный.
// При успехе: регистрирует device_id как trusted, создаёт session token.
app.post('/api/auth/verify-device', (req, res) => {
  const { challenge_token, answer, device_label } = req.body || {};
  const ip = clientIp(req);
  const ua = userAgent(req);

  if (!challenge_token || !answer) {
    return res.status(400).json({ error: 'challenge_token и answer обязательны' });
  }

  try {
    const row = rawDb.prepare(
      "SELECT value FROM app_settings WHERE key = ?"
    ).get(`pending_challenge_${challenge_token}`);

    if (!row) {
      authSession.logAuthEvent('verify_device_fail', ip, ua, { reason: 'no_challenge' });
      return res.status(401).json({ error: 'Challenge не найден или истёк' });
    }

    const challenge = JSON.parse(row.value);
    if (challenge.expires < Date.now()) {
      rawDb.prepare("DELETE FROM app_settings WHERE key = ?").run(`pending_challenge_${challenge_token}`);
      authSession.logAuthEvent('verify_device_fail', ip, ua, { reason: 'expired' });
      return res.status(401).json({ error: 'Challenge истёк, повторите вход' });
    }

    const { patient_id, device_id } = challenge;

    // Backoff check — тот же механизм что и для PIN
    const lockout = authSession.checkLockout(ip, device_id);
    if (lockout.locked) {
      authSession.logAuthEvent('verify_device_locked', ip, ua, {
        patient_id, device_id, remaining_ms: lockout.remainingMs,
      });
      return res.status(429).json({
        error: 'Слишком много попыток. Попробуйте позже.',
        locked_until: new Date(Date.now() + lockout.remainingMs).toISOString(),
        remaining_sec: Math.ceil(lockout.remainingMs / 1000),
        attempts: lockout.attempts,
      });
    }

    if (!authSession.verifySecurityAnswer(patient_id, answer)) {
      const newLockout = authSession.recordAuthFailure(ip, device_id, patient_id);
      authSession.logAuthEvent('verify_device_fail', ip, ua, {
        patient_id, device_id, reason: 'wrong_answer', attempts: newLockout.attempts,
      });
      return res.status(401).json({
        error: 'Неверный ответ',
        attempts: newLockout.attempts,
        next_lockout_sec: newLockout.locked ? Math.ceil(newLockout.remainingMs / 1000) : 0,
      });
    }

    // Успех (правильный ответ) — удаляем challenge.
    // НО: если устройство ранее было отозвано — registerDevice бросит 403,
    // и мы НЕ выдаём сессию. Это основа фикса security bug: отозванные
    // устройства не могут вернуться даже если знают контрольное слово.
    rawDb.prepare("DELETE FROM app_settings WHERE key = ?").run(`pending_challenge_${challenge_token}`);

    // Проверяем было ли устройство уже зарегистрировано раньше (для NEW DEVICE нотификации)
    const wasKnownBefore = rawDb.prepare(
      'SELECT id, revoked FROM known_devices WHERE device_id = ? AND patient_id = ?'
    ).get(device_id, patient_id);

    try {
      authSession.registerDevice(device_id, patient_id, device_label || null, ip, ua);
    } catch (regErr) {
      if (regErr.status === 403) {
        authSession.logAuthEvent('verify_device_blocked_revoked', ip, ua, { patient_id, device_id });
        return res.status(403).json({
          error: 'Это устройство было отозвано владельцем. Обратитесь к нему для восстановления доступа.',
          device_revoked: true,
        });
      }
      throw regErr;
    }
    authSession.resetAuthFailures(ip, device_id);
    const token = authSession.createSession(patient_id, ip, ua, device_id);
    authSession.logAuthEvent('verify_device_success', ip, ua, { patient_id, device_id });

    // 🔔 Telegram уведомление только если устройство РЕАЛЬНО новое
    // (первая регистрация, не перелогин с того же device_id)
    if (!wasKnownBefore) {
      const patient = rawDb.prepare('SELECT full_name FROM patient WHERE id = ?').get(patient_id);
      const patientName = patient?.full_name || `patient ${patient_id}`;
      const now = new Date().toLocaleString('ru-RU', {
        timeZone: 'Asia/Yekaterinburg',
        dateStyle: 'short',
        timeStyle: 'medium',
      });
      const uaShort = (ua || 'unknown').slice(0, 200);
      const label = device_label?.trim() || '(без названия)';
      // HTML escape basic
      const esc = (s) => String(s || '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

      const message =
        `<b>[NEW DEVICE]</b>\n\n` +
        `Устройство получило доступ впервые.\n\n` +
        `• Пациент: <b>${esc(patientName)}</b>\n` +
        `• Название: <b>${esc(label)}</b>\n` +
        `• IP: <code>${esc(ip || 'unknown')}</code>\n` +
        `• User Agent: <code>${esc(uaShort)}</code>\n` +
        `• Время: ${esc(now)}\n` +
        `• Device ID: <code>${esc(device_id.slice(0, 13))}…</code>\n\n` +
        `Если это <b>не ты</b> — немедленно:\n` +
        `• Смени PIN через Ещё → Безопасность\n` +
        `• Удали устройство из списка доверенных`;

      telegram.sendMessage(message).catch(e =>
        console.error('[auth] new device telegram notify failed:', e.message)
      );
    }

    res.json({
      token,
      expires_days: authSession.SESSION_MAX_AGE_DAYS,
      device_trusted: true,
    });
  } catch (err) {
    console.error('[auth] verify-device error:', err);
    res.status(500).json({ error: 'Ошибка верификации устройства' });
  }
});

// POST /api/auth/set-security-question — настройка секретного вопроса
// Требует активной сессии (т.е. юзер уже залогинен). После установки
// текущее устройство автоматически регистрируется как trusted.
app.post('/api/auth/set-security-question', (req, res) => {
  const token = req.headers['x-session-token'];
  const sess = authSession.getSession(token);
  if (!sess) return res.status(401).json({ error: 'Требуется авторизация' });

  const { question, answer, device_label } = req.body || {};
  const ip = clientIp(req);
  const ua = userAgent(req);
  const deviceId = req.headers['x-device-id'];

  try {
    authSession.setSecurityQuestion(sess.patient_id, question, answer);
    // Регистрируем текущее устройство (чтобы юзер не выкинулся сам)
    if (deviceId) {
      authSession.registerDevice(deviceId, sess.patient_id, device_label || 'Это устройство', ip, ua);
    }
    authSession.logAuthEvent('security_question_set', ip, ua, { patient_id: sess.patient_id });

    // Уведомление что security setup выполнен
    const message =
      `<b>[SECURITY SETUP]</b>\n\n` +
      `Контрольное слово настроено. С этого момента новые устройства будут требовать его при входе.\n\n` +
      `• IP: <code>${(ip || 'unknown').replace(/[&<>]/g, '')}</code>\n` +
      `• Время: ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Yekaterinburg' })}`;
    telegram.sendMessage(message).catch(() => {});

    res.json({ ok: true, current_device_registered: !!deviceId });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/auth/security-status — статус security setup + список устройств
app.get('/api/auth/security-status', (req, res) => {
  const token = req.headers['x-session-token'];
  const sess = authSession.getSession(token);
  if (!sess) return res.status(401).json({ error: 'Требуется авторизация' });

  const hasQuestion = authSession.hasSecurityQuestion(sess.patient_id);
  const devices = authSession.listDevices(sess.patient_id);
  const q = hasQuestion ? authSession.getSecurityQuestion(sess.patient_id) : null;

  res.json({
    has_security_question: hasQuestion,
    question: q?.question || null,
    devices,
  });
});

// POST /api/auth/revoke-device — разлогинить конкретное устройство
app.post('/api/auth/revoke-device', (req, res) => {
  const token = req.headers['x-session-token'];
  const sess = authSession.getSession(token);
  if (!sess) return res.status(401).json({ error: 'Требуется авторизация' });

  const { device_id } = req.body || {};
  if (!device_id) return res.status(400).json({ error: 'device_id required' });

  authSession.revokeDevice(device_id, sess.patient_id);
  authSession.logAuthEvent('device_revoked', clientIp(req), userAgent(req), {
    patient_id: sess.patient_id, device_id,
  });
  res.json({ ok: true });
});

// GET /api/auth/check — verify session is still valid
app.get('/api/auth/check', (req, res) => {
  // Dev mode (нет ни .env PIN ни хеша)
  if (!config.APP_PIN && !authSession.getStoredPinHash(1)) return res.json({ valid: true });
  const token = req.headers['x-session-token'];
  const sess = authSession.getSession(token);
  if (sess) {
    authSession.touchSession(token, clientIp(req));
    return res.json({ valid: true, expires_at: sess.expires_at });
  }
  res.status(401).json({ valid: false });
});

// POST /api/auth/logout — ревокация текущей сессии
app.post('/api/auth/logout', (req, res) => {
  const token = req.headers['x-session-token'];
  if (token) {
    authSession.revokeSession(token);
    authSession.logAuthEvent('logout', clientIp(req), userAgent(req));
  }
  res.json({ ok: true });
});

// POST /api/auth/logout-all — ревокация ВСЕХ сессий пациента кроме текущей
app.post('/api/auth/logout-all', (req, res) => {
  const token = req.headers['x-session-token'];
  const sess = authSession.getSession(token);
  if (!sess) return res.status(401).json({ error: 'Требуется авторизация' });
  authSession.revokeAllSessions(sess.patient_id, token);
  authSession.logAuthEvent('logout_all', clientIp(req), userAgent(req), { patient_id: sess.patient_id });
  res.json({ ok: true });
});

// POST /api/auth/change-pin — смена PIN (нужен текущий)
app.post('/api/auth/change-pin', (req, res) => {
  const token = req.headers['x-session-token'];
  const sess = authSession.getSession(token);
  if (!sess) return res.status(401).json({ error: 'Требуется авторизация' });

  const { old_pin, new_pin } = req.body || {};
  const stored = authSession.getStoredPinHash(sess.patient_id);
  if (!authSession.verifyPin(old_pin, stored)) {
    authSession.logAuthEvent('change_pin_fail', clientIp(req), userAgent(req), { reason: 'wrong_old_pin' });
    return res.status(401).json({ error: 'Неверный текущий PIN' });
  }
  try {
    authSession.setPin(new_pin, sess.patient_id);
    // setPin revokes all sessions — создаём новую для текущего клиента
    const currentDeviceId = req.headers['x-device-id'] || null;
    const newToken = authSession.createSession(sess.patient_id, clientIp(req), userAgent(req), currentDeviceId);
    authSession.logAuthEvent('change_pin_success', clientIp(req), userAgent(req), { patient_id: sess.patient_id });
    res.json({ ok: true, token: newToken });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Session middleware — protect all API routes except auth
app.use('/api/', (req, res, next) => {
  // Skip auth endpoints which are themselves authentication
  if (
    req.path === '/auth/login' ||
    req.path === '/auth/check' ||
    req.path === '/auth/logout' ||
    req.path === '/auth/verify-device' ||
    req.path === '/webauthn/login/options' ||
    req.path === '/webauthn/login/verify' ||
    req.path === '/webauthn/available' ||
    req.path === '/health'
  ) return next();
  // Dev mode — нет ни .env PIN ни хеша
  if (!config.APP_PIN && !authSession.getStoredPinHash(1)) return next();
  const token = req.headers['x-session-token'] || req.query.token;
  const sess = authSession.getSession(token);
  if (sess) {
    authSession.touchSession(token, clientIp(req));
    return next();
  }
  return res.status(401).json({ error: 'Требуется авторизация' });
});

// Patient ID middleware — extract from X-Patient-Id header
app.use('/api/', patientIdMiddleware);

// Bearer auth middleware НЕ применяется глобально к /api/*:
// фронтенд защищён через session middleware (PIN + device trust).
// Это middleware используется только для /api/admin/* где нужна
// дополнительная проверка ADMIN_TOKEN (через adminAuthMiddleware).

// Admin routes with separate auth
// patientIdMiddleware уже применён глобально выше — req.patientId есть у всех /api/* запросов
app.use('/api/admin/tools', adminAuthMiddleware, adminToolsRoutes);
app.use('/api/admin', adminAuthMiddleware, adminRoutes);
app.use('/api', adminRoutes); // version and changelog at /api/version, /api/changelog

// Standard API routes
app.use('/api/patient', patientRoutes);
app.use('/api/diagnoses', diagnosesRoutes);
app.use('/api/medications', medicationsRoutes);
app.use('/api/specialists', specialistsRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/timeline', timelineRoutes);
app.use('/api/plan', planRoutes);
app.use('/api/errors', errorsRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/vaccinations', vaccinationsRoutes);
app.use('/api/growth', growthRoutes);
app.use('/api/lab-results', labResultsRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/ai-requests', aiRequestsRoutes);
app.use('/api/prescriptions', prescriptionsRoutes);
app.use('/api/visit-diagnoses', visitDiagnosesRoutes);
app.use('/api/patient-context', patientContextRoutes);
app.use('/api/webauthn', webauthnRoutes);
app.use('/api/history', historyRoutes);

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(frontendDir, 'index.html'));
});

// ── Centralized error handler ───────────────────────────────
// Не возвращаем err.message клиенту чтобы не утекали детали
// (пути файлов, SQL ошибки, структура БД). Пишем полную ошибку
// в лог с request_id, клиенту — только request_id + generic message.
app.use((err, req, res, _next) => {
  const requestId = crypto.randomBytes(8).toString('hex');
  const isDev = config.NODE_ENV !== 'production';

  console.error(`[error ${requestId}] ${req.method} ${req.originalUrl}:`, err);

  // Специфичные статусы — пропускаем как есть
  if (err.status && err.status < 500) {
    return res.status(err.status).json({
      error: err.message || 'Bad request',
      request_id: requestId,
    });
  }

  // 5xx — скрываем детали в prod
  res.status(500).json({
    error: isDev ? err.message : 'Внутренняя ошибка сервера',
    request_id: requestId,
    ...(isDev && { stack: err.stack }),
  });
});

const server = app.listen(config.PORT, () => {
  console.log(`Сервер запущен: http://localhost:${config.PORT}`);
  initScheduler();
  initBackupScheduler();

  // Telegram уведомление о старте (если настроен бот)
  if (config.TELEGRAM_BOT_TOKEN && config.TELEGRAM_CHAT_ID) {
    const msg = `<b>[SERVICE START]</b>\n\n` +
      `• Время: ${new Date().toISOString()}\n` +
      `• Node: ${process.version}\n` +
      `• Порт: ${config.PORT}\n` +
      `• Env: ${config.NODE_ENV}`;
    telegramSend(msg).catch(e => console.error('startup notification:', e.message));
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down...');
  server.close(() => {
    rawDb.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down...');
  server.close(() => {
    rawDb.close();
    process.exit(0);
  });
});
