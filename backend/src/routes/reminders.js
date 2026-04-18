const { Router } = require('express');
const pool = require('../db');
const { sendMessage } = require('../services/telegram');
const { validate, required } = require('../middleware/validate');

const router = Router();

// GET /api/reminders
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM reminders WHERE patient_id = $1 ORDER BY remind_at ASC', [req.patientId]);
    res.json(rows);
  } catch (err) {
    console.error('Ошибка получения напоминаний:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/reminders/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM reminders WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Напоминание не найдено' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Ошибка получения напоминания:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/reminders
router.post('/', validate(required('title'), required('remind_at')), async (req, res) => {
  try {
    const { title, message, remind_at, repeat_cron, status, notes } = req.body;
    const { rows } = await pool.query(
      `INSERT INTO reminders (title, message, remind_at, repeat_cron, status, notes, patient_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [title, message, remind_at, repeat_cron, status || 'pending', notes, req.patientId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Ошибка создания напоминания:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/reminders/:id
router.put('/:id', async (req, res) => {
  try {
    const { title, message, remind_at, repeat_cron, status, notes } = req.body;
    const { rows } = await pool.query(
      `UPDATE reminders
       SET title = $1, message = $2, remind_at = $3, repeat_cron = $4,
           status = $5, notes = $6, updated_at = NOW()
       WHERE id = $7
       RETURNING *`,
      [title, message, remind_at, repeat_cron, status, notes, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Напоминание не найдено' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Ошибка обновления напоминания:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/reminders/:id/send-now — немедленная отправка
router.post('/:id/send-now', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM reminders WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Напоминание не найдено' });
    }

    const reminder = rows[0];
    const text = `🔔 ${reminder.title}\n${reminder.message || ''}`;
    await sendMessage(text);

    await pool.query(
      `UPDATE reminders SET status = 'sent', sent_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [req.params.id]
    );

    res.json({ message: 'Напоминание отправлено' });
  } catch (err) {
    console.error('Ошибка отправки напоминания:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/reminders/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM reminders WHERE id = $1', [req.params.id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Напоминание не найдено' });
    }
    res.json({ message: 'Напоминание удалено' });
  } catch (err) {
    console.error('Ошибка удаления напоминания:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
