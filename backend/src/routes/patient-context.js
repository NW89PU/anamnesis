const { Router } = require('express');
const { rawDb } = require('../db');

const router = Router();

function stripFields(row, fields) {
  if (!row) return row;
  const next = { ...row };
  for (const field of fields) delete next[field];
  return next;
}

function stripArray(rows, fields) {
  return rows.map(row => stripFields(row, fields));
}

// GET /api/patient-context — FULL patient snapshot for AI analysis
// Returns ALL data for a patient in a single call.
// This is the endpoint Claude uses before any analysis, comment response,
// or AI request processing to have complete picture of the patient.
router.get('/', (req, res) => {
  try {
    const pid = req.patientId;

    // ── Patient profile ─────────────────────────────────────
    const patient = rawDb.prepare('SELECT * FROM patient WHERE id = ?').get(pid) || null;

    // ── Diagnoses (ALL, not just active) ────────────────────
    const diagnosesRaw = rawDb.prepare(
      'SELECT * FROM diagnoses WHERE patient_id = ? ORDER BY status ASC, diagnosed_date DESC'
    ).all(pid);
    const diagnoses = stripArray(diagnosesRaw, ['ai_assessment']);

    // ── Medications (ALL — active, stopped, completed) ──────
    const medicationsRaw = rawDb.prepare(`
      SELECT m.*, s.full_name as prescribed_by_name, s.specialization as prescribed_by_spec
      FROM medications m
      LEFT JOIN specialists s ON m.specialist_id = s.id
      WHERE m.patient_id = ?
      ORDER BY m.status ASC, m.start_date DESC
    `).all(pid);
    const medications = stripArray(medicationsRaw, ['ai_assessment']);

    // ── Specialists ─────────────────────────────────────────
    const specialists = rawDb.prepare(
      'SELECT * FROM specialists WHERE patient_id = ? ORDER BY status ASC, full_name ASC'
    ).all(pid);

    // ── Timeline (ALL visits/events) with documents ─────────
    const timelineRows = rawDb.prepare(`
      SELECT t.*, s.full_name as specialist_name_resolved, s.specialization as specialist_specialty
      FROM timeline t
      LEFT JOIN specialists s ON t.specialist_id = s.id
      WHERE t.patient_id = ?
      ORDER BY t.event_date DESC
    `).all(pid);

    const documents = rawDb.prepare(
      'SELECT * FROM documents WHERE patient_id = ? ORDER BY created_at DESC'
    ).all(pid);

    // Attach docs to timeline events
    const docsByTimeline = {};
    const standaloneDocs = [];
    for (const doc of documents) {
      if (doc.timeline_id) {
        if (!docsByTimeline[doc.timeline_id]) docsByTimeline[doc.timeline_id] = [];
        docsByTimeline[doc.timeline_id].push(stripFields(doc, ['ai_assessment']));
      } else {
        standaloneDocs.push(stripFields(doc, ['ai_assessment']));
      }
    }

    const timeline = timelineRows.map(t => ({
      ...stripFields(t, ['ai_assessment']),
      documents: docsByTimeline[t.id] || [],
    }));

    // ── Medical errors ──────────────────────────────────────
    const medicalErrorsRaw = rawDb.prepare(
      'SELECT * FROM medical_errors WHERE patient_id = ? ORDER BY status ASC, error_date DESC'
    ).all(pid);
    const medical_errors = stripArray(medicalErrorsRaw, ['ai_assessment']);

    // ── Plan ────────────────────────────────────────────────
    const planRaw = rawDb.prepare(
      'SELECT * FROM plan WHERE patient_id = ? ORDER BY status ASC, sort_order ASC'
    ).all(pid);
    const plan = stripArray(planRaw, ['ai_assessment']);

    // ── Lab results ─────────────────────────────────────────
    const lab_results = rawDb.prepare(
      'SELECT * FROM lab_results WHERE patient_id = ? ORDER BY test_date DESC, parameter ASC'
    ).all(pid);

    // ── Vaccinations ────────────────────────────────────────
    const vaccinations = rawDb.prepare(
      'SELECT * FROM vaccinations WHERE patient_id = ? ORDER BY actual_date DESC, scheduled_date DESC'
    ).all(pid);

    // ── Growth log ──────────────────────────────────────────
    const growth_log = rawDb.prepare(
      'SELECT * FROM growth_log WHERE patient_id = ? ORDER BY measured_at DESC'
    ).all(pid);

    // ── Prescriptions (medication↔diagnosis↔specialist links) ─
    const prescriptions = rawDb.prepare(`
      SELECT p.*,
             m.name as medication_name, m.dosage, m.status as medication_status,
             d.name as diagnosis_name, d.status as diagnosis_status,
             s.full_name as specialist_name, s.specialization as specialty,
             t.title as visit_title, t.event_date as visit_date
      FROM prescriptions p
      LEFT JOIN medications m ON p.medication_id = m.id
      LEFT JOIN diagnoses d ON p.diagnosis_id = d.id
      LEFT JOIN specialists s ON p.specialist_id = s.id
      LEFT JOIN timeline t ON p.timeline_id = t.id
      WHERE p.patient_id = ?
      ORDER BY p.created_at DESC
    `).all(pid);

    // ── Visit-diagnosis links ───────────────────────────────
    const visit_diagnoses = rawDb.prepare(`
      SELECT vd.*,
             t.title as visit_title, t.event_date as visit_date,
             d.name as diagnosis_name
      FROM visit_diagnoses vd
      LEFT JOIN timeline t ON vd.visit_id = t.id
      LEFT JOIN diagnoses d ON vd.diagnosis_id = d.id
      WHERE vd.patient_id = ?
      ORDER BY t.event_date DESC
    `).all(pid);

    // ── Reminders ───────────────────────────────────────────
    const reminders = rawDb.prepare(
      'SELECT * FROM reminders WHERE patient_id = ? ORDER BY status ASC, remind_at ASC'
    ).all(pid);

    // ── Pending AI requests ─────────────────────────────────
    const ai_requests = rawDb.prepare(
      "SELECT * FROM ai_requests WHERE patient_id = ? AND status = 'pending' ORDER BY created_at ASC"
    ).all(pid);

    // ── Operational snapshot (v3) ────────────────────────────
    // Всё что нужно Claude в начале сессии чтобы понять "что делать":
    // - last_ai_review_at — чтобы выцепить что нового с прошлого прохода
    // - integrity_ok / fk_violations — целостность БД
    // - orphan_summary — краткая сводка сирот (полный отчёт — /api/admin/tools/orphan-check)

    const lastReviewSetting = rawDb.prepare(
      "SELECT value FROM app_settings WHERE key = ?"
    ).get(`last_ai_review_at_${pid}`);
    const lastAiReviewAt = lastReviewSetting?.value || '1970-01-01 00:00:00';

    let integrityOk = true;
    let fkViolations = [];
    try {
      const integrity = rawDb.pragma('integrity_check');
      integrityOk = integrity.length === 1 && integrity[0].integrity_check === 'ok';
      fkViolations = rawDb.pragma('foreign_key_check');
    } catch (e) {}

    const orphanSummary = {
      prescriptions_with_dead_fk: rawDb.prepare(`
        SELECT COUNT(*) AS c FROM prescriptions p
        LEFT JOIN medications m ON m.id=p.medication_id
        WHERE p.patient_id=? AND p.medication_id IS NOT NULL AND m.id IS NULL
      `).get(pid).c,
      medications_without_prescription: rawDb.prepare(`
        SELECT COUNT(*) AS c FROM medications m
        WHERE m.patient_id=? AND NOT EXISTS(SELECT 1 FROM prescriptions p WHERE p.medication_id=m.id)
      `).get(pid).c,
      documents_flagged: rawDb.prepare(
        "SELECT COUNT(*) AS c FROM documents WHERE patient_id=? AND quality != 'good'"
      ).get(pid).c,
      new_since_last_review: rawDb.prepare(`
        SELECT COUNT(*) AS c FROM (
          SELECT 1 FROM timeline WHERE patient_id=? AND (created_at > ? OR updated_at > ?)
          UNION ALL
          SELECT 1 FROM documents WHERE patient_id=? AND (created_at > ? OR updated_at > ?)
          UNION ALL
          SELECT 1 FROM comments WHERE patient_id=? AND created_at > ?
        )
      `).get(pid, lastAiReviewAt, lastAiReviewAt, pid, lastAiReviewAt, lastAiReviewAt, pid, lastAiReviewAt).c,
    };

    // ── Stats ───────────────────────────────────────────────
    const stats = {
      total_diagnoses: diagnoses.length,
      active_diagnoses: diagnoses.filter(d => d.status === 'active').length,
      total_medications: medications.length,
      active_medications: medications.filter(m => m.status === 'active').length,
      total_visits: timeline.length,
      total_documents: documents.length,
      total_lab_results: lab_results.length,
      abnormal_lab_results: lab_results.filter(l => l.status !== 'normal').length,
      open_errors: medical_errors.filter(e => e.status === 'open').length,
      pending_plan_items: plan.filter(p => p.status !== 'done').length,
      pending_ai_requests: ai_requests.length,
    };

    res.json({
      patient,
      diagnoses,
      medications,
      specialists,
      timeline,
      standalone_documents: standaloneDocs,
      medical_errors,
      plan,
      lab_results,
      vaccinations,
      growth_log,
      prescriptions,
      visit_diagnoses,
      reminders,
      ai_requests,
      stats,
      // v3: operational metadata for AI coordinator
      meta: {
        last_ai_review_at: lastAiReviewAt,
        integrity_ok: integrityOk,
        fk_violations: fkViolations,
        orphan_summary: orphanSummary,
        needs_attention: !integrityOk || fkViolations.length > 0 ||
          orphanSummary.prescriptions_with_dead_fk > 0 ||
          orphanSummary.documents_flagged > 0 ||
          orphanSummary.new_since_last_review > 0,
      },
    });
  } catch (err) {
    console.error('Error building patient context:', err);
    res.status(500).json({ error: 'Internal error' });
  }
});

module.exports = router;
