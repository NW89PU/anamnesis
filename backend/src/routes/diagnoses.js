const { Router } = require('express');
const pool = require('../db');
const { validate, required } = require('../middleware/validate');

const router = Router();

// GET /api/diagnoses
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM diagnoses WHERE patient_id = $1 ORDER BY created_at DESC';
    const params = [req.patientId];

    if (status) {
      query = 'SELECT * FROM diagnoses WHERE patient_id = $1 AND status = $2 ORDER BY created_at DESC';
      params.push(status);
    }

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Ошибка получения диагнозов:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/diagnoses/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM diagnoses WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Диагноз не найден' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Ошибка получения диагноза:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/diagnoses
router.post('/', validate(required('name')), async (req, res) => {
  try {
    const { name, icd_code, status, diagnosed_date, notes } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO diagnoses (name, icd_code, status, diagnosed_date, notes, patient_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, icd_code, status || 'active', diagnosed_date, notes, req.patientId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Ошибка создания диагноза:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/diagnoses/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, icd_code, status, diagnosed_date, notes } = req.body;
    const { rows } = await pool.query(
      `UPDATE diagnoses
       SET name = $1, icd_code = $2, status = $3, diagnosed_date = $4,
           notes = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [name, icd_code, status, diagnosed_date, notes, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Диагноз не найден' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Ошибка обновления диагноза:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/diagnoses/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM diagnoses WHERE id = $1', [req.params.id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Диагноз не найден' });
    }
    res.json({ message: 'Диагноз удалён' });
  } catch (err) {
    console.error('Ошибка удаления диагноза:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
