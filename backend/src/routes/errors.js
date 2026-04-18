const { Router } = require('express');
const pool = require('../db');
const { validate, required, isIn } = require('../middleware/validate');

const router = Router();

// GET /api/errors
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM medical_errors WHERE patient_id = $1 ORDER BY created_at DESC', [req.patientId]);
    res.json(rows);
  } catch (err) {
    console.error('Ошибка получения врачебных ошибок:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/errors/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM medical_errors WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Ошибка получения записи:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/errors
router.post('/',
  validate(
    required('title'),
    required('description'),
    isIn('severity', ['critical', 'warning', 'info'])
  ),
  async (req, res) => {
  try {
    const { title, description, severity, status, error_date, specialist_id, notes, resolution } = req.body;
    const resolved_at = (status === 'resolved') ? new Date().toISOString() : null;
    const { rows } = await pool.query(
      `INSERT INTO medical_errors (title, description, severity, status, error_date, specialist_id, notes, resolution, resolved_at, patient_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [title, description, severity || 'medium', status || 'open', error_date, specialist_id, notes, resolution || null, resolved_at, req.patientId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Ошибка создания записи:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/errors/:id
router.put('/:id', async (req, res) => {
  try {
    const { title, description, severity, status, error_date, specialist_id, notes, resolution } = req.body;
    const resolved_at = (status === 'resolved') ? new Date().toISOString() : null;
    const { rows } = await pool.query(
      `UPDATE medical_errors
       SET title = $1, description = $2, severity = $3, status = $4,
           error_date = $5, specialist_id = $6, notes = $7,
           resolution = $8, resolved_at = $9, updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [title, description, severity, status, error_date, specialist_id, notes, resolution || null, resolved_at, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Ошибка обновления записи:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/errors/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM medical_errors WHERE id = $1', [req.params.id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }
    res.json({ message: 'Запись удалена' });
  } catch (err) {
    console.error('Ошибка удаления записи:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
