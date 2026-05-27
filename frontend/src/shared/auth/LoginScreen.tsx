import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router';
import { IconMail, IconLock, IconUserPlus, IconFingerprint } from '@tabler/icons-react';
import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { api } from '@/shared/api/client';
import { EP } from '@/shared/api/endpoints';
import { useAuth } from './useAuth';
import type { AuthUser } from './AuthContext';
import { ApiError } from '@/shared/api/errors';
import { haptic } from '@/shared/lib/haptic';

/**
 * v4.0 primary login screen — email + password.
 *
 * PIN-вход остаётся доступен как fast-path (для уже зарегистрированных
 * на этом устройстве) через ссылку «Войти по PIN» внизу.
 *
 * Поток:
 *   1. POST /api/auth/login-password { email, password }
 *   2. Backend → { token, expires_days, user: {id, email, role, ai_enabled, patient_id} }
 *   3. login(token, user) → AuthContext, навигация на ранее запрошенный путь
 *
 * Лимиты: бэк держит exponential backoff (3+ попытки → лок). Клиент-сайд
 * лимита нет (PIN-screen rate-limit это локальный mechanism для 6-значного
 * пина; для пароля бэка достаточно).
 */

interface LoginResponse {
  token: string;
  expires_days: number;
  user: AuthUser;
}

export function LoginScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [remainingSec, setRemainingSec] = useState(0);
  const [cfEmail, setCfEmail] = useState<string | null>(null);
  const [cfEnabled, setCfEnabled] = useState(false);
  const [webauthnAvailable, setWebauthnAvailable] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  // Проверяем доступна ли биометрия на этом устройстве + зарегистрирован
  // ли passkey на сервере. Если нет — кнопку «Face ID» не показываем.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!browserSupportsWebAuthn()) return;
      try {
        const resp = await api.get<{ available: boolean }>(EP.webauthnAvailable);
        if (!cancelled) setWebauthnAvailable(resp.available === true);
      } catch {
        // fail silently — биометрия опциональна
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Если за CF Access и email детектирован — предзаполняем поле.
  // Юзеру всё равно нужно ввести пароль, но email не приходится печатать.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await api.get<{ cf_enabled: boolean; cf_email: string | null }>(
          EP.authCfStatus
        );
        if (cancelled) return;
        setCfEnabled(status.cf_enabled);
        if (status.cf_email) {
          setCfEmail(status.cf_email);
          setEmail(status.cf_email);
        }
      } catch {
        // CF status недоступен — продолжаем без преднастройки
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Обратный отсчёт локаута
  useEffect(() => {
    if (!lockedUntil) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setRemainingSec(remaining);
      if (remaining === 0) setLockedUntil(null);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting || lockedUntil) return;
      if (!email.trim() || !password) {
        setError('Введите email и пароль');
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const data = await api.post<LoginResponse>(EP.authLoginPassword, {
          email: email.trim().toLowerCase(),
          password,
        });
        await login(data.token, data.user);
        haptic('success');
        navigate(from, { replace: true });
      } catch (err) {
        haptic('error');
        if (err instanceof ApiError) {
          if (err.status === 429) {
            const data = err.data as { remaining_sec?: number } | null;
            const sec = data?.remaining_sec ?? 60;
            setLockedUntil(Date.now() + sec * 1000);
            setError(`Слишком много попыток. Подождите ${sec}с.`);
          } else if (err.status === 401) {
            setError('Неверный email или пароль');
          } else if (err.status === 0) {
            setError('Нет соединения с сервером');
          } else {
            setError(err.message || 'Ошибка входа');
          }
        } else {
          setError('Ошибка входа');
        }
        setPassword('');
      } finally {
        setSubmitting(false);
      }
    },
    [email, password, submitting, lockedUntil, login, navigate, from]
  );

  const tryWebAuthn = useCallback(async () => {
    if (!webauthnAvailable || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const options = await api.get(EP.webauthnLoginOptions);
      haptic('light');
      const assertion = await startAuthentication({
        optionsJSON: options as Parameters<typeof startAuthentication>[0]['optionsJSON'],
      });
      const data = await api.post<{ token: string }>(EP.webauthnLoginVerify, { response: assertion });
      if (!data.token) throw new ApiError('Нет токена', 500);
      await login(data.token);
      haptic('success');
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        // Юзер отменил Face ID prompt — без ошибки
        setError(null);
      } else {
        haptic('error');
        setError(err instanceof ApiError ? err.message : 'Ошибка биометрии');
      }
    } finally {
      setSubmitting(false);
    }
  }, [webauthnAvailable, submitting, login, navigate, from]);

  const isLocked = !!lockedUntil && remainingSec > 0;
  const canSubmit = !submitting && !isLocked && email.trim().length > 0 && password.length > 0;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '20px',
        background: 'var(--bg)',
      }}
    >
      <img
        src="/icons/icon.svg"
        alt="Anamnesis"
        style={{
          width: 80,
          height: 80,
          marginBottom: 24,
          filter: 'drop-shadow(0 8px 24px rgba(121,28,231,0.3))',
        }}
      />

      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          color: 'var(--text)',
          margin: 0,
          marginBottom: 6,
        }}
      >
        Anamnesis
      </h1>
      <div
        style={{
          fontSize: 14,
          color: 'var(--text-secondary)',
          marginBottom: 32,
          textAlign: 'center',
        }}
      >
        Вход в аккаунт
      </div>

      <form
        onSubmit={submit}
        style={{
          width: '100%',
          maxWidth: 360,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div style={{ position: 'relative' }}>
          <IconMail
            size={18}
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)',
            }}
          />
          <input
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="email@example.com"
            value={email}
            disabled={!!cfEmail}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            style={{
              width: '100%',
              padding: '14px 16px 14px 42px',
              borderRadius: 12,
              border: `1px solid ${error ? 'var(--red)' : 'var(--border)'}`,
              background: cfEmail ? 'var(--bg)' : 'var(--card)',
              fontSize: 16,
              color: 'var(--text)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ position: 'relative' }}>
          <IconLock
            size={18}
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-secondary)',
            }}
          />
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Пароль"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            style={{
              width: '100%',
              padding: '14px 16px 14px 42px',
              borderRadius: 12,
              border: `1px solid ${error ? 'var(--red)' : 'var(--border)'}`,
              background: 'var(--card)',
              fontSize: 16,
              color: 'var(--text)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <div
            style={{
              fontSize: 13,
              color: 'var(--red)',
              textAlign: 'center',
              padding: '4px 0',
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={!canSubmit}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 12,
            border: 'none',
            background: canSubmit
              ? 'linear-gradient(135deg, var(--purple), var(--blue))'
              : 'var(--border)',
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            marginTop: 4,
          }}
        >
          {submitting ? 'Входим…' : isLocked ? `Подождите ${remainingSec}с` : 'Войти'}
        </button>

        {webauthnAvailable && (
          <button
            type="button"
            onClick={tryWebAuthn}
            disabled={submitting}
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--card)',
              color: 'var(--text)',
              fontSize: 15,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: submitting ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              marginTop: 4,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <IconFingerprint size={18} /> Войти по биометрии
          </button>
        )}

        {cfEnabled && (
          <Link
            to="/register"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '10px',
              borderRadius: 12,
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 14,
              textDecoration: 'none',
              border: '1px dashed var(--border)',
              marginTop: 8,
            }}
          >
            <IconUserPlus size={16} />
            Зарегистрироваться
          </Link>
        )}
      </form>
    </div>
  );
}
