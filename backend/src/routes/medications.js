const { Router } = require('express');
const pool = require('../db');
const { validate, required } = require('../middleware/validate');

const router = Router();

// GET /api/medications
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let query = `SELECT m.*, s.full_name as specialist_name_resolved, s.specialization as specialist_specialty
                  FROM medications m
                  LEFT JOIN specialists s ON m.specialist_id = s.id
                  WHERE m.patient_id = $1 ORDER BY m.created_at DESC`;
    const params = [req.patientId];

    if (status) {
      query = `SELECT m.*, s.full_name as specialist_name_resolved, s.specialization as specialist_specialty
               FROM medications m
               LEFT JOIN specialists s ON m.specialist_id = s.id
               WHERE m.patient_id = $1 AND m.status = $2 ORDER BY m.created_at DESC`;
      params.push(status);
    }

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Ошибка получения препаратов:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/medications/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM medications WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Препарат не найден' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Ошибка получения препарата:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/medications
router.post('/', validate(required('name')), async (req, res) => {
  try {
    const { name, dosage, frequency, status, start_date, end_date, prescribed_by, specialist_id, notes, detail, ai_assessment, stop_reason } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO medications (name, dosage, frequency, status, start_date, end_date, prescribed_by, specialist_id, notes, detail, ai_assessment, stop_reason, patient_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [name, dosage, frequency, status || 'active', start_date, end_date, prescribed_by, specialist_id || null, notes, detail, ai_assessment, stop_reason || null, req.patientId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Ошибка создания препарата:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/medications/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, dosage, frequency, status, start_date, end_date, prescribed_by, specialist_id, notes, detail, ai_assessment, stop_reason } = req.body;
    const { rows } = await pool.query(
      `UPDATE medications
       SET name = $1, dosage = $2, frequency = $3, status = $4,
           start_date = $5, end_date = $6, prescribed_by = $7,
           specialist_id = $8, notes = $9, detail = $10,
           ai_assessment = $11, stop_reason = $12, updated_at = NOW()
       WHERE id = $13
       RETURNING *`,
      [name, dosage, frequency, status, start_date, end_date, prescribed_by, specialist_id || null, notes, detail, ai_assessment, stop_reason || null, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Препарат не найден' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Ошибка обновления препарата:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/medications/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM medications WHERE id = $1', [req.params.id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Препарат не найден' });
    }
    res.json({ message: 'Препарат удалён' });
  } catch (err) {
    console.error('Ошибка удаления препарата:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
