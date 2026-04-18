import type { ElementDefinition } from 'cytoscape';

/**
 * Построение узлов и рёбер графа из patient-context.
 * Точный порт из vanilla `health-graph.js:22-154`.
 *
 * Логика связей:
 * - diagnoses, specialists, medications, timeline (visits), errors → узлы
 * - specialist → medication (m.specialist_id) — "prescribed"
 * - medication → diagnosis (prescription.diagnosis_id) — "for-diagnosis"
 * - specialist → visit (t.specialist_id) — "visited"
 * - visit → medication (prescription.timeline_id + medication_id) — "visit-med"
 * - specialist → visit (prescription.timeline_id + specialist_id) — "visited" (дубль через prescription)
 * - visit → diagnosis (visit_diagnoses) — "visit-diag"
 * - error → diagnosis (keyword matching) — "error-diag"
 *
 * Дедуп рёбер по key `source|target|type`.
 */

interface PatientContext {
  diagnoses?: Array<{ id: number; name: string; icd_code?: string | null; status?: string | null }>;
  specialists?: Array<{ id: number; full_name?: string | null; specialization?: string | null; clinic?: string | null }>;
  medications?: Array<{ id: number; name: string; status?: string | null; specialist_id?: number | null; stop_reason?: string | null }>;
  timeline?: Array<{ id: number; title: string; event_date?: string | null; specialist_id?: number | null }>;
  prescriptions?: Array<{ medication_id: number; diagnosis_id?: number | null; specialist_id?: number | null; timeline_id?: number | null }>;
  visit_diagnoses?: Array<{ visit_id: number; diagnosis_id: number; relation?: string | null }>;
  medical_errors?: Array<{ id: number; title?: string | null; description?: string | null; advice?: string | null; severity?: string | null; status?: string | null }>;
}

function truncate(s: string | null | undefined, n: number): string {
  if (!s) return '';
  return s.length > n ? s.slice(0, n) + '...' : s;
}

export function buildGraphElements(ctx: PatientContext): ElementDefinition[] {
  const nodes: ElementDefinition[] = [];
  const edges: ElementDefinition[] = [];
  const nodeSet = new Set<string>();
  const edgeSet = new Set<string>();

  function addNode(id: string, label: string, type: string, extra: Record<string, unknown> = {}): void {
    if (nodeSet.has(id)) return;
    nodeSet.add(id);
    nodes.push({
      data: {
        id,
        label: truncate(label, 22),
        fullLabel: label,
        type,
        ...extra,
      },
    });
  }

  function addEdge(source: string, target: string, label = '', type = 'default'): void {
    if (!nodeSet.has(source) || !nodeSet.has(target)) return;
    const key = `${source}|${target}|${type}`;
    if (edgeSet.has(key)) return;
    edgeSet.add(key);
    edges.push({ data: { source, target, label, type } });
  }

  // Precompute linked visits
  const linkedVisitIds = new Set<number>();
  (ctx.timeline ?? []).forEach((t) => {
    if (t.specialist_id) linkedVisitIds.add(t.id);
  });
  (ctx.prescriptions ?? []).forEach((p) => {
    if (p.timeline_id) linkedVisitIds.add(p.timeline_id);
  });
  (ctx.visit_diagnoses ?? []).forEach((vd) => {
    if (vd.visit_id) linkedVisitIds.add(vd.visit_id);
  });

  // Diagnoses
  (ctx.diagnoses ?? []).forEach((d) => {
    const label = d.icd_code ? `${d.icd_code}: ${d.name}` : d.name;
    addNode(`diag-${d.id}`, label, 'diagnosis', { icd: d.icd_code, status: d.status });
  });

  // Specialists
  (ctx.specialists ?? []).forEach((s) => {
    const name = s.full_name
      ? `${s.full_name} (${s.specialization ?? ''})`
      : s.specialization ?? '';
    addNode(`spec-${s.id}`, name, 'specialist', {
      spec: s.specialization,
      clinic: s.clinic,
      fullName: s.full_name,
    });
  });

  // Medications
  (ctx.medications ?? []).forEach((m) => {
    const label = m.status === 'completed' ? `${m.name} [завершён]` : m.name;
    addNode(`med-${m.id}`, label, 'medication', { status: m.status, stopReason: m.stop_reason });
    if (m.specialist_id) {
      addEdge(`spec-${m.specialist_id}`, `med-${m.id}`, 'назначил', 'prescribed');
    }
  });

  // Timeline (visits)
  (ctx.timeline ?? []).forEach((t) => {
    const date = t.event_date ? t.event_date.slice(0, 10) : '';
    addNode(`visit-${t.id}`, date, 'visit', {
      date: t.event_date,
      title: t.title,
      linked: linkedVisitIds.has(t.id) ? 'yes' : 'no',
    });
    if (t.specialist_id) {
      addEdge(`spec-${t.specialist_id}`, `visit-${t.id}`, '', 'visited');
    }
  });

  // Prescriptions → med→diag, visit→med, spec→visit
  (ctx.prescriptions ?? []).forEach((p) => {
    if (p.diagnosis_id) {
      addEdge(`med-${p.medication_id}`, `diag-${p.diagnosis_id}`, 'для', 'for-diagnosis');
    }
    if (p.timeline_id && p.medication_id) {
      addEdge(`visit-${p.timeline_id}`, `med-${p.medication_id}`, 'назначен', 'visit-med');
    }
    if (p.timeline_id && p.specialist_id) {
      addEdge(`spec-${p.specialist_id}`, `visit-${p.timeline_id}`, '', 'visited');
    }
  });

  // Visit-diagnoses
  (ctx.visit_diagnoses ?? []).forEach((vd) => {
    if (nodeSet.has(`visit-${vd.visit_id}`)) {
      addEdge(`visit-${vd.visit_id}`, `diag-${vd.diagnosis_id}`, vd.relation ?? '', 'visit-diag');
    }
  });

  // Medical errors — keyword matching to diagnoses
  (ctx.medical_errors ?? []).forEach((e) => {
    if (e.status !== 'open') return;
    const title = e.title ?? truncate(e.description, 40);
    addNode(`err-${e.id}`, title, 'error', {
      description: e.description,
      severity: e.severity,
      advice: e.advice,
    });

    const errText = [e.title, e.description, e.advice ?? ''].join(' ').toLowerCase();
    const keywords: Record<string, number[]> = {
      'соэ': [1, 4],
      'гемоглобин': [1, 4],
      'hgb': [1, 4],
      'ортопед': [8],
      'плоскостоп': [8],
      'ттг': [1],
      'фоо': [1, 4],
      'эхокг': [1, 4],
      'нейровоспал': [1],
      's-100': [1],
      'генетик': [7, 1],
      'истерик': [7, 1],
      'aba': [7],
    };

    for (const [kw, diagIds] of Object.entries(keywords)) {
      if (errText.includes(kw)) {
        diagIds.forEach((did) => {
          if (nodeSet.has(`diag-${did}`)) {
            addEdge(`err-${e.id}`, `diag-${did}`, '', 'error-diag');
          }
        });
        break;
      }
    }
  });

  return [...nodes, ...edges];
}

export type { PatientContext };
