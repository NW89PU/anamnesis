import { api } from '@/shared/api/client';
import { EP } from '@/shared/api/endpoints';
import type { Timeline, Document } from '@/shared/types';

export const fetchTimeline = (): Promise<Timeline[]> => api.get<Timeline[]>(EP.timeline);

export const fetchTimelineItem = (id: number): Promise<Timeline> =>
  api.get<Timeline>(EP.timelineItem(id));

export const fetchAllDocuments = (): Promise<Document[]> => api.get<Document[]>(EP.documents);

// ── CRUD визитов (timeline) ────────────────────────────

export interface VisitInput {
  title: string;
  event_date: string;
  specialist_id?: number | null;
  specialist_name?: string | null;
  specialist_type?: string | null;
  category?: string | null;
  description?: string | null;
  transcription?: string | null;
  ai_assessment?: string | null;
  notes?: string | null;
}

export const createVisit = (data: VisitInput): Promise<Timeline> =>
  api.post<Timeline>(EP.timeline, data);

export const updateVisit = (id: number, data: VisitInput): Promise<Timeline> =>
  api.put<Timeline>(EP.timelineItem(id), data);

export const deleteVisit = (id: number): Promise<void> =>
  api.del<void>(EP.timelineItem(id));

// ── Upload документа ──────────────────────────────────

export interface UploadDocumentInput {
  file: File;
  title: string;
  category: string;
  notes?: string;
  timeline_id?: number | null;
}

export const uploadDocument = (input: UploadDocumentInput): Promise<Document> => {
  const formData = new FormData();
  formData.append('file', input.file);
  formData.append('title', input.title);
  formData.append('category', input.category);
  if (input.notes) formData.append('notes', input.notes);
  if (input.timeline_id != null) formData.append('timeline_id', String(input.timeline_id));
  return api.upload<Document>(EP.documents, formData);
};

// ── AI requests (для timeline и документов) ───────────

interface AiRequestCreate {
  entity_type: 'timeline' | 'document' | 'diagnosis' | 'medication';
  entity_id: number;
}
export const createAiRequest = (data: AiRequestCreate): Promise<unknown> =>
  api.post(EP.aiRequests, data);

export const fetchPendingAiRequests = (): Promise<Array<{ entity_type: string; entity_id: number }>> =>
  api.get(`${EP.aiRequests}?status=pending`);
