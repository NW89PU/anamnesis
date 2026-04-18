/**
 * Общие типы, используемые в нескольких сущностях.
 *
 * Источник правды — читать схему из `backend/src/db.js`.
 */

export type ISODateString = string;

export type Severity = 'critical' | 'warning' | 'info';

export type EntityStatus = 'active' | 'resolved' | 'suspected' | 'completed' | 'stopped';

/** Приоритет для плана/ошибок */
export type Priority = 'urgent' | 'high' | 'medium' | 'low';
