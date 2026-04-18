/**
 * Rate limiting попыток ввода PIN на клиенте (UX layer).
 *
 * Логика экспоненциального backoff:
 * - 1-2 попытки — без задержки
 * - 3-я неудачная подряд = блок 1 мин
 * - 4-я = 2 мин
 * - 5-я = 4 мин
 * - 6-я = 8 мин
 * - 7-я = 16 мин
 * - 8-я = 32 мин
 * - N-я = 2^(N-3) минут, cap на 24 часа
 * - При успешном вводе — счётчик обнуляется
 *
 * ВАЖНО: это ТОЛЬКО UX слой. Реальная защита — на сервере
 * (backend auth-session.js + auth_lockouts табл). Клиент-сайд
 * можно обойти очисткой localStorage, поэтому на него нельзя
 * полагаться как на security boundary.
 */

const KEY = 'pin-lockout-v1';
const FAIL_THRESHOLD = 3;
const MAX_LOCKOUT_MINUTES = 24 * 60; // 24 часа максимум

interface LockoutState {
  attempts: number;
  lockedUntil: number | null; // unix ms
}

function read(): LockoutState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { attempts: 0, lockedUntil: null };
    const parsed = JSON.parse(raw) as Partial<LockoutState>;
    return {
      attempts: Number(parsed.attempts) || 0,
      lockedUntil: parsed.lockedUntil ? Number(parsed.lockedUntil) : null,
    };
  } catch {
    return { attempts: 0, lockedUntil: null };
  }
}

function write(s: LockoutState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
}

export function recordFailure(): void {
  const s = read();
  s.attempts++;
  if (s.attempts >= FAIL_THRESHOLD) {
    // 3 → 1 мин, 4 → 2, 5 → 4, 6 → 8, ... cap 24ч
    const overshoot = s.attempts - FAIL_THRESHOLD;
    const lockMinutes = Math.min(Math.pow(2, overshoot), MAX_LOCKOUT_MINUTES);
    s.lockedUntil = Date.now() + lockMinutes * 60_000;
  }
  write(s);
}

/**
 * Принудительная установка локаута от сервера (когда бэкенд вернул 429
 * с Retry-After или нашим custom полем). Используется после verify-device
 * или login если сервер вернул locked_until.
 */
export function setServerLockout(lockedUntilMs: number, attempts: number): void {
  write({ attempts, lockedUntil: lockedUntilMs });
}

export function recordSuccess(): void {
  write({ attempts: 0, lockedUntil: null });
}

export interface LockoutStatus {
  locked: boolean;
  remainingMs: number;
  remainingSec: number;
  attempts: number;
}

export function getLockoutStatus(): LockoutStatus {
  const s = read();
  if (!s.lockedUntil) {
    return { locked: false, remainingMs: 0, remainingSec: 0, attempts: s.attempts };
  }
  const remainingMs = Math.max(0, s.lockedUntil - Date.now());
  return {
    locked: remainingMs > 0,
    remainingMs,
    remainingSec: Math.ceil(remainingMs / 1000),
    attempts: s.attempts,
  };
}
