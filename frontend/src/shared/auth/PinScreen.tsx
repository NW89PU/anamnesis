import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { IconBackspace, IconShield, IconFingerprint } from '@tabler/icons-react';
import { startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { api } from '@/shared/api/client';
import { EP } from '@/shared/api/endpoints';
import { useAuth } from './useAuth';
import { recordFailure, recordSuccess, getLockoutStatus } from './rate-limit';
import { haptic } from '@/shared/lib/haptic';
import { ApiError } from '@/shared/api/errors';

/**
 * Двухфазный login:
 *
 * Фаза 1: ввод PIN-кода (6 цифр)
 *   → POST /api/auth/login {pin, device_id в header}
 *   → либо {token} — обычный успех, либо
 *     {requires_answer: true, question, challenge_token} — переход к фазе 2
 *
 * Фаза 2: секретный вопрос (только для НОВЫХ устройств)
 *   → POST /api/auth/verify-device {challenge_token, answer}
 *   → {token} — успех, устройство становится trusted
 *
 * Rate limit:
 * - 5 попыток PIN → экспоненциальный локаут (клиент-сайд)
 * - 3 попытки ответа в challenge (сервер-сайд, через auth rate limit)
 */

const PIN_LENGTH = 6;

interface LoginResponse {
  token?: string;
  expires_days?: number;
  requires_answer?: boolean;
  question?: string;
  challenge_token?: string;
  device_trusted?: boolean;
  needs_security_setup?: boolean;
}

interface VerifyDeviceResponse {
  token: string;
  device_trusted: boolean;
}

type Phase = 'pin' | 'challenge';

export function PinScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  // Phase state
  const [phase, setPhase] = useState<Phase>('pin');

  // PIN phase
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [lockout, setLockout] = useState(getLockoutStatus());
  const [submitting, setSubmitting] = useState(false);

  // Challenge phase
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const [answer, setAnswer] = useState('');
  const [deviceLabel, setDeviceLabel] = useState('');
  const [challengeError, setChallengeError] = useState<string | null>(null);

  // WebAuthn fast-path
  const [webauthnAvailable, setWebauthnAvailable] = useState(false);

  // Обновление таймера локаута каждую секунду
  useEffect(() => {
    if (!lockout.locked) return;
    const t = setInterval(() => setLockout(getLockoutStatus()), 1000);
    return () => clearInterval(t);
  }, [lockout.locked]);

  // Проверка доступна ли биометрия на этом устройстве
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!browserSupportsWebAuthn()) return;
      try {
        const resp = await api.get<{ available: boolean }>(EP.webauthnAvailable);
        if (!cancelled) setWebauthnAvailable(resp.available === true);
      } catch {
        // fail silently — PIN всегда работает как fallback
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const tryWebAuthn = useCallback(async () => {
    if (!webauthnAvailable || submitting) return;
    setSubmitting(true);
    setPinError(null);
    try {
      const options = await api.get(EP.webauthnLoginOptions);
      haptic('light');
      const assertion = await startAuthentication({ optionsJSON: options as Parameters<typeof startAuthentication>[0]['optionsJSON'] });
      const data = await api.post<{ token: string }>(EP.webauthnLoginVerify, { response: assertion });
      if (!data.token) throw new ApiError('Нет токена', 500);
      recordSuccess();
      await login(data.token);
      haptic('success');
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        // Пользователь отменил — молча, без ошибки
        setPinError(null);
      } else {
        haptic('error');
        setPinError(err instanceof ApiError ? err.message : 'Ошибка биометрии, введи PIN');
      }
    } finally {
      setSubmitting(false);
    }
  }, [webauthnAvailable, submitting, login, navigate, from]);

  const tryLogin = useCallback(
    async (pinValue: string) => {
      setSubmitting(true);
      setPinError(null);
      try {
        const data = await api.post<LoginResponse>(EP.authLogin, { pin: pinValue });

        if (data.requires_answer && data.challenge_token && data.question) {
          // Фаза 2 — секретный вопрос
          recordSuccess(); // PIN был правильный
          setChallengeToken(data.challenge_token);
          setQuestion(data.question);
          setPhase('challenge');
          haptic('light');
          return;
        }

        if (!data.token) {
          throw new ApiError('Нет токена в ответе', 500);
        }
        recordSuccess();
        await login(data.token);
        haptic('success');
        navigate(from, { replace: true });
      } catch (err) {
        recordFailure();
        setLockout(getLockoutStatus());
        setPin('');
        setShake(true);
        setTimeout(() => setShake(false), 500);
        haptic('error');
        if (err instanceof ApiError && err.status === 0) {
          setPinError('Нет соединения с сервером');
        } else {
          setPinError('Неверный PIN-код');
        }
      } finally {
        setSubmitting(false);
      }
    },
    [login, navigate, from]
  );

  const press = useCallback(
    (key: string) => {
      if (lockout.locked || submitting) return;
      haptic('light');
      setPinError(null);
      if (key === 'del') {
        setPin((prev) => prev.slice(0, -1));
      } else if (pin.length < PIN_LENGTH) {
        const next = pin + key;
        setPin(next);
        if (next.length === PIN_LENGTH) {
          setTimeout(() => void tryLogin(next), 150);
        }
      }
    },
    [pin, lockout.locked, submitting, tryLogin]
  );

  // Hardware keyboard для PIN-фазы
  useEffect(() => {
    if (phase !== 'pin') return;
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press, phase]);

  // Автоматически триггерим WebAuthn при появлении экрана если доступен
  // (пользовательский жест гарантируется т.к. это reaction на открытие PIN screen —
  // браузер требует user gesture для WebAuthn, поэтому autorun только ПОСЛЕ tap на экран)
  // По best-practice: показываем кнопку, не auto-trigger — лучше UX

  const submitChallenge = useCallback(async () => {
    if (!challengeToken || !answer.trim()) return;
    setSubmitting(true);
    setChallengeError(null);
    try {
      const data = await api.post<VerifyDeviceResponse>(EP.authVerifyDevice, {
        challenge_token: challengeToken,
        answer: answer.trim(),
        device_label: deviceLabel.trim() || null,
      });
      if (!data.token) throw new ApiError('Нет токена', 500);
      await login(data.token);
      haptic('success');
      navigate(from, { replace: true });
    } catch (err) {
      haptic('error');
      if (err instanceof ApiError) {
        if (err.status === 401) {
          setChallengeError('Неверный ответ. Попробуйте ещё раз.');
        } else if (err.status === 0) {
          setChallengeError('Нет соединения с сервером');
        } else {
          setChallengeError('Ошибка проверки. Повторите вход заново.');
        }
      } else {
        setChallengeError('Ошибка проверки');
      }
      setAnswer('');
    } finally {
      setSubmitting(false);
    }
  }, [challengeToken, answer, deviceLabel, login, navigate, from]);

  const backToPin = useCallback(() => {
    setPhase('pin');
    setChallengeToken(null);
    setQuestion(null);
    setAnswer('');
    setDeviceLabel('');
    setChallengeError(null);
    setPin('');
  }, []);

  // ─── Render: Challenge phase ───────────────────────────
  if (phase === 'challenge') {
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
            width: 80,
            height: 80,
            borderRadius: 24,
            background: 'linear-gradient(135deg, var(--orange), var(--red))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 24,
            boxShadow: '0 8px 24px rgba(255,149,0,0.3)',
          }}
        >
          <IconShield size={36} color="#fff" />
        </div>

        <h2
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: 4,
            textAlign: 'center',
          }}
        >
          Новое устройство
        </h2>
        <p
          style={{
            fontSize: 14,
            color: 'var(--text-secondary)',
            marginBottom: 24,
            textAlign: 'center',
            maxWidth: 320,
            lineHeight: 1.4,
          }}
        >
          PIN принят, но мы видим это устройство впервые. Ответь на секретный вопрос, чтобы
          доверить ему доступ.
        </p>

        <form
          style={{ width: '100%', maxWidth: 360 }}
          onSubmit={(e) => {
            e.preventDefault();
            if (!submitting && answer.trim()) void submitChallenge();
          }}
        >
          {/* Лейбл поля = то что настроил юзер. Если это простое "Контрольное слово" —
              показываем как плейсхолдер в инпуте. Если длиннее — как label карточку.
              Это позволяет скрывать подсказку («ответ — имя сына»), показывая
              только нейтральный ярлык. */}
          {question && question.length > 20 ? (
            <div
              style={{
                background: 'var(--card)',
                borderRadius: 12,
                padding: 16,
                marginBottom: 12,
                border: '1px solid var(--border)',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  marginBottom: 4,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                }}
              >
                Подтверди
              </div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'var(--text)',
                  lineHeight: 1.4,
                }}
              >
                {question}
              </div>
            </div>
          ) : (
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
                marginBottom: 6,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                paddingLeft: 4,
              }}
            >
              {question || 'Контрольное слово'}
            </div>
          )}

          <input
            type="password"
            autoFocus
            autoComplete="off"
            spellCheck={false}
            value={answer}
            onChange={(e) => {
              setAnswer(e.target.value);
              setChallengeError(null);
            }}
            placeholder=""
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 12,
              border: `1px solid ${challengeError ? 'var(--red)' : 'var(--border)'}`,
              background: 'var(--card)',
              fontSize: 16,
              color: 'var(--text)',
              marginBottom: 12,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          <input
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={deviceLabel}
            onChange={(e) => setDeviceLabel(e.target.value)}
            placeholder="Название устройства (необязательно)"
            style={{
              width: '100%',
              padding: '12px 16px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: 'var(--card)',
              fontSize: 14,
              color: 'var(--text)',
              marginBottom: 16,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          {challengeError && (
            <div
              style={{
                fontSize: 13,
                color: 'var(--red)',
                marginBottom: 12,
                textAlign: 'center',
              }}
            >
              {challengeError}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !answer.trim()}
            style={{
              width: '100%',
              padding: '14px 16px',
              borderRadius: 12,
              border: 'none',
              background:
                submitting || !answer.trim()
                  ? 'var(--border)'
                  : 'linear-gradient(135deg, var(--purple), var(--blue))',
              color: '#fff',
              fontSize: 16,
              fontWeight: 600,
              cursor: submitting || !answer.trim() ? 'not-allowed' : 'pointer',
              marginBottom: 12,
            }}
          >
            {submitting ? 'Проверяю…' : 'Подтвердить'}
          </button>

          <button
            type="button"
            onClick={backToPin}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 12,
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            ← Ввести PIN заново
          </button>
        </form>
      </div>
    );
  }

  // ─── Render: PIN phase ───────────────────────────
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
      <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
        Anamnesis
      </h2>
      <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32 }}>
        {lockout.locked ? 'Слишком много попыток' : 'Введите PIN-код для входа'}
      </p>

      {/* Dots indicator — 6 точек для 6-значного PIN */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          marginBottom: 20,
          transform: shake ? 'translateX(0)' : undefined,
          animation: shake ? 'pin-shake 0.4s' : undefined,
        }}
      >
        {Array.from({ length: PIN_LENGTH }).map((_, i) => {
          const filled = i < pin.length;
          return (
            <div
              key={i}
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: filled ? 'var(--purple)' : 'transparent',
                border: `2px solid ${shake ? 'var(--red)' : filled ? 'var(--purple)' : 'var(--border)'}`,
                transition: 'all 0.15s',
              }}
            />
          );
        })}
      </div>

      <div
        style={{
          fontSize: 13,
          color: 'var(--red)',
          marginBottom: 16,
          minHeight: 20,
          textAlign: 'center',
        }}
      >
        {lockout.locked ? `Попробуйте через ${lockout.remainingSec} сек.` : pinError ?? ''}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 72px)', gap: 12 }}>
        {([1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, 'del'] as const).map((n, idx) => {
          if (n === '') return <div key={`empty-${idx}`} />;
          const key = String(n);
          return (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              disabled={lockout.locked || submitting}
              style={{
                width: 72,
                height: 56,
                border: 'none',
                borderRadius: 14,
                background: key === 'del' ? 'var(--bg)' : 'var(--card)',
                fontSize: 22,
                fontWeight: 600,
                cursor: lockout.locked ? 'not-allowed' : 'pointer',
                color: 'var(--text)',
                boxShadow: key === 'del' ? 'none' : 'var(--shadow)',
                opacity: lockout.locked ? 0.4 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {key === 'del' ? <IconBackspace size={22} /> : key}
            </button>
          );
        })}
      </div>

      {webauthnAvailable && !lockout.locked && (
        <button
          type="button"
          onClick={tryWebAuthn}
          disabled={submitting}
          style={{
            marginTop: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '12px 24px',
            borderRadius: 24,
            border: '1px solid var(--border)',
            background: 'var(--card)',
            color: 'var(--purple)',
            fontSize: 15,
            fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
            boxShadow: 'var(--shadow)',
          }}
        >
          <IconFingerprint size={22} />
          Войти через биометрию
        </button>
      )}

      <style>{`
        @keyframes pin-shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  );
}
