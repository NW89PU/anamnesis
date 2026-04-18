import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from './AuthContext';

/**
 * Guard-компонент: пропускает только аутентифицированных пользователей.
 *
 * - Во время `loading` показывает пустой экран (SW может восстанавливать сессию)
 * - Если `unauthenticated` — Navigate на /pin с сохранением исходного пути в state
 * - Если `authenticated` — рендерит children
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
        }}
      >
        {/* Пустой экран — избегаем flash контента перед редиректом */}
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/pin" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
