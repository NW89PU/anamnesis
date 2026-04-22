import type { ISODateString } from './common';

export interface Comment {
  id: number;
  entity_type: string;
  entity_id: number;
  text: string;
  /** 'user' (по умолчанию, от человека) или 'ai' (от AI-координатора) */
  author?: 'user' | 'ai';
  created_at: ISODateString;
}
