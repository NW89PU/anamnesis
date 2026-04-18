# Using Claude Code as the Anamnesis coordinator

[Claude Code](https://claude.com/claude-code) is Anthropic's agentic CLI for codebases. It has shell + HTTP access, which is everything we need.

## Setup

1. Install Claude Code (see their docs for current instructions)
2. Clone Anamnesis locally and open the folder in Claude Code
3. On the server side, have your Anamnesis instance running (local dev or production VPS)
4. In `AI_COORDINATOR_GUIDE.md`, everything the AI needs is already described

## First session

Open Claude Code in the project directory and send it this message:

```
Please read AI_COORDINATOR_GUIDE.md — this is your operational protocol
for this project. I will be using you to maintain my family's medical
records.

For this session we work with patient_id=1. The server is at:
  <your server address, e.g. http://localhost:3010 or https://your-domain.com>

Tokens (read from backend/.env or the server):
  APP_PIN=<your PIN>
  ADMIN_TOKEN=<your admin token>

This is a fresh Anamnesis instance with a demo patient. Please replace
the demo patient (Ivanov Ivan Ivanovich) with:
  Full name: <your name or your family member's name>
  Date of birth: YYYY-MM-DD
  Gender: M/F
  [any starting diagnoses, allergies, notes if relevant]

After replacement, confirm integrity and I'll start sending documents.
```

Claude will read the guide, authenticate, run the replacement transaction, verify integrity, and report.

## Subsequent sessions

Much simpler:

```
Please review AI_COORDINATOR_GUIDE.md and run an ai-review for patient_id=1.
Tokens are in backend/.env.
```

Or, when sending a new document:

```
Please process this new document for patient_id=1:
<paste transcription / describe the file / attach via upload>
```

## Tips

- **Let Claude read the guide every session.** The instructions there are rich and include the two-pass PDF verification protocol which is critical for numeric data.
- **Allow shell access.** Claude needs to run `curl`, `ssh`, `sqlite3`, `pdftoppm`, `openssl`.
- **Provide token access deliberately.** Either put them in the environment, or paste them into the first message of the session. Never commit tokens to the repo.
- **Recommended models**: Claude Opus for clinical reasoning tasks (new document analysis, cross-references), Claude Sonnet for routine maintenance.

## Troubleshooting

- **"Lockout active" errors**: the server saw too many failed login attempts from Claude's IP/device. Wait out the lockout, or manually clear `auth_lockouts` in the DB.
- **FTS5 syntax errors**: some characters must be escaped. See the FTS5 syntax section in `AI_COORDINATOR_GUIDE.md`.
- **Transcription quality low**: run `pdftoppm -r 400` instead of `-r 200`. Read the two-pass protocol.
