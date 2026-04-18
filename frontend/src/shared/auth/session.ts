/**
 * Session store — хранение токенов и patient_id.
 *
 * Архитектура:
 * - `api_token` (статический из env бэкенда) — localStorage, OK там держать (публичен и в vanilla)
 * - `session_token` (из /auth/login после ввода PIN) — localStorage для удобства
 *    (пользователь не хочет вводить PIN каждую сессию). ТОЧКА УСИЛЕНИЯ: можно перенести
 *    в sessionStorage для автоматического logout при закрытии вкладки.
 * - `patient_id` — localStorage (просто UX-выбор активного пациента)
 *
 * Сделан как модуль-функции, а НЕ React hook, потому что `api/client.ts` должен
 * читать сессию синхронно при каждом запросе — контекст туда не прокинешь.
 * Для React-кода используй `useSession()` из `AuthContext.tsx`.
 */

const KEY_API_TOKEN = 'api_token';
const KEY_SESSION_TOKEN = 'session_token';
const KEY_PATIENT_ID = 'patient_id';
const KEY_DEVICE_ID = 'device_id';

export interface Session {
  apiToken: string | null;
  sessionToken: string | null;
  patientId: number | null;
  deviceId: string | null;
}

function safeGet(key: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (value === null) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // storage full or blocked — игнорируем
  }
}

export function getSession(): Session {
  const pidRaw = safeGet(KEY_PATIENT_ID);
  return {
    apiToken: safeGet(KEY_API_TOKEN),
    sessionToken: safeGet(KEY_SESSION_TOKEN),
    patientId: pidRaw ? parseInt(pidRaw, 10) || null : null,
    deviceId: getOrCreateDeviceId(),
  };
}

/**
 * Устройство идентифицируется стабильным UUID в localStorage.
 * Используется для device trust: бэкенд запоминает известные устройства
 * и при логине с нового спрашивает секретный вопрос.
 * Пользователь может очистить localStorage — тогда устройство станет "новым"
 * и ему придётся ответить на вопрос повторно.
 */
export function getOrCreateDeviceId(): string {
  let id = safeGet(KEY_DEVICE_ID);
  if (!id) {
    // crypto.randomUUID доступен в HTTPS + localhost (все наши случаи)
    id = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    safeSet(KEY_DEVICE_ID, id);
  }
  return id;
}

export function resetDeviceId(): void {
  safeSet(KEY_DEVICE_ID, null);
}

export function setSessionToken(token: string | null): void {
  safeSet(KEY_SESSION_TOKEN, token);
}

export function setPatientId(id: number | null): void {
  safeSet(KEY_PATIENT_ID, id === null ? null : String(id));
}

export function setApiToken(token: string | null): void {
  safeSet(KEY_API_TOKEN, token);
}

export function clearSession(): void {
  safeSet(KEY_SESSION_TOKEN, null);
  // api_token и patient_id НЕ чистим — это не «сессия» в строгом смысле
}
