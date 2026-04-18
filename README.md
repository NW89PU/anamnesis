# Anamnesis

> AI-coordinated medical records tracker — a personal health PWA where an AI assistant does the heavy lifting of data entry, structuring, and cross-referencing, while you just scan documents and talk to it in plain language.

**Status**: early release. Functional, self-hosted, single-family scale.

---

## What is this?

Most medical trackers ask you to fill in dozens of fields by hand — diagnosis, dosage, reference ranges, anomaly flags, links between tests and visits. It is tedious and most people give up after a week.

Anamnesis flips the model: **an AI coordinator** (Claude, GPT, Gemini, local LLM — your choice) reads your medical documents, extracts the data, and writes it into a structured SQLite database. You get a clean timeline, automatic anomaly detection, cross-referenced visits, and a full audit log — without typing it in yourself.

The app is a minimal PWA that **shows** the data. The coordinator **maintains** the data.

## Who is this for?

- Families with complex or ongoing medical situations (a child with multiple specialists, chronic conditions, frequent tests)
- Developers comfortable with self-hosting (Node.js, SQLite, nginx)
- People who already work with an AI assistant daily and want to extend that habit to their health records
- Privacy-conscious users who don't want medical data in a SaaS cloud

This is **not** for casual users looking for a one-tap wellness app.

## Key features

### For the user
- **Dashboard** — aggregated stats, active diagnoses, current medications, upcoming reminders, AI summary
- **Plan** — treatment and examination plan with priorities, tabs pending/done
- **Errors** — medical errors and lab anomalies with AI recommendations
- **Visits & documents** — doctor visits with audio transcriptions, AI analysis, attached documents, comments
- **Diagnoses** — all diagnoses with optional AI assessment
- **Lab results** — grouped by test, with ref ranges and anomaly highlighting
- **Vaccinations** — schedule with photos and reactions
- **Growth log** — height/weight/head circumference over time
- **Specialists directory**, **medications register**, **reminders**, **full-text search (FTS5)**, **change history**, **AI chat**
- **Export to PDF** — shareable summary for a new doctor
- **Health graph** (Cytoscape) — visualize connections between diagnoses, medications, specialists, visits

### For the AI coordinator
- HTTP API (`/api/admin/tools/*`) — `ai-review`, `integrity`, `orphan-check`, `impact`, `sql`, `search`, `changelog`, `mark-reviewed`, `since-last-review`, `backup-now`
- Full-text search (FTS5 with Cyrillic support)
- Strict data integrity checks (foreign keys, orphan detection, conflict resolution protocol)
- Audit log with per-patient filtering — the AI can reason about what changed since last session

### Technical
- **Frontend**: React 19, Vite 7, TypeScript strict, React Router 7 (data mode), TanStack Query 5, Motion, PWA with offline support (Workbox)
- **Backend**: Node.js 22, Express, SQLite (WAL mode, foreign keys ON, FTS5), scrypt PIN hashing + WebAuthn biometry + device trust + server-side exponential backoff
- **Deploy**: Git + systemd (non-root user) + nginx, optional Telegram notifications and offsite encrypted backups
- **Multi-patient**: ready for up to 4 patients in one instance (per-patient data isolation, audit log, UI patient switcher)

## Model-agnostic AI coordinator

Anamnesis does not depend on a specific AI provider. The coordinator is any LLM with the ability to execute shell commands and HTTP requests — the project provides a protocol (see `AI_COORDINATOR_GUIDE.md`) and lets you plug in whatever you use.

Tested setups:
- **[Claude Code](docs/setup/claude-code.md)** (Anthropic) — recommended for clinical reasoning
- **[Cursor IDE](docs/setup/cursor.md)** — integrated IDE + AI + terminal
- **[Aider](docs/setup/aider.md)** — CLI-based, works with any model
- **[Gemini CLI](docs/setup/gemini-cli.md)** (Google)
- **[Local models](docs/setup/ollama-local.md)** via Ollama — Llama 3, Qwen, DeepSeek

Clinical-reasoning tasks benefit from larger models. Routine data entry works fine on smaller ones.

---

## Getting started

### 1. Prerequisites

- Node.js ≥ 22
- SQLite ≥ 3.35 (comes with better-sqlite3)
- `poppler-utils` (for PDF → PNG previews) — `apt install poppler-utils` on Linux / `brew install poppler` on macOS

### 2. Clone and install

```bash
git clone https://github.com/Veta-one/anamnesis.git
cd anamnesis

# Backend
cd backend
npm install
cp ../.env.example .env
# Edit .env — set APP_PIN, generate API_TOKEN, ADMIN_TOKEN, BACKUP_ENCRYPTION_KEY
npm run init-db          # creates DB with a demo patient (Ivanov Ivan)
npm start                # starts backend on port 3010

# Frontend (new terminal)
cd frontend
npm install
npm run dev              # opens http://localhost:5173 with proxy to backend
```

You should now see a demo patient (Ivanov Ivan Ivanovich) with one example entry per section. This is the **starter state** — all UI screens work, you can tap around and learn the interface.

### 3. Replace the demo patient with your own

Once you want to start using it for real, connect your AI coordinator (see setup guides above), then ask it to replace the demo patient with yours:

```
Hi. This is a fresh Anamnesis instance. The DB has a demo patient
(Ivanov Ivan Ivanovich, patient_id=1). Delete everything for patient_id=1
and create a new patient:
- Full name: <your name>
- Date of birth: YYYY-MM-DD
- Gender: M/F

Then I'll start sending you documents.
```

The coordinator will wrap this in a transaction, wipe the demo data, create your patient, and you are ready.

### 4. Production deploy (optional)

See [`DEPLOY.md`](DEPLOY.md) for a self-hosted production setup (Ubuntu VPS + nginx + Let's Encrypt + systemd hardening + UFW + fail2ban + Telegram-backed offsite backups).

---

## Project structure

```
anamnesis/
├── README.md                   This file
├── LICENSE                     MIT + medical disclaimer
├── DEPLOY.md                   Self-hosted production guide
├── AI_COORDINATOR_GUIDE.md     Protocol the AI follows
├── .env.example                Environment template
│
├── backend/                    Node.js + Express + SQLite
│   ├── package.json
│   ├── src/
│   │   ├── index.js            Entry: CORS, rate limits, auth
│   │   ├── db.js               Schema + migrations + audit triggers + FTS5
│   │   ├── init-db.js          Demo patient seed
│   │   ├── middleware/         auth, audit, patientId, validate
│   │   ├── routes/             API endpoints
│   │   └── services/           backup, telegram, scheduler, changelog, auth-session
│   │
│   ├── data/                   [gitignored] SQLite DB + backups
│   └── uploads/                [gitignored] Patient documents and photos
│
├── frontend/                   React 19 PWA
│   ├── src/
│   │   ├── app/                router, providers, query client
│   │   ├── shared/             UI primitives, auth, hooks, layout, utils
│   │   └── features/           dashboard, plan, errors, documents, diagnoses, more
│   └── public/                 PWA manifest, icons
│
└── docs/                       Additional documentation
    ├── setup/                  Per-provider AI setup guides
    └── AI_COORDINATOR_GUIDE.md
```

## API

Overview (for developers wiring up a coordinator):

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login` | PIN login → session token |
| POST | `/api/auth/verify-device` | Security challenge for new device |
| GET | `/api/dashboard` | Aggregated summary |
| GET/POST/PUT/DELETE | `/api/diagnoses` | Diagnoses |
| GET/POST/PUT/DELETE | `/api/medications` | Medications |
| GET/POST/PUT/DELETE | `/api/timeline` | Doctor visits / timeline |
| GET/POST/PUT/DELETE | `/api/documents` | Documents (multipart upload) |
| GET/POST/PUT/DELETE | `/api/plan` | Treatment plan |
| GET/POST/PUT/DELETE | `/api/errors` | Medical errors |
| GET/POST/PUT/DELETE | `/api/lab-results` | Lab results |
| GET | `/api/search?q=...` | FTS5 search |
| GET | `/api/patient-context` | Full patient snapshot (for AI) |
| GET | `/api/history` | Automatic per-patient changelog |
| POST | `/api/admin/tools/sql` | Arbitrary SQL (ADMIN_TOKEN required) |
| GET | `/api/admin/tools/ai-review` | Session readiness check |
| GET | `/api/admin/tools/integrity` | Integrity check + FK violations + FTS |
| GET | `/api/admin/tools/orphan-check` | Entities without source document |
| GET | `/api/admin/tools/impact` | Dry-run deletion impact |
| POST | `/api/admin/tools/backup-now` | Trigger backup |

Full API is documented in `AI_COORDINATOR_GUIDE.md`.

## Security model

- **6-digit PIN** (scrypt-hashed) for login
- **WebAuthn biometry** (Face ID / Touch ID / Windows Hello) as fast-path after first PIN login
- **Device trust**: new devices require a security word (registered during first-run setup)
- **Server-side exponential backoff**: 3 failures → 1 min lockout → 2 min → 4 min → ... capped at 24 h
- **Sessions in SQLite** (14-day sliding expiry, IP + UA tracking, revocation)
- **Rate limits**: 20 req/15min on auth, 60 req/min on admin SQL, 1000 req/15min on general API
- **Strict file upload validation**: MIME whitelist + double extension check, SVG rejected, 50 MB max
- **AES-256-CBC / PBKDF2** encryption for daily backup archives
- **Systemd hardening** (non-root user, ProtectSystem, ProtectKernel*, RestrictSUIDSGID, etc.)

See `DEPLOY.md` for the full hardening guide.

## Contributing

PRs welcome for: bug fixes, new UI features, additional AI provider setup guides, translations, accessibility improvements. Please open an issue first for larger changes so we can align on direction.

Not accepted: features that change the core model (e.g. "make it cloud-hosted", "add social sharing") — those belong in a fork.

## License

MIT, see [LICENSE](LICENSE). Not a medical device.

## Author

Built by [Veta-one](https://github.com/Veta-one). Follow on Telegram: [@VETA14](https://t.me/VETA14).
