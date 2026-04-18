const { Router } = require('express');
const pool = require('../db');
const { rawDb } = require('../db');

const router = Router();

// GET /api/dashboard — aggregated data
router.get('/', async (req, res) => {
  try {
    const pid = req.patientId;
    const [
      patientResult,
      diagnosesResult,
      medicationsResult,
      specialistsResult,
      remindersResult,
      planResult,
      errorsResult,
      docsCountResult,
      planTotalResult,
      planDoneResult,
      errorsOpenResult,
    ] = await Promise.all([
      pool.query('SELECT * FROM patient WHERE id = $1', [pid]),
      pool.query("SELECT * FROM diagnoses WHERE patient_id = $1 AND status = 'active' ORDER BY created_at DESC", [pid]),
      pool.query("SELECT * FROM medications WHERE patient_id = $1 AND status = 'active' ORDER BY created_at DESC", [pid]),
      pool.query("SELECT * FROM specialists WHERE patient_id = $1 AND status = 'active' ORDER BY created_at DESC", [pid]),
      pool.query(
        "SELECT * FROM reminders WHERE patient_id = $1 AND status = 'pending' ORDER BY remind_at ASC LIMIT 10", [pid]
      ),
      pool.query(
        "SELECT * FROM plan WHERE patient_id = $1 AND status IN ('pending', 'in_progress') AND priority IN ('urgent', 'high') ORDER BY sort_order ASC LIMIT 10", [pid]
      ),
      pool.query("SELECT * FROM medical_errors WHERE patient_id = $1 AND status = 'open' ORDER BY created_at DESC", [pid]),
      pool.query("SELECT COUNT(*) AS count FROM documents WHERE patient_id = $1", [pid]),
      pool.query("SELECT COUNT(*) AS count FROM plan WHERE patient_id = $1 AND status != 'done'", [pid]),
      pool.query("SELECT COUNT(*) AS count FROM plan WHERE patient_id = $1 AND status = 'done'", [pid]),
      pool.query("SELECT COUNT(*) AS count FROM medical_errors WHERE patient_id = $1 AND status = 'open'", [pid]),
    ]);

    // New data: upcoming vaccinations, latest growth, lab anomalies
    let upcoming_vaccinations = [];
    let latest_growth = null;
    let lab_anomalies = [];
    try {
      upcoming_vaccinations = rawDb.prepare(
        "SELECT * FROM vaccinations WHERE patient_id = ? AND status = 'scheduled' ORDER BY scheduled_date ASC LIMIT 5"
      ).all(pid);
    } catch(e) {}
    try {
      latest_growth = rawDb.prepare(
        "SELECT * FROM growth_log WHERE patient_id = ? ORDER BY measured_at DESC LIMIT 1"
      ).get(pid) || null;
    } catch(e) {}
    try {
      lab_anomalies = rawDb.prepare(
        "SELECT * FROM lab_results WHERE patient_id = ? AND status IN ('high', 'low', 'critical') ORDER BY test_date DESC LIMIT 5"
      ).all(pid);
    } catch(e) {}

    res.json({
      patient: patientResult.rows[0] || null,
      active_diagnoses: diagnosesResult.rows,
      active_medications: medicationsResult.rows,
      active_specialists: specialistsResult.rows,
      upcoming_reminders: remindersResult.rows,
      urgent_plan_items: planResult.rows,
      open_errors: errorsResult.rows,
      upcoming_vaccinations,
      latest_growth,
      lab_anomalies,
      stats: {
        documents: docsCountResult.rows[0]?.count || 0,
        plan_total: planTotalResult.rows[0]?.count || 0,
        plan_done: planDoneResult.rows[0]?.count || 0,
        errors_open: errorsOpenResult.rows[0]?.count || 0,
        diagnoses: diagnosesResult.rows.length,
        specialists: specialistsResult.rows.length,
        reminders: remindersResult.rows.length,
      },
    });
  } catch (err) {
    console.error('Ошибка получения дашборда:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/dashboard/ai-summary
router.get('/ai-summary', (req, res) => {
  try {
    const key = `ai_summary_${req.patientId}`;
    const row = rawDb.prepare("SELECT value FROM app_settings WHERE key = ?").get(key);
    // Fallback to old key for backwards compatibility
    if (!row && req.patientId === 1) {
      const oldRow = rawDb.prepare("SELECT value FROM app_settings WHERE key = 'ai_summary'").get();
      if (oldRow) {
        const data = JSON.parse(oldRow.value);
        return res.json(data);
      }
    }
    const data = row ? JSON.parse(row.value) : null;
    res.json(data || { summary: '', updated_at: null });
  } catch (err) {
    console.error('Ошибка получения AI-сводки:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/dashboard/ai-summary
router.put('/ai-summary', (req, res) => {
  try {
    const { summary, priorities, next_steps, warnings, updated_at } = req.body;
    const data = JSON.stringify({ summary, priorities, next_steps, warnings, updated_at: updated_at || new Date().toISOString() });
    const key = `ai_summary_${req.patientId}`;
    const existing = rawDb.prepare("SELECT key FROM app_settings WHERE key = ?").get(key);
    if (existing) {
      rawDb.prepare("UPDATE app_settings SET value = ? WHERE key = ?").run(data, key);
    } else {
      rawDb.prepare("INSERT INTO app_settings (key, value) VALUES (?, ?)").run(key, data);
    }
    res.json(JSON.parse(data));
  } catch (err) {
    console.error('Ошибка обновления AI-сводки:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
