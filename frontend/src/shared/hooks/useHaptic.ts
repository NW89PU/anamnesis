import { useCallback } from 'react';
import { haptic, type HapticKind } from '@/shared/lib/haptic';

/**
 * React-обёртка над `haptic()` из `shared/lib/haptic.ts`.
 * Возвращает мемоизированную функцию, удобно передавать в onClick.
 *
 * Пример:
 * ```tsx
 * const hap = useHaptic();
 * <button onClick={() => { hap('light'); doSomething(); }}>
 * ```
 *
 * Для самых частых случаев (Button, TabBar) haptic уже встроен — используй этот
 * хук только когда нужно вызвать тактильную вибрацию из кастомного кода.
 */
export function useHaptic(): (kind?: HapticKind) => void {
  return useCallback((kind?: HapticKind) => haptic(kind), []);
}
