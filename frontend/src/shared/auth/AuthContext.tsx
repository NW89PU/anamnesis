import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getSession, setSessionToken, clearSession, type Session } from './session';
import { api } from '@/shared/api/client';
import { EP } from '@/shared/api/endpoints';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Auth Context — React-обёртка над session store + user identity.
 *
 * Отвечает за:
 * - Проверку валидности session_token на старте приложения
 * - Подтягивание user identity через /api/me после успешного login
 * - Logout (очистка session + перенаправление на /login или /pin)
 *
 * Используется в RequireAuth, Header (имя/email), LoginScreen, PinScreen,
 * RegisterScreen, и любых компонентах которым надо знать role / ai_enabled.
 *
 * v4.0: добавлено `user` (id, email, role, ai_enabled, patient_id). Для
 * legacy PIN-сессий без user_id (до миграции) /api/me вернёт fallback
 * с role='admin' — UI работает прозрачно.
 */

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthUser {
  id: number | null;          // null для legacy PIN-сессий без user_id
  email: string | null;
  role: 'admin' | 'user';
  ai_enabled: boolean;
  patient_id: number;
  auth_method: 'pin' | 'password';
  last_login_at?: string | null;
}

export interface AuthContextValue {
  status: AuthStatus;
  session: Session;
  user: AuthUser | null;
  login: (token: string, userFromResponse?: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  recheck: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session>(getSession);
  const [user, setUser] = useState<AuthUser | null>(null);
  const queryClient = useQueryClient();

  /**
   * Подтягиваем /api/me. Делаем отдельно от authCheck чтобы:
   *  - authCheck проверяет валидность token (бэк отвечает 401 если нет)
   *  - /me возвращает identity + role + ai_enabled (нужно для UI)
   * Если /me падает (например бэк старой версии) — оставляем user=null,
   * UI работает как раньше для admin.
   */
  const fetchMe = useCallback(async () => {
    try {
      const me = await api.get<AuthUser>(EP.authMe);
      setUser(me);
    } catch {
      // 401 уже обработан glob handler; для прочих ошибок — просто оставим null,
      // UI fallback на legacy admin поведение
      setUser(null);
    }
  }, []);

  const recheck = useCallback(async () => {
    const current = getSession();
    if (!current.sessionToken) {
      setStatus('unauthenticated');
      setSession(current);
      setUser(null);
      return;
    }
    try {
      await api.get(EP.authCheck);
      setStatus('authenticated');
      setSession(current);
      await fetchMe();
    } catch {
      clearSession();
      setSession(getSession());
      setUser(null);
      setStatus('unauthenticated');
    }
  }, [fetchMe]);

  // Проверка сессии при монтировании
  useEffect(() => {
    void recheck();
  }, [recheck]);

  // Глобальный слушатель 401/403 от api/client.ts.
  // Срабатывает когда любой запрос упал с "Требуется авторизация" или
  // "Устройство отозвано владельцем". В этом случае немедленно чистим
  // локальную сессию и переводим в unauthenticated → RequireAuth
  // редиректит на /login.
  useEffect(() => {
    const onUnauthorized = () => {
      clearSession();
      setSession(getSession());
      setUser(null);
      setStatus('unauthenticated');
      queryClient.clear();
      try {
        localStorage.removeItem('anamnesis-query-cache-v1');
      } catch {
        // ignore
      }
    };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, [queryClient]);

  const login = useCallback(
    async (token: string, userFromResponse?: AuthUser) => {
      setSessionToken(token);
      setSession(getSession());
      setStatus('authenticated');
      // Если login response уже принёс user (login-password/register) — берём
      // его сразу, иначе подтягиваем через /me (PIN/WebAuthn пути).
      if (userFromResponse) {
        setUser(userFromResponse);
      } else {
        await fetchMe();
      }
      // После успешного логина инвалидируем все queries которые могли
      // упасть с 401 пока пользователь был на экране login. React Query не
      // ретраит 401 ошибки автоматически, поэтому без invalidate они
      // останутся в error state и dashboard/timeline/... будут пустыми.
      await queryClient.invalidateQueries();
    },
    [queryClient, fetchMe]
  );

  const logout = useCallback(async () => {
    // Попытаемся уведомить сервер чтобы он ревокировал token, но не
    // блокируем UI если сеть упала — локальная очистка важнее.
    try {
      await api.post(EP.authLogout);
    } catch {
      // ignore
    }
    clearSession();
    setSession(getSession());
    setUser(null);
    setStatus('unauthenticated');
    // Очищаем весь кэш React Query — не хотим чтобы следующий пользователь
    // увидел данные предыдущего из persist cache
    queryClient.clear();
    try {
      localStorage.removeItem('anamnesis-query-cache-v1');
    } catch {
      // ignore
    }
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ status, session, user, login, logout, recheck }}>
      {children}
    </AuthContext.Provider>
  );
}

// useAuth и useMe живут в './useAuth' — импортируй оттуда напрямую.
// Раньше они были здесь, но React Fast Refresh ломается когда файл
// экспортирует и компонент, и не-компонент.
