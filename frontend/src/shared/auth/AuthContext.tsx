import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { getSession, setSessionToken, clearSession, setPatientId, type Session } from './session';
import { api } from '@/shared/api/client';
import { EP } from '@/shared/api/endpoints';
import { ApiError } from '@/shared/api/errors';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Auth Context (v4.1) — Google-only via Cloudflare Access + N patients per user.
 *
 * Стейт-машина:
 *   loading        — на mount, пока не отвечает /api/me
 *   no-patients    — авторизован, но пациентов 0 → PatientPicker «Добавь первого»
 *   needs-patient  — авторизован, есть пациенты, но активный не выбран → PatientPicker
 *   authenticated  — есть активный пациент → AppShell
 *   unauthenticated — нет валидной session + CF JWT не передан/невалиден
 *
 * Bootstrap flow:
 *   1. Mount: GET /api/me
 *   2. 200 → setUser, setPatients, активный из session.active_patient_id
 *   3. 401 + needs_bootstrap=true → POST /api/auth/cf-bootstrap → 201 token+user+patients
 *      → save token, повторно GET /api/me
 *   4. 401 без needs_bootstrap → status='unauthenticated' (показываем экран refresh)
 *
 * При status='authenticated', активный пациент хранится в session.active_patient_id
 * на бэке + в session.patientId в localStorage (для X-Patient-Id header). При
 * setActivePatient оба обновляются + invalidate React Query.
 */

type AuthStatus = 'loading' | 'no-patients' | 'needs-patient' | 'authenticated' | 'unauthenticated';

export interface AuthUser {
  id: number;
  email: string;
  role: 'admin' | 'user';
  ai_enabled: boolean;
  last_login_at?: string | null;
}

export interface AuthPatient {
  id: number;
  full_name: string;
  date_of_birth: string | null;
  gender: string | null;
  relationship: string | null;
}

export interface AuthContextValue {
  status: AuthStatus;
  session: Session;
  user: AuthUser | null;
  patients: AuthPatient[];
  activePatientId: number | null;
  activePatient: AuthPatient | null;
  setActivePatient: (id: number | null) => Promise<void>;
  reloadPatients: () => Promise<void>;
  logout: () => Promise<void>;
  recheck: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

interface MeResponse {
  user: AuthUser;
  patients: AuthPatient[];
  active_patient_id: number | null;
}

interface BootstrapResponse {
  token: string;
  expires_days: number;
  user: AuthUser;
  patients: AuthPatient[];
  active_patient_id: number | null;
}

function deriveStatus(user: AuthUser | null, patients: AuthPatient[], activeId: number | null): AuthStatus {
  if (!user) return 'unauthenticated';
  if (patients.length === 0) return 'no-patients';
  if (!activeId) return 'needs-patient';
  return 'authenticated';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [session, setSession] = useState<Session>(getSession);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [patients, setPatients] = useState<AuthPatient[]>([]);
  const [activePatientId, setActivePatientId] = useState<number | null>(null);
  const queryClient = useQueryClient();

  const applyMe = useCallback((me: MeResponse) => {
    setUser(me.user);
    setPatients(me.patients);
    setActivePatientId(me.active_patient_id);
    // sync local patientId for header — null если active не выбран
    setPatientId(me.active_patient_id);
    setSession(getSession());
    setStatus(deriveStatus(me.user, me.patients, me.active_patient_id));
  }, []);

  const tryBootstrap = useCallback(async (): Promise<boolean> => {
    try {
      const data = await api.post<BootstrapResponse>(EP.authCfBootstrap);
      setSessionToken(data.token);
      applyMe({
        user: data.user,
        patients: data.patients,
        active_patient_id: data.active_patient_id,
      });
      return true;
    } catch {
      return false;
    }
  }, [applyMe]);

  const recheck = useCallback(async () => {
    try {
      const me = await api.get<MeResponse>(EP.authMe);
      applyMe(me);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        const needsBootstrap = (err.data as { needs_bootstrap?: boolean } | null)?.needs_bootstrap;
        if (needsBootstrap) {
          const ok = await tryBootstrap();
          if (ok) return;
        }
      }
      // unauthenticated — нет валидной session и CF JWT не помог
      clearSession();
      setUser(null);
      setPatients([]);
      setActivePatientId(null);
      setSession(getSession());
      setStatus('unauthenticated');
    }
  }, [applyMe, tryBootstrap]);

  // Initial bootstrap on mount
  useEffect(() => {
    void recheck();
  }, [recheck]);

  // Глобальный 401-обработчик — если session протухла во время работы
  useEffect(() => {
    const onUnauthorized = () => {
      clearSession();
      setUser(null);
      setPatients([]);
      setActivePatientId(null);
      setSession(getSession());
      setStatus('unauthenticated');
      queryClient.clear();
      try { localStorage.removeItem('anamnesis-query-cache-v1'); } catch { /* */ }
      // CF Access cookie скорее всего ещё валиден → попробуем bootstrap
      // через короткий тайм-аут чтобы UI успел показать состояние смены.
      setTimeout(() => { void recheck(); }, 100);
    };
    window.addEventListener('auth:unauthorized', onUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', onUnauthorized);
  }, [queryClient, recheck]);

  const setActivePatient = useCallback(async (id: number | null) => {
    try {
      await api.post(EP.authActivePatient, { patient_id: id });
    } catch (err) {
      console.error('Failed to set active patient on server:', err);
      // продолжаем локально, на бэке patientId-middleware всё равно fallback-нёт
    }
    setActivePatientId(id);
    setPatientId(id);
    setSession(getSession());
    setStatus(deriveStatus(user, patients, id));
    await queryClient.invalidateQueries();
    try { localStorage.removeItem('anamnesis-query-cache-v1'); } catch { /* */ }
  }, [user, patients, queryClient]);

  const reloadPatients = useCallback(async () => {
    try {
      const me = await api.get<MeResponse>(EP.authMe);
      applyMe(me);
    } catch {
      // ignore
    }
  }, [applyMe]);

  const logout = useCallback(async () => {
    try { await api.post(EP.authLogout); } catch { /* */ }
    clearSession();
    setUser(null);
    setPatients([]);
    setActivePatientId(null);
    setSession(getSession());
    setStatus('unauthenticated');
    queryClient.clear();
    try { localStorage.removeItem('anamnesis-query-cache-v1'); } catch { /* */ }
  }, [queryClient]);

  const activePatient = patients.find((p) => p.id === activePatientId) ?? null;

  return (
    <AuthContext.Provider
      value={{
        status, session, user, patients, activePatientId, activePatient,
        setActivePatient, reloadPatients, logout, recheck,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// useAuth и useMe импортируй из './useAuth' (Fast Refresh требование).
