const { Router } = require('express');
const pool = require('../db');
const { requireAiEnabled } = require('../middleware/auth');

const router = Router();

// GET /api/ai-requests — get all requests (optionally filter by status)
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const conditions = ['patient_id = $1'];
    const params = [req.patientId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`status = $${paramIndex++}`);
      params.push(status);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await pool.query(
      `SELECT * FROM ai_requests ${where} ORDER BY created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('Error fetching ai_requests:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// POST /api/ai-requests — create a new request.
// Защищено requireAiEnabled: только юзеры с users.ai_enabled=1 могут
// триггерить AI-обработку (контроль costs / privacy для friends).
// Legacy PIN-сессии без user_id пропускаются как admin (это владелец).
router.post('/', requireAiEnabled, async (req, res) => {
  try {
    const { entity_type, entity_id } = req.body;
    if (!entity_type || !entity_id) {
      return res.status(400).json({ error: 'entity_type and entity_id required' });
    }

    // Check if there's already a pending request for same entity
    const { rows: existing } = await pool.query(
      `SELECT id FROM ai_requests WHERE entity_type = $1 AND entity_id = $2 AND status = 'pending' AND patient_id = $3`,
      [entity_type, entity_id, req.patientId]
    );
    if (existing.length > 0) {
      return res.json({ id: existing[0].id, already_exists: true });
    }

    const { rows } = await pool.query(
      `INSERT INTO ai_requests (entity_type, entity_id, patient_id) VALUES ($1, $2, $3) RETURNING *`,
      [entity_type, entity_id, req.patientId]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Error creating ai_request:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// PUT /api/ai-requests/:id — update status (e.g. mark as completed)
router.put('/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const completedAt = status === 'completed' ? new Date().toISOString() : null;
    const { rows } = await pool.query(
      `UPDATE ai_requests SET status = $1, completed_at = $2 WHERE id = $3 RETURNING *`,
      [status, completedAt, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Error updating ai_request:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

// DELETE /api/ai-requests/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM ai_requests WHERE id = $1', [req.params.id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Request not found' });
    }
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Error deleting ai_request:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
