import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import type { ApiError } from '@/shared/api/errors';

/**
 * Глобальный QueryClient.
 *
 * Ключевые настройки:
 * - `networkMode: 'offlineFirst'` — React Query НЕ отменяет запросы при отсутствии сети,
 *    а держит их в `fetching` состоянии. Вместе с persist-кэшем это даёт полноценный оффлайн.
 * - `gcTime: 7 дней` — кэш живёт в localStorage долго, чтобы при открытии без сети
 *    пользователь сразу видел последние данные.
 * - `retry` — НЕ ретраить 401/403 (пользователь не авторизован, нет смысла долбить).
 *
 * ВАЖНО: не импортируй этот объект в компоненты напрямую — используй `useQueryClient()`.
 * Этот export нужен только в `providers.tsx`.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // staleTime: 0 — данные всегда считаются stale, при любом новом
      // mount / focus / reconnect делается refetch. Это гарантирует что
      // пользователь видит свежие данные при каждом открытии страницы,
      // что критично в PWA где нет "hard refresh" кнопки.
      // Persist cache (gcTime 7 дней) всё равно работает — при открытии
      // сразу показывается закешированное, а на фоне идёт refetch.
      staleTime: 0,
      gcTime: 1000 * 60 * 60 * 24 * 7, // 7 дней для оффлайн-фолбэка
      networkMode: 'offlineFirst',
      // Рефетч при каждом mount компонента с useQuery — ключевой пункт:
      // открыл модалку визита → CommentsSection сразу идёт за свежими данными
      refetchOnMount: 'always',
      // При возврате в PWA из другого приложения (visibilitychange) —
      // обновляем все активные queries. В PWA это часто случается.
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        const status = (error as ApiError | undefined)?.status;
        if (status === 401 || status === 403) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      networkMode: 'offlineFirst',
      retry: false,
    },
  },
});

/**
 * Persister — сохраняет кэш React Query в localStorage, чтобы оффлайн-пользователь
 * видел данные мгновенно при открытии приложения.
 *
 * throttleTime: 1000 — не чаще раза в секунду записываем в localStorage, чтобы не тормозить.
 */
export const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'anamnesis-query-cache-v1',
  throttleTime: 1000,
});
