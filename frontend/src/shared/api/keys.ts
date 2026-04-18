/**
 * React Query keys — единая таблица истины.
 *
 * Правила:
 * - НЕ использовать строчные литералы `['dashboard']` в компонентах
 * - Инвалидация ТОЛЬКО через `qk.xxx`
 * - Иерархические ключи для бутиковых инвалидаций (`qk.timeline` инвалидирует всё под ним)
 *
 * Пример:
 * ```ts
 * // Чтение
 * useQuery({ queryKey: qk.dashboard, queryFn: () => api.get(EP.dashboard) });
 *
 * // Инвалидация после мутации
 * queryClient.invalidateQueries({ queryKey: qk.dashboard });
 *
 * // Инвалидация всего timeline + визитов
 * queryClient.invalidateQueries({ queryKey: qk.timelineAll });
 * ```
 */

export const qk = {
  // ── Dashboard ─────────────────────────────
  dashboard: ['dashboard'] as const,
  dashboardAiSummary: ['dashboard', 'ai-summary'] as const,

  // ── Patients ──────────────────────────────
  patientList: ['patient', 'list'] as const,
  patientContext: ['patient-context'] as const,

  // ── Plan ──────────────────────────────────
  plan: ['plan'] as const,
  planItem: (id: number) => ['plan', id] as const,

  // ── Errors ────────────────────────────────
  errors: ['errors'] as const,
  errorItem: (id: number) => ['errors', id] as const,

  // ── Timeline / Visits ─────────────────────
  timelineAll: ['timeline'] as const,
  timeline: ['timeline', 'list'] as const,
  timelineItem: (id: number) => ['timeline', 'item', id] as const,

  // ── Documents ─────────────────────────────
  documents: ['documents'] as const,
  documentItem: (id: number) => ['documents', id] as const,

  // ── Diagnoses ─────────────────────────────
  diagnoses: ['diagnoses'] as const,
  diagnosisItem: (id: number) => ['diagnoses', id] as const,

  // ── Medications ───────────────────────────
  medications: ['medications'] as const,
  medicationItem: (id: number) => ['medications', id] as const,

  // ── Specialists ───────────────────────────
  specialists: ['specialists'] as const,

  // ── Vaccinations ──────────────────────────
  vaccinations: ['vaccinations'] as const,
  vaccinationsSectionPhotos: ['vaccinations', 'section-photos'] as const,

  // ── Growth ────────────────────────────────
  growth: ['growth'] as const,

  // ── Lab Results ───────────────────────────
  labResults: ['lab-results'] as const,

  // ── Reminders ─────────────────────────────
  reminders: ['reminders'] as const,

  // ── Comments ──────────────────────────────
  // Для конкретной сущности — pair (entityType, entityId)
  comments: (entityType: string, entityId: number) => ['comments', entityType, entityId] as const,

  // ── AI Requests ───────────────────────────
  aiRequests: ['ai-requests'] as const,

  // ── Search ────────────────────────────────
  search: (q: string) => ['search', q] as const,

  // ── Version ───────────────────────────────
  version: ['version'] as const,
  changelog: ['changelog'] as const,
} as const;
