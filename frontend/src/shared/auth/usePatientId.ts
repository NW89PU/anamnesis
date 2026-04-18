import { useSyncExternalStore } from 'react';
import { getSession, setPatientId as setPatientIdInStorage } from './session';

/**
 * Реактивный хук для активного patient_id.
 *
 * Проблема: сессия хранится в localStorage (см. session.ts), чтобы API-клиент
 * мог читать её синхронно при каждом запросе. Но localStorage — не React state,
 * изменения не триггерят ре-рендер.
 *
 * Решение: простой in-memory event bus + useSyncExternalStore. Когда
 * `changePatient(id)` вызывается — обновляется localStorage И триггерится
 * событие, на которое подписаны все компоненты через этот хук.
 */

type Listener = () => void;
const listeners = new Set<Listener>();

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): number {
  return getSession().patientId ?? 1;
}

/** Реактивно читает текущий patient_id. Ре-рендерится при changePatient. */
export function usePatientId(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Меняет активного пациента — обновляет localStorage + уведомляет подписчиков. */
export function changePatient(id: number): void {
  setPatientIdInStorage(id);
  // Notify all subscribers
  listeners.forEach((fn) => fn());
}
