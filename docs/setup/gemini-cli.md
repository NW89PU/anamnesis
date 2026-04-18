# Using Gemini CLI as the Anamnesis coordinator

[Gemini CLI](https://github.com/google-gemini/gemini-cli) is Google's agentic CLI tool, supporting Gemini Pro/Ultra with built-in tools.

## Setup

```bash
npm install -g @google/gemini-cli
gemini auth
```

## First session

From the Anamnesis project root:

```bash
gemini
```

Then:

```
Please read AI_COORDINATOR_GUIDE.md — this is your operational protocol.

Server: <URL>
Credentials in backend/.env (APP_PIN, ADMIN_TOKEN)

This is a fresh install with demo patient. Replace with:
  Full name: ...
  Date of birth: ...
  ...
```

## Notes

- Gemini's multi-modal capabilities are strong for image analysis of medical documents — you can paste a photo of a prescription directly
- Long context window is good for processing large transcriptions in one pass
- Verify clinical reasoning more carefully with Gemini than with Claude — cross-check anomaly flags against the source document
