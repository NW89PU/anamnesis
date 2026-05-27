const { rawDb } = require('../db');

// Authoritative patient_id resolution.
//
// v4.1: user может владеть N пациентами (patient.owner_user_id). req.patientId
// = (1) X-Patient-Id header / query, (2) session.patient_id (active patient),
// (3) первый owned patient, (4) null если ни одного.
//
// Безопасность:
//   - admin (req.user.role='admin' или нет req.user — admin-token bearer)
//     → header можно использовать для override без ownership check
//   - user (req.user.role='user') → patient_id из header допустим только
//     если этот patient owned юзером, иначе 403. Без header — session.patient_id
//     (тоже проверяется на ownership) или первый owned.
function patientIdMiddleware(req, res, next) {
  const headerVal = parseInt(req.headers['x-patient-id'] || req.query.patient_id, 10);
  const headerPid = headerVal > 0 ? headerVal : null;

  // Case A: admin / admin-token-bearer / нет user — header может override
  if (!req.user || req.user.role === 'admin') {
    req.patientId = headerPid
      || (req.session && req.session.patient_id)
      || null;
    // Для admin-token-bearer без session — default 1 для backward compat
    if (req.patientId == null && !req.user && !req.session) req.patientId = 1;
    return next();
  }

  // Case B: regular user — нужна ownership-проверка
  const userId = req.user.id;

  // Сначала пытаемся header (если задан) — но проверяем ownership
  if (headerPid != null) {
    const owned = rawDb.prepare(
      'SELECT id FROM patient WHERE id = ? AND owner_user_id = ?'
    ).get(headerPid, userId);
    if (!owned) {
      return res.status(403).json({ error: 'Нет доступа к этому пациенту' });
    }
    req.patientId = headerPid;
    return next();
  }

  // Без header — берём active из session (проверяем что owned, на случай
  // если удалили или утратили доступ после установки)
  if (req.session && req.session.patient_id) {
    const owned = rawDb.prepare(
      'SELECT id FROM patient WHERE id = ? AND owner_user_id = ?'
    ).get(req.session.patient_id, userId);
    if (owned) {
      req.patientId = req.session.patient_id;
      return next();
    }
  }

  // Fallback — первый owned patient
  const first = rawDb.prepare(
    'SELECT id FROM patient WHERE owner_user_id = ? ORDER BY id LIMIT 1'
  ).get(userId);
  req.patientId = first ? first.id : null;
  next();
}

module.exports = { patientIdMiddleware };
