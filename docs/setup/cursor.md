# Using Cursor as the Anamnesis coordinator

[Cursor](https://cursor.com) is an AI-first IDE fork of VS Code. Good fit if you want an integrated editor + AI + terminal experience.

## Setup

1. Open the Anamnesis project folder in Cursor
2. Open the AI panel (Cmd/Ctrl + K or the sidebar icon)
3. Choose a powerful model (Claude Opus, GPT-5, etc.)
4. Ensure the agent has terminal access (settings → agent permissions)

## First session

In the AI panel:

```
Please read AI_COORDINATOR_GUIDE.md in the project root — this is your
operational protocol.

I have an Anamnesis instance running at <URL>. Credentials are in
backend/.env (APP_PIN, ADMIN_TOKEN).

Current state: fresh install with demo patient (Ivanov Ivan).
Please replace with: <your patient details>

After that's done, I'll start sending documents as files in the
project — just attach them to messages or drop in the uploads folder.
```

## Workflow

1. Drop new medical documents (PDF, images) somewhere Cursor can see them — e.g. a `./inbox/` folder
2. Send a message: "New document for patient 1, please process"
3. Cursor runs the two-pass verification, writes to DB, reports back

## Tips

- **Use agent mode, not chat mode** — for tasks that require running commands
- **Keep AI_COORDINATOR_GUIDE.md pinned** to context in every session
- **Long-running operations**: Cursor may time out on multi-minute commands. For backups or initial setup, run in a regular terminal
