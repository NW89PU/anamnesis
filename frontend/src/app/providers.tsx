import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { RouterProvider } from 'react-router';
import { queryClient, persister } from './query-client';
import { router } from './router';
import { AuthProvider } from '@/shared/auth/AuthContext';

/**
 * Корневое дерево провайдеров.
 *
 * Порядок важен:
 * 1. PersistQueryClientProvider — кэш React Query должен быть восстановлен
 *    ДО того, как RouterProvider начнёт рендерить страницы (иначе увидим flash).
 * 2. AuthProvider — должен быть выше RouterProvider, чтобы `RequireAuth` внутри
 *    роутера мог читать контекст.
 * 3. RouterProvider — создаёт Router из `router.tsx`.
 */
export function AppProviders() {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 дней
        buster: 'v1', // сменить при мажорном обновлении схемы данных
      }}
    >
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
