const { Router } = require('express');
const pool = require('../db');
const { validate, required } = require('../middleware/validate');

const router = Router();

// GET /api/growth
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM growth_log WHERE patient_id = $1 ORDER BY measured_at DESC', [req.patientId]);
    res.json(rows);
  } catch (err) {
    console.error('Ошибка получения измерений:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/growth/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM growth_log WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Измерение не найдено' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Ошибка получения измерения:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/growth
router.post('/',
  validate(required('measured_at')),
  async (req, res) => {
    try {
      const { measured_at, height_cm, weight_kg, head_circumference_cm, notes } = req.body;
      const { rows } = await pool.query(
        `INSERT INTO growth_log (measured_at, height_cm, weight_kg, head_circumference_cm, notes, patient_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [measured_at, height_cm, weight_kg, head_circumference_cm, notes, req.patientId]
      );

      // Update patient current height/weight
      if (height_cm || weight_kg) {
        const sets = [];
        const vals = [];
        if (height_cm) { sets.push('current_height_cm = ?'); vals.push(height_cm); }
        if (weight_kg) { sets.push('current_weight_kg = ?'); vals.push(weight_kg); }
        if (sets.length > 0) {
          const { rawDb } = require('../db');
          rawDb.prepare(`UPDATE patient SET ${sets.join(', ')} WHERE id = ?`).run(...vals, req.patientId);
        }
      }

      res.status(201).json(rows[0]);
    } catch (err) {
      console.error('Ошибка создания измерения:', err);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }
);

// PUT /api/growth/:id
router.put('/:id', async (req, res) => {
  try {
    const { measured_at, height_cm, weight_kg, head_circumference_cm, notes } = req.body;
    const { rows } = await pool.query(
      `UPDATE growth_log
       SET measured_at = $1, height_cm = $2, weight_kg = $3, head_circumference_cm = $4, notes = $5
       WHERE id = $6
       RETURNING *`,
      [measured_at, height_cm, weight_kg, head_circumference_cm, notes, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Измерение не найдено' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Ошибка обновления измерения:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/growth/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM growth_log WHERE id = $1', [req.params.id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Измерение не найдено' });
    }
    res.json({ message: 'Измерение удалено' });
  } catch (err) {
    console.error('Ошибка удаления измерения:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
