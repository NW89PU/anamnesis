const { Router } = require('express');
const pool = require('../db');

const router = Router();

// GET /api/specialists
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM specialists WHERE patient_id = $1 ORDER BY created_at DESC';
    const params = [req.patientId];

    if (status) {
      query = 'SELECT * FROM specialists WHERE patient_id = $1 AND status = $2 ORDER BY created_at DESC';
      params.push(status);
    }

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Ошибка получения специалистов:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/specialists/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM specialists WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Специалист не найден' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Ошибка получения специалиста:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/specialists
router.post('/', async (req, res) => {
  try {
    const { full_name, specialization, clinic, phone, email, status, notes } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO specialists (full_name, specialization, clinic, phone, email, status, notes, patient_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [full_name, specialization, clinic, phone, email, status || 'active', notes, req.patientId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Ошибка создания специалиста:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/specialists/:id
router.put('/:id', async (req, res) => {
  try {
    const { full_name, specialization, clinic, phone, email, status, notes } = req.body;
    const { rows } = await pool.query(
      `UPDATE specialists
       SET full_name = $1, specialization = $2, clinic = $3, phone = $4,
           email = $5, status = $6, notes = $7, updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [full_name, specialization, clinic, phone, email, status, notes, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Специалист не найден' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Ошибка обновления специалиста:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/specialists/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM specialists WHERE id = $1', [req.params.id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Специалист не найден' });
    }
    res.json({ message: 'Специалист удалён' });
  } catch (err) {
    console.error('Ошибка удаления специалиста:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
