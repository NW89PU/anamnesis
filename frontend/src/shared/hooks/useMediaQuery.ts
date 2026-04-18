import { useEffect, useState } from 'react';

/**
 * Хук для отслеживания media query.
 *
 * Пример:
 * ```tsx
 * const isDesktop = useMediaQuery('(min-width: 1024px)');
 * ```
 *
 * Работает с SSR fallback (возвращает false при первом рендере на сервере),
 * но мы в SPA — это не критично.
 */
export function useMediaQuery(query: string): boolean {
  const getMatches = (): boolean => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  };

  const [matches, setMatches] = useState<boolean>(getMatches);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

/** Удобный шорткат: true если экран >= 1024px. */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}
