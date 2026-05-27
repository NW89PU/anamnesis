// Anamnesis Claude Runner.
//
// HTTP service (Docker sibling of backend on TrueNAS). Accepts POST /run
// from the backend, spawns `claude -p <prompt> --mcp-config ...`, streams
// stdout back as SSE so UI can display live progress.
//
// Environment:
//   RUNNER_PORT          port (default 7900)
//   RUNNER_HOST          bind interface (default 0.0.0.0 inside container)
//   RUNNER_TOKEN         Bearer token by which backend authenticates itself
//   MCP_SERVER_URL       Anamnesis MCP server URL (http://mcp:7800/mcp в same network)
//   MCP_TOKEN            Bearer for MCP server
//   CLAUDE_BIN           path to claude binary (default `claude` on PATH)
//   DEFAULT_TIMEOUT_SEC  hard kill per spawn (default 600s)
//   RUNNER_LOG_DIR       request log dir
//   RUNNER_TMP_DIR       temp mcp-config files dir
//
// Per-request mcp-config: each /run call writes a temp JSON config with
// user_id/user_role/active_patient_id in HTTP headers. Claude passes them
// on every MCP tool call → MCP server enforces ownership.
//
// First-time setup after container starts:
//   docker exec -it ix-anamnesis-runner-1 claude login
//   (opens device-code URL → authorize in browser → tokens persist in
//   the /home/runner/.claude volume.)

import express from 'express';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const RUNNER_PORT = parseInt(process.env.RUNNER_PORT, 10) || 7900;
const RUNNER_HOST = process.env.RUNNER_HOST || '0.0.0.0';
const RUNNER_TOKEN = process.env.RUNNER_TOKEN || '';
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://100.100.11.11:7800/mcp';
const MCP_TOKEN = process.env.MCP_TOKEN || '';
const CLAUDE_BIN = process.env.CLAUDE_BIN || 'claude';
const DEFAULT_TIMEOUT_SEC = parseInt(process.env.DEFAULT_TIMEOUT_SEC, 10) || 600;
const LOG_DIR = process.env.RUNNER_LOG_DIR
  || path.join(os.homedir(), '.anamnesis-runner', 'logs');
const TMP_DIR = process.env.RUNNER_TMP_DIR
  || path.join(os.homedir(), '.anamnesis-runner', 'tmp');

if (!RUNNER_TOKEN) console.warn('[runner] WARNING: RUNNER_TOKEN not set, all clients pass through (dev mode)');
if (!MCP_TOKEN) console.warn('[runner] WARNING: MCP_TOKEN not set');
if (!fs.existsSync(CLAUDE_BIN)) console.warn(`[runner] WARNING: CLAUDE_BIN ${CLAUDE_BIN} not found — set CLAUDE_BIN env var`);
fs.mkdirSync(LOG_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

// ─── Server ────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: '5mb' }));

// Health endpoint (no auth, for monitoring)
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'anamnesis-runner' }));

// Bearer auth для /run
app.use('/run', (req, res, next) => {
  if (!RUNNER_TOKEN) return next();
  if (req.headers.authorization !== `Bearer ${RUNNER_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

/**
 * POST /run — spawn claude -p with given prompt + MCP config.
 *
 * Body:
 *   prompt              required, текст задачи
 *   timeout_sec         optional, override DEFAULT_TIMEOUT_SEC
 *   allowed_tools       optional, string список через запятую (default "mcp__anamnesis__*")
 *   system_prompt       optional, override system message
 *   user_context        optional, object с info про юзера/patient — добавляется в system prompt
 *                       Пример: { user_id: 5, user_role: "admin", active_patient_id: 3 }
 *
 * Response: SSE stream Claude stdout. События:
 *   event: line      — каждая строка из claude --output-format stream-json
 *   event: done      — финальный exit code + duration
 *   event: error     — error message
 */
app.post('/run', (req, res) => {
  const { prompt, timeout_sec, allowed_tools, system_prompt, user_context } = req.body || {};
  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt (string) required' });
  }

  const requestId = Math.random().toString(36).slice(2, 10);
  const startedAt = Date.now();

  // Подготавливаем effective system prompt с user-контекстом
  let effectiveSystem = system_prompt || '';
  if (user_context && typeof user_context === 'object') {
    const ctx = `\n\n# Context\nYou are operating on behalf of:\n` +
      `- user_id: ${user_context.user_id}\n` +
      `- user_role: ${user_context.user_role || 'user'}\n` +
      `- active_patient_id: ${user_context.active_patient_id ?? 'none'}\n\n` +
      `All Anamnesis MCP tools must be called with this context. Do not access ` +
      `patients outside this user's ownership unless user_role is 'admin'.`;
    effectiveSystem = effectiveSystem + ctx;
  }

  // Генерируем temp mcp-config с user-context в headers — каждый MCP-tool
  // вызов будет передавать их серверу, MCP enforce-ит ownership.
  const mcpConfigPath = path.join(TMP_DIR, `mcp-${requestId}.json`);
  const mcpConfig = {
    mcpServers: {
      anamnesis: {
        type: 'http',
        url: MCP_SERVER_URL,
        headers: {
          'Authorization': `Bearer ${MCP_TOKEN}`,
          'X-Anamnesis-User-Id': String(user_context?.user_id ?? ''),
          'X-Anamnesis-User-Role': String(user_context?.user_role ?? 'user'),
          'X-Anamnesis-Active-Patient-Id': String(user_context?.active_patient_id ?? ''),
        },
      },
    },
  };
  fs.writeFileSync(mcpConfigPath, JSON.stringify(mcpConfig));

  const args = [
    '-p', prompt,
    '--output-format', 'stream-json',
    '--verbose',
    '--mcp-config', mcpConfigPath,
    '--allowedTools', allowed_tools || 'mcp__anamnesis__*',
    '--dangerously-skip-permissions', // tools уже whitelisted, не нужны прокинутые approvals
  ];
  if (effectiveSystem) args.push('--append-system-prompt', effectiveSystem);

  console.log(`[runner ${requestId}] spawn claude (prompt: ${prompt.slice(0, 100).replace(/\s+/g, ' ')}...)`);

  // SSE response setup
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  res.write(`event: start\ndata: ${JSON.stringify({ request_id: requestId })}\n\n`);

  const proc = spawn(CLAUDE_BIN, args, { env: process.env });

  const logFile = path.join(LOG_DIR, `${requestId}.log`);
  const logStream = fs.createWriteStream(logFile, { flags: 'a' });
  logStream.write(`=== ${new Date().toISOString()} ===\n`);
  logStream.write(`PROMPT: ${prompt}\n`);
  logStream.write(`USER_CONTEXT: ${JSON.stringify(user_context)}\n\n`);

  const timeoutMs = (timeout_sec || DEFAULT_TIMEOUT_SEC) * 1000;
  const timeoutHandle = setTimeout(() => {
    console.warn(`[runner ${requestId}] timeout after ${timeoutMs}ms — killing`);
    proc.kill('SIGTERM');
  }, timeoutMs);

  let stdoutBuf = '';
  proc.stdout.on('data', (chunk) => {
    const text = chunk.toString('utf8');
    logStream.write(text);
    stdoutBuf += text;
    // Stream-json формат: каждое сообщение это одна JSON-строка
    let nl;
    while ((nl = stdoutBuf.indexOf('\n')) !== -1) {
      const line = stdoutBuf.slice(0, nl).trim();
      stdoutBuf = stdoutBuf.slice(nl + 1);
      if (line) {
        // Просто прокидываем как event line (frontend парсит JSON)
        res.write(`event: line\ndata: ${JSON.stringify(line)}\n\n`);
      }
    }
  });

  proc.stderr.on('data', (chunk) => {
    const text = chunk.toString('utf8');
    logStream.write(`STDERR: ${text}`);
    res.write(`event: stderr\ndata: ${JSON.stringify(text)}\n\n`);
  });

  proc.on('error', (err) => {
    clearTimeout(timeoutHandle);
    logStream.write(`SPAWN ERROR: ${err.message}\n`);
    logStream.end();
    try { fs.unlinkSync(mcpConfigPath); } catch { /* */ }
    console.error(`[runner ${requestId}] spawn error:`, err);
    res.write(`event: error\ndata: ${JSON.stringify({ message: err.message })}\n\n`);
    res.end();
  });

  proc.on('close', (code, signal) => {
    clearTimeout(timeoutHandle);
    if (stdoutBuf.trim()) {
      res.write(`event: line\ndata: ${JSON.stringify(stdoutBuf.trim())}\n\n`);
    }
    const duration = Date.now() - startedAt;
    logStream.write(`\nEXIT code=${code} signal=${signal} duration=${duration}ms\n`);
    logStream.end();
    // Cleanup temp mcp-config — содержит секрет (MCP_TOKEN)
    try { fs.unlinkSync(mcpConfigPath); } catch { /* */ }
    console.log(`[runner ${requestId}] done code=${code} signal=${signal} ${duration}ms`);
    res.write(`event: done\ndata: ${JSON.stringify({ code, signal, duration_ms: duration })}\n\n`);
    res.end();
  });

  // res.on('close') а не req.on — req.close fires on body parse done in Express.
  // killed=true только когда мы сами явно прибили (не natural exit).
  let procExited = false;
  proc.on('close', () => { procExited = true; });
  res.on('close', () => {
    if (!procExited) {
      console.log(`[runner ${requestId}] response closed — killing claude`);
      proc.kill('SIGTERM');
    }
  });
});

app.listen(RUNNER_PORT, RUNNER_HOST, () => {
  console.log(`[runner] Anamnesis Claude Runner listening on ${RUNNER_HOST}:${RUNNER_PORT}`);
  console.log(`[runner] Claude bin: ${CLAUDE_BIN}`);
  console.log(`[runner] MCP server: ${MCP_SERVER_URL}`);
  console.log(`[runner] Logs: ${LOG_DIR}`);
  console.log(`[runner] Auth: ${RUNNER_TOKEN ? 'Bearer enabled' : 'OPEN (dev mode)'}`);
});
