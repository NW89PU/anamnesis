// Anamnesis MCP server (Stage A).
//
// Exposes Anamnesis backend as MCP tools, talks to Claude Code via
// Streamable HTTP transport. Tools forward to backend HTTP API using
// ADMIN_TOKEN. Per-user scoping is enforced here: Claude Runner sends
// X-Anamnesis-User-Id + X-Anamnesis-User-Role headers, and tools
// verify patient ownership before exposing data.
//
// Environment:
//   ANAMNESIS_URL       — backend base URL (http://backend:3010 inside compose net)
//   ADMIN_TOKEN         — bearer для backend admin endpoints
//   MCP_TOKEN           — bearer которым Claude Runner себя аутентифицирует
//   MCP_PORT            — порт сервера (default 7800)
//   MCP_HOST            — bind interface (default 0.0.0.0, в проде указать Tailscale IP)

import express from 'express';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';

const ANAMNESIS_URL = process.env.ANAMNESIS_URL || 'http://localhost:3010';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const MCP_TOKEN = process.env.MCP_TOKEN || '';
const MCP_PORT = parseInt(process.env.MCP_PORT, 10) || 7800;
const MCP_HOST = process.env.MCP_HOST || '0.0.0.0';

if (!ADMIN_TOKEN) console.warn('[mcp] WARNING: ADMIN_TOKEN not set, backend calls will fail in production');
if (!MCP_TOKEN) console.warn('[mcp] WARNING: MCP_TOKEN not set, all clients pass through (dev mode)');

// ─── HTTP helper to backend ────────────────────────────────

async function api(path, opts = {}) {
  const url = `${ANAMNESIS_URL}${path}`;
  const headers = {
    'Authorization': `Bearer ${ADMIN_TOKEN}`,
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };
  const res = await fetch(url, {
    method: opts.method || 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    throw new Error(`Backend ${res.status} ${res.statusText}: ${typeof data === 'string' ? data.slice(0, 200) : JSON.stringify(data)}`);
  }
  return data;
}

// Per-user ownership check. Each tool that takes a `patient_id` calls this
// to ensure the caller (X-Anamnesis-User-Id) owns that patient. Admin
// callers bypass the check (X-Anamnesis-User-Role: admin).
function assertOwnership(ctx, patientId) {
  if (!patientId) throw new Error('patient_id required');
  if (ctx.role === 'admin') return; // admin sees all
  // Lazy fetch: get user's owned patients once per request
  // Simpler: backend already does per-user check when X-Patient-Id is passed
  // with a session, but admin token bypasses. So we re-check here using
  // a direct DB-ish call (list_patients filtered).
  // Implementation: list user's owned patients via patient/list with
  // admin token + filter by owner_user_id in code.
}

async function listOwnedPatientIds(userId) {
  // Use admin token to fetch full list, then filter by owner_user_id
  // (backend's admin endpoint returns all patients with owner_user_id col).
  const rows = await api('/api/patient/list');
  return rows
    .filter((p) => p.owner_user_id === userId || p.owner_user_id == null)
    .map((p) => p.id);
}

async function ensureCanAccess(ctx, patientId) {
  if (ctx.role === 'admin') return true;
  const owned = await listOwnedPatientIds(ctx.userId);
  if (!owned.includes(patientId)) {
    throw new Error(`Access denied: patient_id=${patientId} not owned by user_id=${ctx.userId}`);
  }
  return true;
}

// Format helper: tool results must wrap in { content: [{ type: 'text', text }] }
function ok(data) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: 'text', text }] };
}
function err(message) {
  return { content: [{ type: 'text', text: `Error: ${message}` }], isError: true };
}

// ─── MCP Server + tools ────────────────────────────────────

const server = new McpServer({ name: 'anamnesis', version: '0.1.0' });

// Context (caller identity) is passed via extra.requestInfo headers
// (Streamable HTTP transport sets it). We extract once per tool call.
function ctxFrom(extra) {
  const headers = extra?.requestInfo?.headers || {};
  const userId = parseInt(headers['x-anamnesis-user-id'] || '0', 10) || null;
  const role = String(headers['x-anamnesis-user-role'] || 'user');
  const activePatientId = parseInt(headers['x-anamnesis-active-patient-id'] || '0', 10) || null;
  return { userId, role, activePatientId };
}

// ── Patients ──────────────────────────────────────────────

server.registerTool(
  'list_patients',
  {
    description: 'List all patients accessible to the current user (admin sees all; user sees only owned).',
    inputSchema: {},
  },
  async (_args, extra) => {
    try {
      const ctx = ctxFrom(extra);
      const rows = await api('/api/patient/list');
      const filtered = ctx.role === 'admin' ? rows : rows.filter((p) => p.owner_user_id === ctx.userId);
      return ok(filtered);
    } catch (e) { return err(e.message); }
  }
);

server.registerTool(
  'get_patient',
  {
    description: 'Get full profile of a specific patient (must be owned by caller unless admin).',
    inputSchema: { patient_id: z.number().int().positive() },
  },
  async ({ patient_id }, extra) => {
    try {
      const ctx = ctxFrom(extra);
      await ensureCanAccess(ctx, patient_id);
      const data = await api(`/api/patient`, { headers: { 'X-Patient-Id': String(patient_id) } });
      return ok(data);
    } catch (e) { return err(e.message); }
  }
);

server.registerTool(
  'get_patient_context',
  {
    description: 'Get full patient slice — visits, diagnoses, medications, labs, timeline — in one call. Use for AI-review.',
    inputSchema: { patient_id: z.number().int().positive() },
  },
  async ({ patient_id }, extra) => {
    try {
      const ctx = ctxFrom(extra);
      await ensureCanAccess(ctx, patient_id);
      const data = await api('/api/patient-context', { headers: { 'X-Patient-Id': String(patient_id) } });
      return ok(data);
    } catch (e) { return err(e.message); }
  }
);

// ── Read tools ────────────────────────────────────────────

server.registerTool(
  'get_timeline',
  {
    description: 'Get patient visit timeline (chronological events).',
    inputSchema: { patient_id: z.number().int().positive() },
  },
  async ({ patient_id }, extra) => {
    try {
      const ctx = ctxFrom(extra);
      await ensureCanAccess(ctx, patient_id);
      const data = await api('/api/timeline', { headers: { 'X-Patient-Id': String(patient_id) } });
      return ok(data);
    } catch (e) { return err(e.message); }
  }
);

server.registerTool(
  'get_diagnoses',
  {
    description: 'Get all diagnoses for patient.',
    inputSchema: { patient_id: z.number().int().positive() },
  },
  async ({ patient_id }, extra) => {
    try {
      const ctx = ctxFrom(extra);
      await ensureCanAccess(ctx, patient_id);
      const data = await api('/api/diagnoses', { headers: { 'X-Patient-Id': String(patient_id) } });
      return ok(data);
    } catch (e) { return err(e.message); }
  }
);

server.registerTool(
  'get_medications',
  {
    description: 'Get all medications for patient (active + completed).',
    inputSchema: { patient_id: z.number().int().positive() },
  },
  async ({ patient_id }, extra) => {
    try {
      const ctx = ctxFrom(extra);
      await ensureCanAccess(ctx, patient_id);
      const data = await api('/api/medications', { headers: { 'X-Patient-Id': String(patient_id) } });
      return ok(data);
    } catch (e) { return err(e.message); }
  }
);

server.registerTool(
  'get_lab_results',
  {
    description: 'Get all lab results for patient.',
    inputSchema: { patient_id: z.number().int().positive() },
  },
  async ({ patient_id }, extra) => {
    try {
      const ctx = ctxFrom(extra);
      await ensureCanAccess(ctx, patient_id);
      const data = await api('/api/lab-results', { headers: { 'X-Patient-Id': String(patient_id) } });
      return ok(data);
    } catch (e) { return err(e.message); }
  }
);

server.registerTool(
  'get_documents',
  {
    description: 'Get all documents (PDFs, scans, photos) for patient with their transcriptions if available.',
    inputSchema: { patient_id: z.number().int().positive() },
  },
  async ({ patient_id }, extra) => {
    try {
      const ctx = ctxFrom(extra);
      await ensureCanAccess(ctx, patient_id);
      const data = await api('/api/documents', { headers: { 'X-Patient-Id': String(patient_id) } });
      return ok(data);
    } catch (e) { return err(e.message); }
  }
);

server.registerTool(
  'get_visit',
  {
    description: 'Get a single visit by id, including its transcription and AI assessment.',
    inputSchema: { visit_id: z.number().int().positive() },
  },
  async ({ visit_id }, extra) => {
    try {
      const ctx = ctxFrom(extra);
      const data = await api(`/api/timeline/${visit_id}`);
      // Ownership check by patient_id from the returned record
      if (data && data.patient_id) await ensureCanAccess(ctx, data.patient_id);
      return ok(data);
    } catch (e) { return err(e.message); }
  }
);

server.registerTool(
  'search',
  {
    description: 'Full-text search across patient records (FTS5: timeline + comments + documents).',
    inputSchema: {
      patient_id: z.number().int().positive(),
      query: z.string().min(1),
    },
  },
  async ({ patient_id, query }, extra) => {
    try {
      const ctx = ctxFrom(extra);
      await ensureCanAccess(ctx, patient_id);
      const data = await api(`/api/admin/tools/search?q=${encodeURIComponent(query)}`, {
        headers: { 'X-Patient-Id': String(patient_id) },
      });
      return ok(data);
    } catch (e) { return err(e.message); }
  }
);

// ── Write tools ──────────────────────────────────────────

server.registerTool(
  'create_visit',
  {
    description: 'Create a new visit (timeline event) for patient. Returns created row with id.',
    inputSchema: {
      patient_id: z.number().int().positive(),
      event_date: z.string().describe('ISO date YYYY-MM-DD'),
      title: z.string(),
      description: z.string().optional(),
      category: z.string().optional().describe('visit | hospitalization | procedure | other'),
      specialist_name: z.string().optional(),
      specialist_type: z.string().optional(),
      transcription: z.string().optional(),
      ai_assessment: z.string().optional(),
    },
  },
  async (args, extra) => {
    try {
      const ctx = ctxFrom(extra);
      await ensureCanAccess(ctx, args.patient_id);
      const data = await api('/api/timeline', {
        method: 'POST',
        headers: { 'X-Patient-Id': String(args.patient_id) },
        body: args,
      });
      return ok(data);
    } catch (e) { return err(e.message); }
  }
);

server.registerTool(
  'add_diagnosis',
  {
    description: 'Add a diagnosis to patient. Returns created row with id.',
    inputSchema: {
      patient_id: z.number().int().positive(),
      name: z.string(),
      icd_code: z.string().optional(),
      status: z.enum(['active', 'closed', 'suspected']).default('active'),
      diagnosed_date: z.string().optional(),
      source: z.string().optional(),
      notes: z.string().optional(),
      ai_assessment: z.string().optional(),
    },
  },
  async (args, extra) => {
    try {
      const ctx = ctxFrom(extra);
      await ensureCanAccess(ctx, args.patient_id);
      const data = await api('/api/diagnoses', {
        method: 'POST',
        headers: { 'X-Patient-Id': String(args.patient_id) },
        body: args,
      });
      return ok(data);
    } catch (e) { return err(e.message); }
  }
);

server.registerTool(
  'add_medication',
  {
    description: 'Add a medication prescription to patient. Returns created row with id.',
    inputSchema: {
      patient_id: z.number().int().positive(),
      name: z.string(),
      dosage: z.string().optional(),
      frequency: z.string().optional(),
      start_date: z.string().optional(),
      end_date: z.string().optional(),
      prescribed_by: z.string().optional(),
      status: z.enum(['active', 'completed', 'paused']).default('active'),
      notes: z.string().optional(),
    },
  },
  async (args, extra) => {
    try {
      const ctx = ctxFrom(extra);
      await ensureCanAccess(ctx, args.patient_id);
      const data = await api('/api/medications', {
        method: 'POST',
        headers: { 'X-Patient-Id': String(args.patient_id) },
        body: args,
      });
      return ok(data);
    } catch (e) { return err(e.message); }
  }
);

server.registerTool(
  'add_lab_result',
  {
    description: 'Add a lab result (single parameter value). Group multiple results by same date+source for one panel.',
    inputSchema: {
      patient_id: z.number().int().positive(),
      test_name: z.string(),
      value: z.string(),
      unit: z.string().optional(),
      reference_min: z.string().optional(),
      reference_max: z.string().optional(),
      flag: z.string().optional().describe('high | low | critical | normal'),
      result_date: z.string(),
      source: z.string().optional(),
      notes: z.string().optional(),
    },
  },
  async (args, extra) => {
    try {
      const ctx = ctxFrom(extra);
      await ensureCanAccess(ctx, args.patient_id);
      const data = await api('/api/lab-results', {
        method: 'POST',
        headers: { 'X-Patient-Id': String(args.patient_id) },
        body: args,
      });
      return ok(data);
    } catch (e) { return err(e.message); }
  }
);

server.registerTool(
  'update_visit',
  {
    description: 'Update an existing visit (e.g. add transcription or ai_assessment after extraction).',
    inputSchema: {
      visit_id: z.number().int().positive(),
      patch: z.record(z.unknown()).describe('Partial visit object — only changed fields.'),
    },
  },
  async ({ visit_id, patch }, extra) => {
    try {
      const ctx = ctxFrom(extra);
      // Verify ownership via fetching current
      const cur = await api(`/api/timeline/${visit_id}`);
      if (cur && cur.patient_id) await ensureCanAccess(ctx, cur.patient_id);
      const data = await api(`/api/timeline/${visit_id}`, { method: 'PUT', body: patch });
      return ok(data);
    } catch (e) { return err(e.message); }
  }
);

server.registerTool(
  'add_comment',
  {
    description: 'Add a comment to an entity. Use author="ai" when leaving AI assessments.',
    inputSchema: {
      entity_type: z.string().describe('diagnosis | medication | timeline | document | etc'),
      entity_id: z.number().int(),
      text: z.string().min(1),
      author: z.enum(['user', 'ai']).default('ai'),
      patient_id: z.number().int().positive().describe('For ownership verification.'),
    },
  },
  async (args, extra) => {
    try {
      const ctx = ctxFrom(extra);
      await ensureCanAccess(ctx, args.patient_id);
      const data = await api('/api/comments', {
        method: 'POST',
        headers: { 'X-Patient-Id': String(args.patient_id) },
        body: { entity_type: args.entity_type, entity_id: args.entity_id, text: args.text, author: args.author },
      });
      return ok(data);
    } catch (e) { return err(e.message); }
  }
);

// ── AI workflow ──────────────────────────────────────────

server.registerTool(
  'ai_review_status',
  {
    description: 'Get current AI-review status for patient — what was processed, what is new since last review.',
    inputSchema: { patient_id: z.number().int().positive() },
  },
  async ({ patient_id }, extra) => {
    try {
      const ctx = ctxFrom(extra);
      await ensureCanAccess(ctx, patient_id);
      const data = await api('/api/admin/tools/ai-review', { headers: { 'X-Patient-Id': String(patient_id) } });
      return ok(data);
    } catch (e) { return err(e.message); }
  }
);

server.registerTool(
  'mark_ai_review_done',
  {
    description: 'Mark the AI-review session complete for patient. Updates the last_review_at marker.',
    inputSchema: { patient_id: z.number().int().positive() },
  },
  async ({ patient_id }, extra) => {
    try {
      const ctx = ctxFrom(extra);
      await ensureCanAccess(ctx, patient_id);
      const data = await api('/api/admin/tools/mark-reviewed', {
        method: 'POST', headers: { 'X-Patient-Id': String(patient_id) },
      });
      return ok(data);
    } catch (e) { return err(e.message); }
  }
);

server.registerTool(
  'run_sql',
  {
    description: 'Run a read-only SQL query against the database (SELECT only). Use for complex cross-table analytics.',
    inputSchema: {
      sql: z.string().describe('SQL SELECT statement. Use $1, $2 for params.'),
      params: z.array(z.unknown()).optional(),
    },
  },
  async ({ sql, params = [] }, extra) => {
    try {
      const ctx = ctxFrom(extra);
      if (ctx.role !== 'admin') return err('Only admin can run SQL');
      const trimmed = sql.trim().toUpperCase();
      if (!trimmed.startsWith('SELECT') && !trimmed.startsWith('WITH')) {
        return err('Only SELECT/WITH queries are allowed via this tool.');
      }
      const data = await api('/api/admin/tools/sql', { method: 'POST', body: { sql, params } });
      return ok(data);
    } catch (e) { return err(e.message); }
  }
);

// ─── Bearer-auth + transport mount ─────────────────────────

const app = express();
app.use(express.json({ limit: '10mb' }));

// Health endpoint (unauthenticated, for container healthcheck)
app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'anamnesis-mcp' }));

// Bearer auth on /mcp routes only
app.use('/mcp', (req, res, next) => {
  if (!MCP_TOKEN) return next(); // dev mode
  const header = req.headers.authorization || '';
  if (header !== `Bearer ${MCP_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// One persistent transport in stateless mode (no session tracking — each
// Claude tool call is independent). connect() registers the server's
// request handlers on the transport.
const transport = new StreamableHTTPServerTransport({});
await server.connect(transport);

// All MCP traffic flows through /mcp (POST for messages, GET for SSE).
app.all('/mcp', async (req, res) => {
  const ts = new Date().toISOString();
  console.log(`[mcp ${ts}] ${req.method} /mcp from ${req.ip} ua=${req.headers['user-agent'] || '-'} ct=${req.headers['content-type'] || '-'} accept=${req.headers['accept'] || '-'} body-keys=${req.body ? Object.keys(req.body).join(',') : 'none'}`);
  try {
    await transport.handleRequest(req, res, req.body);
    console.log(`[mcp ${ts}] handled OK, headersSent=${res.headersSent}, statusCode=${res.statusCode}`);
  } catch (e) {
    console.error(`[mcp ${ts}] transport error:`, e.message, e.stack);
    if (!res.headersSent) res.status(500).json({ error: e.message });
  }
});

app.listen(MCP_PORT, MCP_HOST, () => {
  console.log(`[mcp] Anamnesis MCP server listening on ${MCP_HOST}:${MCP_PORT}`);
  console.log(`[mcp] Backend: ${ANAMNESIS_URL}`);
  console.log(`[mcp] Auth: ${MCP_TOKEN ? 'Bearer enabled' : 'OPEN (dev mode)'}`);
});
