# Using Aider as the Anamnesis coordinator

[Aider](https://aider.chat) is a CLI-based AI coding assistant that works with many models (OpenAI, Anthropic, Google, local Ollama). It is a good fit for Anamnesis if you prefer terminal workflows or want to pair with models other than Claude.

## Setup

1. Install Aider: `pipx install aider-chat`
2. Configure your preferred model, e.g.:
   ```bash
   export ANTHROPIC_API_KEY=sk-...         # for Claude models
   # or
   export OPENAI_API_KEY=sk-...            # for GPT models
   # or see Aider docs for other providers
   ```
3. Run from the Anamnesis project root:
   ```bash
   aider --model claude-3-5-sonnet AI_COORDINATOR_GUIDE.md
   ```

## First session

Aider opens a REPL. Send:

```
/add AI_COORDINATOR_GUIDE.md
/read README.md

Please read these files. You are operating as the AI coordinator for
this Anamnesis instance.

Server: <URL>
Tokens: APP_PIN=..., ADMIN_TOKEN=...

This is a fresh install with a demo patient. Please replace the demo
patient with:
  Full name: ...
  Date of birth: ...
  Gender: ...
```

## Tips

- Aider is optimised for modifying code files. For Anamnesis most work is API calls + SQL, so use `/ask` mode for data operations and `/code` mode only when editing the project itself.
- Use `--subtree-only` if the repo is large and you want focused context.
- Consider `--no-auto-commits` since Aider otherwise commits to git after every change, which is noisy for pure data work.

## Limitations

- Aider's shell access is more limited than Claude Code's. For some operations (ssh, complex pipelines) you may need to run commands yourself and paste the output.
- Smaller/cheaper models struggle with the two-pass PDF verification protocol. Use at least a frontier model for document analysis.
