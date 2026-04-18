import type { ISODateString } from './common';

/**
 * Категории документов — совпадают с vanilla `frontend/js/pages/documents.js`.
 */
export type DocumentCategory = 'lab' | 'imaging' | 'prescription' | 'report' | 'other';

/**
 * Document — как возвращает бэкенд из PostgreSQL таблицы `documents`.
 *
 * ВАЖНО: `file_path` это путь к файлу на диске (нужно урезать до имени файла
 * для URL). Используй `docFileUrl(doc)` из `features/documents/lib/file-url.ts`.
 */
export interface Document {
  id: number;
  patient_id: number;
  timeline_id: number | null;
  title: string | null;
  description: string | null;
  category: DocumentCategory | string | null;
  file_path: string | null;
  original_name: string | null;
  mime_type: string | null;
  file_size: number | null;
  preview_url: string | null;
  transcription: string | null;
  ai_assessment: string | null;
  ai_sources: string | null;
  ai_assessed_at: ISODateString | null;
  source_doctor: string | null;
  source_org: string | null;
  document_date: string | null;  // YYYY-MM-DD — дата на самом документе (не загрузки)
  file_hash: string | null;
  page_count: number | null;
  parent_document_id: number | null;
  quality: 'good' | 'low' | 'duplicate' | 'needs_source' | 'conflict' | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}
