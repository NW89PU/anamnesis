import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router';
import { IconUserPlus, IconLock, IconUser, IconAlertCircle } from '@tabler/icons-react';
import { api } from '@/shared/api/client';
import { EP } from '@/shared/api/endpoints';
import { useAuth } from './useAuth';
import type { AuthUser } from './AuthContext';
import { ApiError } from '@/shared/api/errors';
import { haptic } from '@/shared/lib/haptic';

/**
 * v4.0 RegisterScreen.
 *
 * Доступен только когда фронт за Cloudflare Access. Email берётся из
 * CF Access JWT (доверенный источник identity) — юзер выбирает только
 * пароль и опционально вводит full_name / date_of_birth / gender для
 * создания своего patient-профиля.
 *
 * Если CF Access выключен или нет CF email — показываем "регистрация
 * недоступна" с инструкцией обратиться к админу.
 *
 * После успешной регистрации backend сразу выдаёт session token —
 * редиректим на /dashboard, юзер уже залогинен.
 */

interface RegisterResponse {
  token: string;
  expires_days: number;
  user: AuthUser;
}

export function RegisterScreen() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [cfEnabled, setCfEnabled] = useState<boolean | null>(null);
  const [cfEmail, setCfEmail] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);

  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await api.get<{ cf_enabled: boolean; cf_email: string | null }>(
          EP.authCfStatus
        );
        if (cancelled) return;
        setCfEnabled(status.cf_enabled);
        setCfEmail(status.cf_email);
      } catch {
        setCfEnabled(false);
      } finally {
        if (!cancelled) setStatusLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      if (password.length < 8) {
        setError('Пароль должен быть не короче 8 символов');
        return;
      }
      if (password !== password2) {
        setError('Пароли не совпадают');
        return;
      }
      setSubmitting(true);
      setError(null);
      try {
        const data = await api.post<RegisterResponse>(EP.authRegister, {
          password,
          full_name: fullName.trim() || undefined,
          date_of_birth: dob || undefined,
          gender: gender || undefined,
        });
        await login(data.token, data.user);
        haptic('success');
        navigate('/dashboard', { replace: true });
      } catch (err) {
        haptic('error');
        if (err instanceof ApiError) {
          if (err.status === 403) {
            setError('Регистрация доступна только через Cloudflare Access. ' +
                     'Обратитесь к администратору.');
          } else if (err.status === 409) {
            setError('Пользователь с этим email уже зарегистрирован. Войдите по паролю.');
          } else if (err.status === 400) {
            setError(err.message || 'Некорректные данные');
          } else {
            setError(err.message || 'Ошибка регистрации');
          }
        } else {
          setError('Ошибка регистрации');
        }
      } finally {
        setSubmitting(false);
      }
    },
    [password, password2, fullName, dob, gender, submitting, login, navigate]
  );

  // ─── Loading ─────────────────────────────────────
  if (statusLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      />
    );
  }

  // ─── CF Access выключен — регистрация запрещена ──
  if (!cfEnabled || !cfEmail) {
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
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: 'linear-gradient(135deg, var(--orange), var(--red))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
          }}
        >
          <IconAlertCircle size={32} color="#fff" />
        </div>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
          Регистрация недоступна
        </h2>
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-secondary)',
            textAlign: 'center',
            maxWidth: 320,
            lineHeight: 1.5,
            marginBottom: 24,
          }}
        >
          {cfEnabled
            ? 'Cloudflare Access не передал ваш email. Зайдите через настроенный домен.'
            : 'Регистрация открыта только через Cloudflare Access. Обратитесь к администратору для добавления вас в список.'}
        </p>
        <Link
          to="/login"
          style={{
            padding: '10px 20px',
            borderRadius: 12,
            background: 'var(--card)',
            color: 'var(--text)',
            fontSize: 14,
            textDecoration: 'none',
            border: '1px solid var(--border)',
          }}
        >
          ← К входу
        </Link>
      </div>
    );
  }

  // ─── Регистрация ─────────────────────────────────
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
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          background: 'linear-gradient(135deg, var(--purple), var(--blue))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
          boxShadow: '0 8px 24px rgba(121,28,231,0.3)',
        }}
      >
        <IconUserPlus size={32} color="#fff" />
      </div>

      <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', margin: 0, marginBottom: 6 }}>
        Регистрация
      </h1>
      <div
        style={{
          fontSize: 13,
          color: 'var(--text-secondary)',
          marginBottom: 4,
        }}
      >
        Email подтверждён через Cloudflare Access
      </div>
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: 24,
          fontFamily: 'monospace',
        }}
      >
        {cfEmail}
      </div>

      <form
        onSubmit={submit}
        style={{
          width: '100%',
          maxWidth: 360,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ position: 'relative' }}>
          <IconLock
            size={18}
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Пароль (минимум 8 символов)"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(null); }}
            style={{
              width: '100%',
              padding: '14px 16px 14px 42px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--card)',
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
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Повторите пароль"
            value={password2}
            onChange={(e) => { setPassword2(e.target.value); setError(null); }}
            style={{
              width: '100%',
              padding: '14px 16px 14px 42px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--card)',
              fontSize: 16,
              color: 'var(--text)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <details
          style={{
            background: 'var(--card)',
            borderRadius: 12,
            border: '1px solid var(--border)',
            padding: '8px 12px',
          }}
        >
          <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
            Профиль пациента (опционально)
          </summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
            <div style={{ position: 'relative' }}>
              <IconUser
                size={16}
                style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}
              />
              <input
                type="text"
                placeholder="ФИО"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg)',
                  fontSize: 14,
                  color: 'var(--text)',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <input
              type="date"
              placeholder="Дата рождения"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                fontSize: 14,
                color: 'var(--text)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg)',
                fontSize: 14,
                color: 'var(--text)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            >
              <option value="">Пол (не указан)</option>
              <option value="M">Мужской</option>
              <option value="F">Женский</option>
            </select>
          </div>
        </details>

        {error && (
          <div style={{ fontSize: 13, color: 'var(--red)', textAlign: 'center', padding: '4px 0' }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !password || !password2}
          style={{
            width: '100%',
            padding: '14px 16px',
            borderRadius: 12,
            border: 'none',
            background:
              submitting || !password || !password2
                ? 'var(--border)'
                : 'linear-gradient(135deg, var(--purple), var(--blue))',
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            cursor: submitting || !password || !password2 ? 'not-allowed' : 'pointer',
            marginTop: 4,
          }}
        >
          {submitting ? 'Регистрируем…' : 'Создать аккаунт'}
        </button>

        <Link
          to="/login"
          style={{
            display: 'block',
            textAlign: 'center',
            padding: '10px',
            borderRadius: 12,
            background: 'transparent',
            color: 'var(--text-secondary)',
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          ← Уже есть аккаунт? Войти
        </Link>
      </form>
    </div>
  );
}
