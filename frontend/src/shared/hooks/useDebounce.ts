import { useEffect, useState } from 'react';

/**
 * Дебаунс значения — используется для поиска (задержка 300мс между нажатиями).
 *
 * Пример:
 * ```tsx
 * const [query, setQuery] = useState('');
 * const debounced = useDebounce(query, 300);
 * useQuery({ queryKey: qk.search(debounced), queryFn: () => api.get(...), enabled: !!debounced });
 * ```
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handle);
  }, [value, delay]);

  return debounced;
}
