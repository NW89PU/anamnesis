const { Router } = require('express');
const pool = require('../db');

const router = Router();

// GET /api/patient/list — все пациенты
router.get('/list', async (_req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, full_name, date_of_birth, gender, city FROM patient ORDER BY id');
    res.json(rows);
  } catch (err) {
    console.error('Ошибка получения списка пациентов:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/patient — текущий пациент (по X-Patient-Id)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM patient WHERE id = $1', [req.patientId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Пациент не найден' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Ошибка получения пациента:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/patient — создать нового пациента
router.post('/', async (req, res) => {
  try {
    const { full_name, date_of_birth, gender, blood_type, allergies, notes, city } = req.body;
    if (!full_name) {
      return res.status(400).json({ error: 'full_name обязателен' });
    }
    const { rows } = await pool.query(
      `INSERT INTO patient (full_name, date_of_birth, gender, blood_type, allergies, notes, city)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [full_name, date_of_birth, gender, blood_type, allergies, notes, city]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Ошибка создания пациента:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/patient — обновить текущего пациента
router.put('/', async (req, res) => {
  try {
    const { full_name, date_of_birth, gender, blood_type, allergies, notes, city } = req.body;
    const { rows } = await pool.query(
      `UPDATE patient
       SET full_name = $1, date_of_birth = $2, gender = $3,
           blood_type = $4, allergies = $5, notes = $6, city = $7,
           updated_at = NOW()
       WHERE id = $8
       RETURNING *`,
      [full_name, date_of_birth, gender, blood_type, allergies, notes, city, req.patientId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Пациент не найден' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Ошибка обновления пациента:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
