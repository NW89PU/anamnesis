// GET /api/history — автоматическая история изменений per-patient.
//
// Читает из audit_log, рендерит через services/changelog.js в человекочитаемый
// формат с группировкой по датам и близким по времени правкам одной сущности.

const { Router } = require('express');
const { getHistory } = require('../services/changelog');

const router = Router();

router.get('/', (req, res) => {
  try {
    const patientId = req.patientId || 1;
    const limit = Math.min(parseInt(req.query.limit || '100', 10), 500);
    const offset = Math.max(parseInt(req.query.offset || '0', 10), 0);
    const since = req.query.since || null;

    const result = getHistory({ patientId, limit, offset, since });
    res.json(result);
  } catch (err) {
    console.error('[history] error:', err);
    res.status(500).json({ error: 'Ошибка получения истории' });
  }
});

module.exports = router;
