# Using local LLMs (Ollama) as the Anamnesis coordinator

Running entirely on your own hardware means zero data leaves your network. Trade-off: smaller models make more mistakes, especially on clinical reasoning and PDF number reading.

## Setup

1. Install [Ollama](https://ollama.com)
2. Pull a capable model:
   ```bash
   ollama pull qwen2.5:72b          # recommended for reasoning
   # or
   ollama pull llama3.3:70b         # alternative
   # or
   ollama pull deepseek-r1:70b      # strong reasoning, slower
   ```
3. Install an agentic wrapper that exposes shell tools. Options:
   - [Open Interpreter](https://openinterpreter.com) — `pip install open-interpreter`, then `interpreter --model ollama/qwen2.5:72b`
   - [Aider](https://aider.chat) with `--model ollama/qwen2.5:72b`
   - Custom script using Ollama's function-calling API

## First session

The prompt is the same as for Claude or GPT. Point the agent at `AI_COORDINATOR_GUIDE.md`, give it server URL + tokens.

## Important caveats for local models

### Clinical reasoning is weaker

70B-class models can miss cross-references and clinical red flags that a frontier model would catch. Mitigation:

- **Manually review every `ai_assessment`** the model produces before trusting it
- **Skip deep cross-reference step** — just do data entry, do your own reasoning
- Consider a **hybrid setup**: local model for bulk data entry, frontier model (via API) for periodic analytical reviews

### PDF reading is a liability

The two-pass verification protocol is critical, and small models sometimes skip it. Options:

- Pre-process PDFs with OCR yourself (`tesseract` or `pdftotext`) and feed the text, not the image
- Always run `GET /api/admin/tools/changelog` after a batch and verify the inserted numbers against the source PDF by eye

### Performance

- A 70B model at Q4 quantisation needs ~40 GB VRAM or a mix of VRAM + system RAM
- Expect 5-20 tokens/sec on consumer GPUs
- Routine data entry sessions take 5-15 minutes per document

## Best-fit scenario

Local models are ideal when:
- You are privacy-paranoid about medical data (understandable)
- You already have a ML workstation
- You mostly use the tool for organised storage + retrieval, not clinical reasoning
- You accept doing analytical review yourself

Not a good fit when:
- You expect the AI to catch subtle clinical patterns across years of data
- You cannot tolerate occasional transcription errors
