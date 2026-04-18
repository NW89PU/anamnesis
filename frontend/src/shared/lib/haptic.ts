/**
 * Haptic feedback — тактильная вибрация на мобилах.
 *
 * Использует стандартный `navigator.vibrate` API. На iOS Safari работает частично
 * (только в PWA / standalone), на Android Chrome работает всегда. Десктопы игнорируют.
 *
 * КОГДА ИСПОЛЬЗОВАТЬ:
 * - `light`   — тап кнопки, клик по карточке, тап таба, открытие модалки
 * - `medium`  — swipe-to-close сработал, переход между табами свайпом
 * - `heavy`   — долгий пресс (долгие подтверждения, контекстные меню)
 * - `success` — успешное добавление/сохранение, mark as done
 * - `warning` — подтверждение удаления (пока не удалил)
 * - `error`   — ошибка API, неверный PIN, отклоненная операция
 *
 * КОГДА НЕ ИСПОЛЬЗОВАТЬ:
 * - Scroll / hover / каждое движение (только TRIGGER events)
 * - В циклах (вызывать один раз на событие)
 */

export type HapticKind = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const PATTERNS: Record<HapticKind, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 30,
  success: [10, 30, 10],
  warning: [20, 40, 20],
  error: [30, 30, 30, 30, 30],
};

export function haptic(kind: HapticKind = 'light'): void {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  try {
    navigator.vibrate(PATTERNS[kind]);
  } catch {
    // некоторые браузеры могут кинуть при blocked gesture — игнорим
  }
}
