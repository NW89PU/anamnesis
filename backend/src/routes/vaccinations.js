const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const pool = require('../db');
const { rawDb } = require('../db');
const config = require('../config');
const { validate, required, isIn } = require('../middleware/validate');

const router = Router();

// Multer for vaccination photos
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dir = path.join(config.UPLOAD_DIR, 'vaccinations');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Только изображения и PDF'), false);
    }
  },
});

// ── Section-level photos (vaccination certificates, etc.) ──

const SECTION_PHOTOS_FILE = path.join(config.UPLOAD_DIR, 'vaccinations', '_section_photos.json');

function loadSectionPhotos() {
  try {
    if (fs.existsSync(SECTION_PHOTOS_FILE)) {
      return JSON.parse(fs.readFileSync(SECTION_PHOTOS_FILE, 'utf-8'));
    }
  } catch {}
  return [];
}

function saveSectionPhotos(photos) {
  fs.mkdirSync(path.dirname(SECTION_PHOTOS_FILE), { recursive: true });
  fs.writeFileSync(SECTION_PHOTOS_FILE, JSON.stringify(photos));
}

// GET /api/vaccinations/section-photos
router.get('/section-photos', (_req, res) => {
  res.json({ photos: loadSectionPhotos() });
});

// POST /api/vaccinations/section-photos
router.post('/section-photos', upload.single('photo'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Файл не предоставлен' });
  const photos = loadSectionPhotos();
  const url = `/uploads/vaccinations/${req.file.filename}`;
  photos.push(url);
  saveSectionPhotos(photos);
  res.json({ photos, added: url });
});

// DELETE /api/vaccinations/section-photos
router.delete('/section-photos', (req, res) => {
  const { photo_url } = req.body;
  if (!photo_url) return res.status(400).json({ error: 'photo_url обязателен' });
  let photos = loadSectionPhotos();
  photos = photos.filter(p => p !== photo_url);
  saveSectionPhotos(photos);
  // Delete file
  const filename = path.basename(photo_url);
  const filePath = path.join(config.UPLOAD_DIR, 'vaccinations', filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  res.json({ photos });
});

// ── CRUD ────────────────────────────────────────────────────

// GET /api/vaccinations
router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    let query = 'SELECT * FROM vaccinations WHERE patient_id = $1 ORDER BY scheduled_date ASC';
    const params = [req.patientId];

    if (status) {
      query = 'SELECT * FROM vaccinations WHERE patient_id = $1 AND status = $2 ORDER BY scheduled_date ASC';
      params.push(status);
    }

    const { rows } = await pool.query(query, params);
    // Parse photos JSON
    for (const row of rows) {
      try { row.photos = JSON.parse(row.photos || '[]'); } catch { row.photos = []; }
    }
    res.json(rows);
  } catch (err) {
    console.error('Ошибка получения прививок:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// GET /api/vaccinations/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM vaccinations WHERE id = $1', [req.params.id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Прививка не найдена' });
    }
    const vac = rows[0];
    try { vac.photos = JSON.parse(vac.photos || '[]'); } catch { vac.photos = []; }
    res.json(vac);
  } catch (err) {
    console.error('Ошибка получения прививки:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/vaccinations
router.post('/',
  validate(
    required('name'),
    isIn('status', ['scheduled', 'done', 'skipped', 'postponed'])
  ),
  async (req, res) => {
    try {
      const { name, vaccine_name, dose_number, scheduled_date, actual_date, status, administered_by, batch_number, reaction, notes } = req.body;
      const { rows } = await pool.query(
        `INSERT INTO vaccinations (name, vaccine_name, dose_number, scheduled_date, actual_date, status, administered_by, batch_number, reaction, notes, patient_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [name, vaccine_name, dose_number || 1, scheduled_date, actual_date, status || 'scheduled', administered_by, batch_number, reaction, notes, req.patientId]
      );
      const vac = rows[0];
      try { vac.photos = JSON.parse(vac.photos || '[]'); } catch { vac.photos = []; }
      res.status(201).json(vac);
    } catch (err) {
      console.error('Ошибка создания прививки:', err);
      res.status(500).json({ error: 'Внутренняя ошибка сервера' });
    }
  }
);

// PUT /api/vaccinations/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, vaccine_name, dose_number, scheduled_date, actual_date, status, administered_by, batch_number, reaction, notes } = req.body;
    const { rows } = await pool.query(
      `UPDATE vaccinations
       SET name = $1, vaccine_name = $2, dose_number = $3, scheduled_date = $4,
           actual_date = $5, status = $6, administered_by = $7, batch_number = $8,
           reaction = $9, notes = $10, updated_at = datetime('now')
       WHERE id = $11
       RETURNING *`,
      [name, vaccine_name, dose_number, scheduled_date, actual_date, status, administered_by, batch_number, reaction, notes, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Прививка не найдена' });
    }
    const vac = rows[0];
    try { vac.photos = JSON.parse(vac.photos || '[]'); } catch { vac.photos = []; }
    res.json(vac);
  } catch (err) {
    console.error('Ошибка обновления прививки:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// POST /api/vaccinations/:id/photos — upload photo
router.post('/:id/photos', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не предоставлен' });
    }
    const vac = rawDb.prepare('SELECT * FROM vaccinations WHERE id = ?').get(req.params.id);
    if (!vac) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Прививка не найдена' });
    }

    let photos = [];
    try { photos = JSON.parse(vac.photos || '[]'); } catch {}

    const photoUrl = `/uploads/vaccinations/${req.file.filename}`;
    photos.push(photoUrl);

    rawDb.prepare('UPDATE vaccinations SET photos = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(JSON.stringify(photos), req.params.id);

    res.json({ photos, added: photoUrl });
  } catch (err) {
    console.error('Ошибка загрузки фото прививки:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/vaccinations/:id/photos — remove photo by url
router.delete('/:id/photos', async (req, res) => {
  try {
    const { photo_url } = req.body;
    if (!photo_url) {
      return res.status(400).json({ error: 'photo_url обязателен' });
    }

    const vac = rawDb.prepare('SELECT * FROM vaccinations WHERE id = ?').get(req.params.id);
    if (!vac) {
      return res.status(404).json({ error: 'Прививка не найдена' });
    }

    let photos = [];
    try { photos = JSON.parse(vac.photos || '[]'); } catch {}

    photos = photos.filter(p => p !== photo_url);

    rawDb.prepare('UPDATE vaccinations SET photos = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(JSON.stringify(photos), req.params.id);

    // Delete file from disk
    const filename = path.basename(photo_url);
    const filePath = path.join(config.UPLOAD_DIR, 'vaccinations', filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    res.json({ photos });
  } catch (err) {
    console.error('Ошибка удаления фото прививки:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

// DELETE /api/vaccinations/:id
router.delete('/:id', async (req, res) => {
  try {
    // Clean up photos
    const vac = rawDb.prepare('SELECT photos FROM vaccinations WHERE id = ?').get(req.params.id);
    if (vac) {
      let photos = [];
      try { photos = JSON.parse(vac.photos || '[]'); } catch {}
      for (const photoUrl of photos) {
        const filename = path.basename(photoUrl);
        const filePath = path.join(config.UPLOAD_DIR, 'vaccinations', filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
    }

    const { rowCount } = await pool.query('DELETE FROM vaccinations WHERE id = $1', [req.params.id]);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Прививка не найдена' });
    }
    res.json({ message: 'Прививка удалена' });
  } catch (err) {
    console.error('Ошибка удаления прививки:', err);
    res.status(500).json({ error: 'Внутренняя ошибка сервера' });
  }
});

module.exports = router;
