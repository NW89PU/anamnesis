const { Router } = require('express');
const pool = require('../db');

const router = Router();

// v4.1: patient теперь принадлежит конкретному user (patient.owner_user_id).
// Admin видит всех пациентов; non-admin — только своих. req.user приходит
// из session middleware. Если req.user отсутствует (legacy/admin token) —
// поведение как admin для backward compat с AI Coordinator (через ADMIN_TOKEN).

function isAdminRequest(req) {
  return !req.user || req.user.role === 'admin';
}

// GET /api/patient/list — patients доступные текущему user-у
router.get('/list', async (req, res) => {
  try {
    let rows;
    if (isAdminRequest(req)) {
      rows = pool.query(
        'SELECT id, full_name, date_of_birth, gender, relationship, owner_user_id FROM patient ORDER BY id'
      ).rows;
    } else {
      rows = pool.query(
        'SELECT id, full_name, date_of_birth, gender, relationship FROM patient ' +
        'WHERE owner_user_id = $1 ORDER BY id',
        [req.user.id]
      ).rows;
    }
    res.json(rows);
  } catch (err) {
    console.error('Ошибка получения списка пациентов:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/patient — текущий пациент (по req.patientId из session/middleware)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM patient WHERE id = $1', [req.patientId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Пациент не найден' });
    }
    const patient = rows[0];
    // Проверяем ownership: non-admin может видеть только своих
    if (!isAdminRequest(req) && patient.owner_user_id !== req.user.id) {
      return res.status(403).json({ error: 'Нет доступа к этому пациенту' });
    }
    res.json(patient);
  } catch (err) {
    console.error('Ошибка получения пациента:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/patient — создать нового пациента. owner_user_id берётся из session.
router.post('/', async (req, res) => {
  try {
    const { full_name, date_of_birth, gender, blood_type, allergies, notes, city, relationship } = req.body;
    if (!full_name || String(full_name).trim().length < 2) {
      return res.status(400).json({ error: 'full_name обязателен (минимум 2 символа)' });
    }
    if (!req.user) {
      // Admin-token-bearer (без session) тоже может создавать — но тогда
      // owner_user_id = null (orphan patient). Это для AI Coordinator
      // bootstrap до того как реальный юзер логинется.
      const { rows } = await pool.query(
        `INSERT INTO patient (full_name, date_of_birth, gender, blood_type, allergies, notes, city, relationship)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [full_name, date_of_birth || null, gender || null, blood_type || null,
         allergies || null, notes || null, city || null, relationship || null]
      );
      return res.status(201).json(rows[0]);
    }
    const { rows } = await pool.query(
      `INSERT INTO patient (full_name, date_of_birth, gender, blood_type, allergies, notes, city, relationship, owner_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [full_name, date_of_birth || null, gender || null, blood_type || null,
       allergies || null, notes || null, city || null, relationship || null, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Ошибка создания пациента:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// PUT /api/patient — обновить активного пациента (по req.patientId).
// Проверяет ownership для non-admin.
router.put('/', async (req, res) => {
  try {
    if (!isAdminRequest(req)) {
      const owned = pool.query(
        'SELECT id FROM patient WHERE id = $1 AND owner_user_id = $2',
        [req.patientId, req.user.id]
      ).rows;
      if (owned.length === 0) {
        return res.status(403).json({ error: 'Нет доступа к этому пациенту' });
      }
    }
    const { full_name, date_of_birth, gender, blood_type, allergies, notes, city, relationship } = req.body;
    const { rows } = await pool.query(
      `UPDATE patient
       SET full_name = $1, date_of_birth = $2, gender = $3,
           blood_type = $4, allergies = $5, notes = $6, city = $7, relationship = $8,
           updated_at = NOW()
       WHERE id = $9
       RETURNING *`,
      [full_name, date_of_birth, gender, blood_type, allergies, notes, city, relationship, req.patientId]
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

// DELETE /api/patient/:id — удалить пациента (cascade удалит всё его barahло).
router.delete('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Bad id' });

    if (!isAdminRequest(req)) {
      const owned = pool.query(
        'SELECT id FROM patient WHERE id = $1 AND owner_user_id = $2',
        [id, req.user.id]
      ).rows;
      if (owned.length === 0) {
        return res.status(403).json({ error: 'Нет доступа к этому пациенту' });
      }
    }

    const { rowCount } = await pool.query('DELETE FROM patient WHERE id = $1', [id]);
    if (rowCount === 0) return res.status(404).json({ error: 'Пациент не найден' });

    // Если удалили active patient текущей session — сбросим её patient_id
    // чтобы UI вернулся в PatientPicker
    pool.query('UPDATE sessions SET patient_id = NULL WHERE patient_id = $1', [id]);

    res.json({ ok: true, deleted_id: id });
  } catch (err) {
    console.error('Ошибка удаления пациента:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
