const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./config');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = config.DATABASE_URL || path.join(dataDir, 'anamnesis.db');

if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE patient (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name       TEXT NOT NULL,
    date_of_birth   TEXT,
    gender          TEXT,
    blood_type      TEXT,
    birth_weight_g  INTEGER,
    birth_height_cm INTEGER,
    apgar           TEXT,
    birth_notes     TEXT,
    current_height_cm INTEGER,
    current_weight_kg REAL,
    city            TEXT,
    allergies       TEXT,
    notes           TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE diagnoses (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    icd_code        TEXT,
    status          TEXT DEFAULT 'active',
    diagnosed_date  TEXT,
    source          TEXT,
    notes           TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE medications (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    dosage          TEXT,
    frequency       TEXT,
    start_date      TEXT,
    end_date        TEXT,
    prescribed_by   TEXT,
    status          TEXT DEFAULT 'active',
    notes           TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE specialists (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name       TEXT,
    specialization  TEXT NOT NULL,
    clinic          TEXT,
    phone           TEXT,
    email           TEXT,
    status          TEXT DEFAULT 'active',
    notes           TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE documents (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    category        TEXT,
    original_name   TEXT,
    file_path       TEXT,
    file_size       INTEGER,
    mime_type       TEXT,
    notes           TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE timeline (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    description     TEXT,
    category        TEXT,
    event_date      TEXT NOT NULL,
    severity        TEXT DEFAULT 'info',
    badge_text      TEXT,
    badge_color     TEXT,
    notes           TEXT,
    specialist_name TEXT,
    specialist_type TEXT,
    transcription   TEXT,
    ai_assessment   TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE plan (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    description     TEXT,
    detail          TEXT,
    priority        TEXT DEFAULT 'medium',
    status          TEXT DEFAULT 'pending',
    due_date        TEXT,
    sort_order      INTEGER DEFAULT 0,
    notes           TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE medical_errors (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    description     TEXT NOT NULL,
    severity        TEXT DEFAULT 'medium',
    status          TEXT DEFAULT 'open',
    error_date      TEXT,
    specialist_id   INTEGER,
    action_text     TEXT,
    source_docs     TEXT,
    detail          TEXT,
    notes           TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE reminders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    title           TEXT NOT NULL,
    message         TEXT,
    remind_at       TEXT NOT NULL,
    repeat_cron     TEXT,
    status          TEXT DEFAULT 'pending',
    sent_at         TEXT,
    notes           TEXT,
    created_at      TEXT DEFAULT (datetime('now')),
    updated_at      TEXT DEFAULT (datetime('now'))
);
`);

// v4.1: демо-сиды отключены. Юзер сам добавит первого пациента после
// Google login → AddPatientModal. До этого все таблицы пустые.

// Note: vaccinations, growth_log, lab_results tables are created at first
// server start via migrations in src/db.js, not here. To populate them
// with demo data, connect your AI coordinator after `npm start` or insert
// via SQL once the server has run once.

db.exec(`
CREATE TABLE IF NOT EXISTS app_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL,
    changes TEXT NOT NULL DEFAULT '[]',
    reason TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

INSERT INTO app_settings (key, value) VALUES ('current_version', '1.0.0');
INSERT INTO app_versions (version, changes, reason) VALUES ('1.0.0', '["Начальная версия системы"]', 'Инициализация');
`);

console.log('Anamnesis database initialized with demo patient.');
console.log('Path:', dbPath);
console.log('');
console.log('Next steps:');
console.log('  1. npm start  (starts backend on port 3010)');
console.log('  2. In another terminal: cd ../frontend && npm run dev');
console.log('  3. Connect your AI coordinator and ask it to replace the demo patient');
console.log('     with yours (see README and AI_COORDINATOR_GUIDE.md).');
db.close();
