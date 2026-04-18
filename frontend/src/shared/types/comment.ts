import type { ISODateString } from './common';

export interface Comment {
  id: number;
  entity_type: string;
  entity_id: number;
  text: string;
  created_at: ISODateString;
}
