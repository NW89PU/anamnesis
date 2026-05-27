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
const { authMiddleware, adminAuthMiddleware, requireAiEnabled } = require('./middleware/auth');
const { patientIdMiddleware } = require('./middleware/patientId');
const { cfAccessMiddleware } = require('./middleware/cf-access');
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

// v4.1: единственный точка входа auth — /auth/cf-bootstrap (CF JWT).
// PIN/password/webauthn endpoint-ы удалены. Лимит сохраняем чтобы спам
// bootstrap-ом не клал JWKS lookup.
app.use('/api/auth/cf-bootstrap', authLimiter);
app.use('/api/admin/tools/sql', sqlLimiter);
app.use('/api/', apiLimiter);

// CF Access middleware — валидирует Cf-Access-Jwt-Assertion если включён.
// Off by default (нет CF_ACCESS_TEAM_DOMAIN/AUD в .env) → pass-through.
// Когда включён — кладёт req.cfEmail. Используется в /api/auth/register
// как trusted источник email-а. Подключаем ДО session-middleware чтобы
// доступно везде downstream.
app.use('/api/', cfAccessMiddleware);

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

// ── v4.1 auth: Google via Cloudflare Access ──
//
// Единственная точка входа — POST /api/auth/cf-bootstrap. CF Access
// JWT валидирован в cfAccessMiddleware (выше) → req.cfEmail доступен.
// Backend upsert-ит users-запись по email и создаёт session token.
// Никаких паролей, PIN, security questions, WebAuthn — всё это
// удалено в этой ревизии.

function clientIp(req) {
  return (req.headers['x-forwarded-for']?.split(',')[0].trim()) || req.socket?.remoteAddress || null;
}
function userAgent(req) {
  return req.headers['user-agent']?.slice(0, 300) || null;
}

// POST /api/auth/cf-bootstrap — создать session из CF Access JWT.
// Это единственная точка входа в систему. CF Access уже валидировал
// JWT в cfAccessMiddleware, в req.cfEmail лежит trusted email юзера.
// Backend upsert-ит users-запись и создаёт session token.
app.post('/api/auth/cf-bootstrap', (req, res) => {
  if (!req.cfEmail) {
    return res.status(403).json({
      error: 'Cloudflare Access не предоставил email. ' +
             'Проверьте что Google identity provider настроен и app domain корректный.',
    });
  }
  const ip = clientIp(req);
  const ua = userAgent(req);
  const deviceId = req.headers['x-device-id'] || null;
  try {
    const user = authSession.findOrCreateUserFromCfEmail(req.cfEmail, config);
    // patientId=null в session означает «активный пациент не выбран».
    // Frontend покажет PatientPickerScreen и через POST /api/auth/active-patient
    // обновит session перед началом работы.
    const token = authSession.createSession(null, ip, ua, deviceId, user.id);
    authSession.logAuthEvent('cf_bootstrap', ip, ua, { user_id: user.id, email: user.email });
    const patients = rawDb.prepare(
      'SELECT id, full_name, date_of_birth, gender, relationship FROM patient ' +
      'WHERE owner_user_id = ? ORDER BY id'
    ).all(user.id);
    res.status(201).json({
      token,
      expires_days: authSession.SESSION_MAX_AGE_DAYS,
      user: {
        id: user.id, email: user.email, role: user.role,
        ai_enabled: !!user.ai_enabled, last_login_at: user.last_login_at,
      },
      patients,
      active_patient_id: null,
    });
  } catch (err) {
    console.error('[auth] cf-bootstrap error:', err);
    res.status(500).json({ error: 'Ошибка авторизации' });
  }
});

// POST /api/auth/active-patient — обновить активного пациента в session.
// Body: { patient_id: number | null }. Проверяет ownership (admin может всех).
app.post('/api/auth/active-patient', (req, res) => {
  const token = req.headers['x-session-token'];
  const sess = authSession.getSession(token);
  if (!sess || !sess.user_id) return res.status(401).json({ error: 'Требуется авторизация' });

  const { patient_id } = req.body || {};
  const pid = patient_id == null ? null : parseInt(patient_id, 10);
  if (patient_id != null && (!Number.isInteger(pid) || pid <= 0)) {
    return res.status(400).json({ error: 'patient_id должен быть положительным числом или null' });
  }

  const user = authSession.getUserById(sess.user_id);
  if (pid != null && user.role !== 'admin') {
    const owned = rawDb.prepare(
      'SELECT id FROM patient WHERE id = ? AND owner_user_id = ?'
    ).get(pid, user.id);
    if (!owned) return res.status(403).json({ error: 'Нет доступа к этому пациенту' });
  }

  // 0 = sentinel «не выбран» (sessions.patient_id NOT NULL)
  rawDb.prepare('UPDATE sessions SET patient_id = ? WHERE token = ?').run(pid == null ? 0 : pid, token);
  res.json({ ok: true, active_patient_id: pid });
});

// ── Удалены v4.1: PIN-login, verify-device, set-security-question,
//                  security-status, revoke-device ────────────
// Все они заменены на cf-bootstrap выше — Google OAuth через CF Access
// единственный путь входа.

// GET /api/auth/check — verify session is still valid (v4.1 semantics)
app.get('/api/auth/check', (req, res) => {
  const token = req.headers['x-session-token'];
  const sess = authSession.getSession(token);
  if (sess) {
    authSession.touchSession(token, clientIp(req));
    return res.json({ valid: true, expires_at: sess.expires_at });
  }
  // Если есть валидный CF JWT — сигналим клиенту что нужен bootstrap.
  if (req.cfEmail) {
    return res.status(401).json({ valid: false, needs_bootstrap: true });
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

// POST /api/auth/logout-all — ревокация ВСЕХ сессий текущего user кроме этой
app.post('/api/auth/logout-all', (req, res) => {
  const token = req.headers['x-session-token'];
  const sess = authSession.getSession(token);
  if (!sess || !sess.user_id) return res.status(401).json({ error: 'Требуется авторизация' });
  // v4.1: ревокируем по user_id (а не patient_id — patient теперь много на user)
  rawDb.prepare('UPDATE sessions SET revoked = 1 WHERE user_id = ? AND token != ?')
    .run(sess.user_id, token);
  authSession.logAuthEvent('logout_all', clientIp(req), userAgent(req), { user_id: sess.user_id });
  res.json({ ok: true });
});

// CF Access status — фронт спрашивает чтобы понимать обстановку.
// Если cf_enabled=true и cf_email есть → юзер уже прошёл Google login,
// бэк сам сделает bootstrap при первом /api/me запросе.
app.get('/api/auth/cf-status', (req, res) => {
  res.json({
    cf_enabled: !!(config.CF_ACCESS_TEAM_DOMAIN && config.CF_ACCESS_AUD),
    cf_email: req.cfEmail || null,
  });
});

// GET /api/me — текущий user + список patients + active_patient_id.
// Сигналит needs_bootstrap=true (401) если есть валидный CF JWT но
// нет session — фронту следует вызвать /auth/cf-bootstrap.
app.get('/api/me', (req, res) => {
  const token = req.headers['x-session-token'];
  const sess = authSession.getSession(token);
  if (!sess || !sess.user_id) {
    if (req.cfEmail) return res.status(401).json({ error: 'Требуется bootstrap', needs_bootstrap: true });
    return res.status(401).json({ error: 'Требуется авторизация' });
  }
  const user = authSession.getUserById(sess.user_id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const patients = rawDb.prepare(
    'SELECT id, full_name, date_of_birth, gender, relationship FROM patient ' +
    'WHERE owner_user_id = ? ORDER BY id'
  ).all(user.id);

  res.json({
    user: {
      id: user.id, email: user.email, role: user.role,
      ai_enabled: !!user.ai_enabled, last_login_at: user.last_login_at,
    },
    patients,
    active_patient_id: sess.patient_id || null,
  });
});

// Session middleware — protect all API routes except auth/public ones.
// v4.1: при отсутствии session, но валидном CF JWT — отвечаем 401 с
// needs_bootstrap флагом, чтобы фронт вызвал /auth/cf-bootstrap.
app.use('/api/', (req, res, next) => {
  // Whitelist: public + authentication endpoints
  if (
    req.path === '/auth/check' ||
    req.path === '/auth/logout' ||
    req.path === '/auth/cf-status' ||
    req.path === '/auth/cf-bootstrap' ||
    req.path === '/health'
  ) return next();

  const token = req.headers['x-session-token'] || req.query.token;
  const sess = authSession.getSession(token);
  if (sess) {
    authSession.touchSession(token, clientIp(req));
    req.session = sess;
    if (sess.user_id) {
      const user = authSession.getUserById(sess.user_id);
      if (user) req.user = user;
    }
    return next();
  }
  if (req.cfEmail) {
    return res.status(401).json({ error: 'Требуется bootstrap', needs_bootstrap: true });
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

  // v4.1: users создаются лениво в /auth/cf-bootstrap при первом
  // визите юзера. Backfill из env-vars больше не нужен — admin
  // определяется автоматически если cfEmail совпадает с ANAMNESIS_ADMIN_EMAIL.

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
