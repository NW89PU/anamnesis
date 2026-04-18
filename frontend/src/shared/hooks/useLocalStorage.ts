import { useCallback, useEffect, useState } from 'react';

/**
 * Хук localStorage с SSR-safe fallback и синхронизацией между вкладками.
 *
 * Пример:
 * ```tsx
 * const [collapsed, setCollapsed] = useLocalStorage('dashboard-diagnoses-collapsed', true);
 * ```
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initialValue;
    } catch (err) {
      console.warn(`useLocalStorage: read error for key "${key}"`, err);
      return initialValue;
    }
  }, [key, initialValue]);

  const [stored, setStored] = useState<T>(readValue);

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStored((prev) => {
        const next = value instanceof Function ? value(prev) : value;
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch (err) {
          console.warn(`useLocalStorage: write error for key "${key}"`, err);
        }
        return next;
      });
    },
    [key]
  );

  // Синхронизация между вкладками
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key || e.newValue === null) return;
      try {
        setStored(JSON.parse(e.newValue) as T);
      } catch {
        // ignore malformed
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [key]);

  return [stored, setValue];
}
