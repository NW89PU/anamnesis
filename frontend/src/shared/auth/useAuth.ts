import { useContext } from 'react';
import { AuthContext, type AuthContextValue, type AuthUser } from './AuthContext';

/**
 * Хук для доступа к auth-контексту. Бросает если использован вне
 * <AuthProvider>.
 *
 * Вынесен из AuthContext.tsx в отдельный файл — иначе React Fast Refresh
 * не работает при изменениях провайдера (ESLint react-refresh правило).
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

/**
 * Удобный хук для компонентов которым нужен только user.
 * Возвращает null до загрузки или если unauthenticated.
 */
export function useMe(): AuthUser | null {
  const { user } = useAuth();
  return user;
}
