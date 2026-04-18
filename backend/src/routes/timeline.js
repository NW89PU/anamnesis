const { Router } = require('express');
const pool = require('../db');

const router = Router();

// GET /api/timeline
router.get('/', async (req, res) => {
  try {
    const { from, to, category } = req.query;
    const conditions = ['t.patient_id = $1'];
    const params = [req.patientId];
    let paramIndex = 2;

    if (from) {
      conditions.push(`t.event_date >= $${paramIndex++}`);
      params.push(from);
    }
    if (to) {
      conditions.push(`t.event_date <= $${paramIndex++}`);
      params.push(to);
    }
    if (category) {
      conditions.push(`t.category = $${paramIndex++}`);
      params.push(category);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const query = `SELECT t.*, s.full_name as specialist_name_resolved, s.specialization as specialist_specialty
                   FROM timeline t
                   LEFT JOIN specialists s ON t.specialist_id = s.id
                   ${where}
                   ORDER BY t.event_date DESC`;

    const { rows } = await pool.query(query, params);

    // Подгружаем документы для каждого события
    const { rows: docs } = await pool.query('SELECT * FROM documents WHERE timeline_id IS NOT NULL AND patient_id = $1 ORDER BY id', [req.patientId]);
    const docsByTimeline = {};
    for (const doc of docs) {
      if (!docsByTimeline[doc.timeline_id]) docsByTimeline[doc.timeline_id] = [];
      docsByTimeline[doc.timeline_id].push(doc);
    }

    const result = rows.map(row => ({
      ...row,
      documents: docsByTimeline[row.id] || [],
    }));

    res.json(result);
  } catch (err) {
    console.error('Ошибка получения таймлайна:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/timeline/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM timeline WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Событие не найдено' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Ошибка получения события:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/timeline
router.post('/', async (req, res) => {
  try {
    const { title, description, category, event_date, notes, specialist_name, specialist_type, specialist_id, transcription, ai_assessment } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO timeline (title, description, category, event_date, notes, specialist_name, specialist_type, specialist_id, transcription, ai_assessment, patient_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [title, description, category, event_date, notes, specialist_name || null, specialist_type || null, specialist_id || null, transcription || null, ai_assessment || null, req.patientId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Ошибка создания события:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/timeline/:id
router.put('/:id', async (req, res) => {
  try {
    const { title, description, category, event_date, notes, specialist_name, specialist_type, specialist_id, transcription, ai_assessment } = req.body;
    const { rows } = await pool.query(
      `UPDATE timeline
       SET title = $1, description = $2, category = $3,
           event_date = $4, notes = $5, specialist_name = $6,
           specialist_type = $7, specialist_id = $8,
           transcription = $9, ai_assessment = $10, updated_at = NOW()
       WHERE id = $11
       RETURNING *`,
      [title, description, category, event_date, notes, specialist_name || null, specialist_type || null, specialist_id || null, transcription || null, ai_assessment || null, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Событие не найдено' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Ошибка обновления события:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/timeline/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM timeline WHERE id = $1', [req.params.id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Событие не найдено' });
    }
    res.json({ message: 'Событие удалено' });
  } catch (err) {
    console.error('Ошибка удаления события:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
