const { Router } = require('express');
const { rawDb } = require('../db');

const router = Router();

// GET /api/search?q=текст
router.get('/', (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json({ results: [] });
    }

    const like = `%${q}%`;
    const pid = req.patientId;
    const results = [];

    const diagnoses = rawDb.prepare(
      `SELECT id, name, icd_code, status, 'diagnosis' as _type FROM diagnoses
       WHERE patient_id = ? AND (name LIKE ? OR icd_code LIKE ? OR notes LIKE ?) LIMIT 10`
    ).all(pid, like, like, like);
    results.push(...diagnoses);

    const medications = rawDb.prepare(
      `SELECT id, name, dosage, status, 'medication' as _type FROM medications
       WHERE patient_id = ? AND (name LIKE ? OR dosage LIKE ? OR notes LIKE ?) LIMIT 10`
    ).all(pid, like, like, like);
    results.push(...medications);

    const plan = rawDb.prepare(
      `SELECT id, title as name, priority, status, 'plan' as _type FROM plan
       WHERE patient_id = ? AND (title LIKE ? OR description LIKE ? OR notes LIKE ?) LIMIT 10`
    ).all(pid, like, like, like);
    results.push(...plan);

    const errors = rawDb.prepare(
      `SELECT id, title as name, severity, status, 'error' as _type FROM medical_errors
       WHERE patient_id = ? AND (title LIKE ? OR description LIKE ? OR notes LIKE ?) LIMIT 10`
    ).all(pid, like, like, like);
    results.push(...errors);

    const timeline = rawDb.prepare(
      `SELECT id, title as name, category, 'timeline' as _type FROM timeline
       WHERE patient_id = ? AND (title LIKE ? OR description LIKE ? OR notes LIKE ?) LIMIT 10`
    ).all(pid, like, like, like);
    results.push(...timeline);

    const specialists = rawDb.prepare(
      `SELECT id, full_name as name, specialization, 'specialist' as _type FROM specialists
       WHERE patient_id = ? AND (full_name LIKE ? OR specialization LIKE ? OR clinic LIKE ?) LIMIT 10`
    ).all(pid, like, like, like);
    results.push(...specialists);

    const documents = rawDb.prepare(
      `SELECT id, title as name, category, 'document' as _type FROM documents
       WHERE patient_id = ? AND (title LIKE ? OR original_name LIKE ? OR notes LIKE ? OR transcription LIKE ?) LIMIT 10`
    ).all(pid, like, like, like, like);
    results.push(...documents);

    const vaccinations = rawDb.prepare(
      `SELECT id, name, status, 'vaccination' as _type FROM vaccinations
       WHERE patient_id = ? AND (name LIKE ? OR vaccine_name LIKE ? OR notes LIKE ?) LIMIT 10`
    ).all(pid, like, like, like);
    results.push(...vaccinations);

    res.json({ results, query: q });
  } catch (err) {
    console.error('Ошибка поиска:', err);
    res.status(500).json({ error: 'Ошибка поиска' });
  }
});

module.exports = router;
