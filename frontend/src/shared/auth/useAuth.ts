import { useContext } from 'react';
import { AuthContext, type AuthContextValue, type AuthUser, type AuthPatient } from './AuthContext';

// Re-export для удобства консьюмеров (модалок и др.)
export type { AuthUser, AuthPatient };

/**
 * Хук для доступа к auth-контексту. Бросает если использован вне <AuthProvider>.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/** Текущий user. null до загрузки или если unauthenticated. */
export function useMe(): AuthUser | null {
  return useAuth().user;
}

/** Активный пациент (объект, не id). null если не выбран. */
export function useActivePatient(): AuthPatient | null {
  return useAuth().activePatient;
}

/** Список всех patients принадлежащих текущему user-у. */
export function usePatients(): AuthPatient[] {
  return useAuth().patients;
}
