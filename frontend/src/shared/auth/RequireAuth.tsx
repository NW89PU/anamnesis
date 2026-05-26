import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useAuth } from './useAuth';

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
    // v4.0: основной экран входа — /login (email + password).
    // PIN-screen остаётся доступен из /login как fast-path для тех,
    // кто уже привязал устройство (PIN/WebAuthn).
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
