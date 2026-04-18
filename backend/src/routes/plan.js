const { Router } = require('express');
const pool = require('../db');
const { rawDb } = require('../db');
const { validate, required, isIn } = require('../middleware/validate');

const router = Router();

// GET /api/plan
router.get('/', async (req, res) => {
  try {
    const { status, priority } = req.query;
    const conditions = ['patient_id = $1'];
    const params = [req.patientId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }
    if (priority) {
      conditions.push(`priority = $${paramIndex++}`);
      params.push(priority);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT * FROM plan ${where} ORDER BY sort_order ASC, created_at DESC`;

    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('Ошибка получения плана:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/plan/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM plan WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Элемент плана не найден' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Ошибка получения элемента плана:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/plan
router.post('/',
  validate(
    required('title'),
    isIn('priority', ['urgent', 'high', 'medium']),
    isIn('status', ['pending', 'in_progress', 'done'])
  ),
  async (req, res) => {
  try {
    const { title, description, status, priority, due_date, sort_order, notes, outcome } = req.body;
    const completed_at = (status === 'done') ? new Date().toISOString() : null;
    const { rows } = await pool.query(
      `INSERT INTO plan (title, description, status, priority, due_date, sort_order, notes, outcome, completed_at, patient_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [title, description, status || 'pending', priority || 'medium', due_date, sort_order || 0, notes, outcome || null, completed_at, req.patientId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Ошибка создания элемента плана:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/plan/reorder — пакетное обновление sort_order
router.put('/reorder', async (req, res) => {
  try {
    const { items } = req.body; // [{ id, sort_order }, ...]
    if (!Array.isArray(items)) {
      return res.status(400).json({ error: 'Поле items должно быть массивом' });
    }

    const reorder = rawDb.transaction((items) => {
      const stmt = rawDb.prepare("UPDATE plan SET sort_order = ?, updated_at = datetime('now') WHERE id = ?");
      for (const item of items) {
        stmt.run(item.sort_order, item.id);
      }
    });
    reorder(items);

    res.json({ message: 'Порядок обновлён' });
  } catch (err) {
    console.error('Ошибка обновления порядка:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/plan/:id
router.put('/:id', async (req, res) => {
  try {
    const { title, description, status, priority, due_date, sort_order, notes, outcome } = req.body;
    const completed_at = (status === 'done') ? new Date().toISOString() : null;
    const { rows } = await pool.query(
      `UPDATE plan
       SET title = $1, description = $2, status = $3, priority = $4,
           due_date = $5, sort_order = $6, notes = $7, outcome = $8,
           completed_at = $9, updated_at = NOW()
       WHERE id = $10
       RETURNING *`,
      [title, description, status, priority, due_date, sort_order, notes, outcome || null, completed_at, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Элемент плана не найден' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Ошибка обновления элемента плана:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/plan/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM plan WHERE id = $1', [req.params.id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Элемент плана не найден' });
    }
    res.json({ message: 'Элемент плана удалён' });
  } catch (err) {
    console.error('Ошибка удаления элемента плана:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
