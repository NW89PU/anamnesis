import type { ISODateString } from './common';

export type ReminderStatus = 'pending' | 'sent' | 'dismissed';

export interface Reminder {
  id: number;
  patient_id: number;
  title: string;
  message: string | null;
  remind_at: ISODateString;
  status: ReminderStatus;
  recurring: string | null;
  created_at: ISODateString;
  updated_at: ISODateString;
}
