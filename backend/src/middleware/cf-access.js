// Cloudflare Access middleware — outer auth gate.
//
// Когда приложение стоит за Cloudflare Access (Zero Trust), CF добавляет
// заголовок Cf-Access-Jwt-Assertion с подписанным JWT. Этот JWT содержит:
//   - email — кто залогинился через CF identity provider (Google/GitHub/etc)
//   - aud — application audience tag (привязка к конкретному CF приложению)
//   - iss — https://<team>.cloudflareaccess.com
//
// Middleware:
//   1. Если CF_ACCESS_TEAM_DOMAIN и CF_ACCESS_AUD НЕ заданы в .env —
//      pass-through (CF Access off). Текущее поведение не меняется.
//   2. Если заданы — валидирует JWT через JWKS CF (кеш 1 час), проверяет
//      aud, iat, exp. При успехе кладёт req.cfEmail и req.cfClaims.
//   3. На запросах /api/auth/register этот email будет источником
//      identity (юзер не вводит email — он берётся из доверенного JWT).
//
// Важно:
//   - Это НЕ замена in-app auth. CF Access говорит «этот email прошёл
//     внешний шлюз». In-app login (POST /auth/login-password) подтверждает
//     identity локально и создаёт session.
//   - Endpoints НЕ зависят от CF Access кроме /auth/register. Остальные
//     работают через session token как сейчас (session_token в header).
//     CF email просто справочно прокидывается дальше.
//   - В dev режиме (нет env vars) middleware no-op, разрабатывать удобно.
//
// Setup на CF:
//   1. Cloudflare Zero Trust → Access → Applications → Add → Self-hosted
//   2. Application domain: anamnesis.your-domain.com
//   3. Identity providers: Google / email OTP / etc
//   4. Policies: Include → Emails → список друзей
//   5. После создания на странице application видны AUD tag и team domain
//      (https://<team>.cloudflareaccess.com) — их и кладём в .env.

const { createRemoteJWKSet, jwtVerify } = require('jose');
const config = require('../config');

// Кешированный JWKS — sets fetch внутри + повторно использует.
// При первом запросе скачивает /cdn-cgi/access/certs у CF, потом
// держит в памяти и обновляет по жизненному циклу JWT библиотеки.
let jwks = null;
function getJwks() {
  if (jwks) return jwks;
  if (!config.CF_ACCESS_TEAM_DOMAIN) return null;
  const url = new URL(`https://${config.CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`);
  jwks = createRemoteJWKSet(url, {
    // Кеш на 1 час, фоновое обновление за 5 минут до истечения.
    cacheMaxAge: 60 * 60 * 1000,
    cooldownDuration: 30 * 1000,
  });
  return jwks;
}

/**
 * Middleware: валидирует CF Access JWT если фича включена.
 * - Off (нет env) → next() без изменений
 * - On + нет header → next() без cfEmail (это нормально для health check,
 *   статики, и роутов которые не требуют CF). Только /auth/register
 *   проверяет наличие req.cfEmail явно.
 * - On + есть header но JWT битый → 403
 */
async function cfAccessMiddleware(req, res, next) {
  // Off mode — pass through
  if (!config.CF_ACCESS_TEAM_DOMAIN || !config.CF_ACCESS_AUD) {
    return next();
  }

  const token = req.headers['cf-access-jwt-assertion'] || req.headers['cf-access-authenticated-user-token'];
  if (!token) {
    // Header нет — это значит запрос идёт НЕ через CF (например, прямой
    // доступ через Tailscale или localhost). Не блокируем — оставляем
    // решение конкретным роутам. Те, кому нужен CF email, проверят
    // req.cfEmail сами.
    return next();
  }

  try {
    const set = getJwks();
    if (!set) return next(); // misconfig, fail open в режиме когда team нет

    const { payload } = await jwtVerify(token, set, {
      issuer: `https://${config.CF_ACCESS_TEAM_DOMAIN}`,
      audience: config.CF_ACCESS_AUD,
    });

    // CF кладёт email в payload.email (для identity-based policies).
    // Для service-token policies email отсутствует, есть common_name.
    req.cfEmail = payload.email || null;
    req.cfClaims = payload;
    return next();
  } catch (err) {
    // Битый/истёкший JWT — это плохо. Если CF пропустил такой токен,
    // что-то не так с конфигом aud/team. Ответ 403, не next().
    console.error('[cf-access] JWT verify failed:', err.message);
    return res.status(403).json({ error: 'Cloudflare Access verification failed' });
  }
}

module.exports = { cfAccessMiddleware };
