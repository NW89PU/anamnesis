import type { ReactNode } from 'react';
import { useAuth } from './useAuth';
import { PatientPickerScreen } from './PatientPickerScreen';

/**
 * Guard (v4.1):
 *
 *   loading                 → пустой экран (auto-bootstrap идёт)
 *   unauthenticated         → "Refreshing..." с auto-reload через 3s
 *                             (CF Access редирект на Google login)
 *   no-patients / needs-patient → PatientPickerScreen
 *   authenticated           → AppShell (children)
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();

  if (status === 'loading') {
    return (
      <div
        style={{
          position: 'fixed', inset: 0, background: 'var(--bg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        {/* пустой — избегаем flash контента */}
      </div>
    );
  }

  if (status === 'unauthenticated') {
    // CF Access cookie невалиден или истёк → нужен полный re-login через Google.
    // Перезагружаем — CF Access сам сделает 302 на свою login page.
    setTimeout(() => window.location.reload(), 2000);
    return (
      <div
        style={{
          minHeight: '100vh', background: 'var(--bg)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 16, padding: 20,
        }}
      >
        <img src="/icons/icon.svg" alt="" style={{ width: 64, height: 64, opacity: 0.5 }} />
        <div style={{ fontSize: 16, color: 'var(--text-secondary)', textAlign: 'center' }}>
          Перезагружаемся для входа через Google…
        </div>
      </div>
    );
  }

  if (status === 'no-patients' || status === 'needs-patient') {
    return <PatientPickerScreen />;
  }

  return <>{children}</>;
}
