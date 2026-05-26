// Authoritative patient_id resolution.
//
// До v4.0 этот middleware читал patient_id из заголовка X-Patient-Id
// (управляется клиентом) с дефолтом 1. В single-user режиме это было OK,
// но при multi-user это критическая дыра: любой залогиненный friend мог
// поставить X-Patient-Id: 1 и читать данные другого пациента (включая
// admin'а).
//
// Новая логика:
//
//   1. req.user есть (login-password сессия):
//      - role === 'admin'  → header можно использовать для override
//                            (для админских cross-patient запросов).
//      - role === 'user'   → patient_id СТРОГО из req.user.patient_id,
//                            header игнорируется. Это и есть фикс.
//
//   2. req.session есть, но req.user нет (legacy PIN-сессия, до миграции):
//      header можно (это владелец, у него и так full access).
//
//   3. Ни session, ни user (admin token Bearer, dev mode, публичные
//      endpoint-ы вроде /health, /auth/*): header можно, дефолт 1
//      (back-compat для AI Coordinator который дёргает /api/admin/tools/*
//      с ADMIN_TOKEN и X-Patient-Id).
//
// Header принимается из X-Patient-Id или query ?patient_id=N. Запись
// в req.patientId — все 57+ потребителей читают именно его.
function patientIdMiddleware(req, _res, next) {
  const headerVal = parseInt(req.headers['x-patient-id'] || req.query.patient_id, 10);
  const headerPid = headerVal > 0 ? headerVal : null;

  // Case 1: аутентифицированный multi-user
  if (req.user) {
    if (req.user.role === 'admin') {
      req.patientId = headerPid || req.user.patient_id;
    } else {
      // Non-admin: жёсткая привязка к собственному patient.
      // Если клиент попытался override-нуть header-ом — игнорируем
      // молча. Логирование в audit_log можно добавить позже если
      // нужен сигнал «кто-то пытается».
      req.patientId = req.user.patient_id;
    }
    return next();
  }

  // Case 2: session есть, user нет → legacy PIN admin (это ты до миграции)
  if (req.session) {
    req.patientId = headerPid || req.session.patient_id || 1;
    return next();
  }

  // Case 3: нет session — admin token bearer / dev mode / публичные endpoint-ы
  req.patientId = headerPid || 1;
  next();
}

module.exports = { patientIdMiddleware };
