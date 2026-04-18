import { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconFingerprint, IconTrash, IconPlus } from '@tabler/icons-react';
import { startRegistration, browserSupportsWebAuthn, platformAuthenticatorIsAvailable } from '@simplewebauthn/browser';
import { api } from '@/shared/api/client';
import { EP } from '@/shared/api/endpoints';
import { Button } from '@/shared/ui/Button';
import { haptic } from '@/shared/lib/haptic';
import { ApiError } from '@/shared/api/errors';

/**
 * Секция биометрии в SecurityModal.
 *
 * Поток регистрации:
 * 1. Кнопка "Включить Face ID / Touch ID"
 * 2. GET /api/webauthn/register/options → challenge + rp info
 * 3. startRegistration() из @simplewebauthn/browser — показывает системный диалог
 * 4. POST /api/webauthn/register/verify с attestation
 * 5. Успех → Telegram уведомление + credential в списке
 *
 * Поток входа (реализован в PinScreen.tsx, не здесь):
 * 1. PinScreen видит что для device_id есть credentials
 * 2. Показывает кнопку "Войти через Face ID" поверх PIN клавиатуры
 * 3. navigator.credentials.get() → assertion
 * 4. POST /api/webauthn/login/verify → session token
 */

interface Credential {
  id: number;
  device_id: string;
  nickname: string | null;
  device_type: string | null;
  backed_up: number;
  created_at: string;
  last_used_at: string | null;
  credential_short: string;
}

interface CredentialsResponse {
  credentials: Credential[];
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso.replace(' ', 'T') + (iso.includes('T') ? '' : 'Z'));
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface Props {
  onFeedback: (type: 'ok' | 'error', text: string) => void;
}

export default function SecurityWebAuthnSection({ onFeedback }: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [supportChecked, setSupportChecked] = useState(false);
  const [supported, setSupported] = useState(false);

  // Проверка поддержки WebAuthn в браузере
  const checkSupport = useCallback(async () => {
    if (supportChecked) return supported;
    const browserOk = browserSupportsWebAuthn();
    if (!browserOk) {
      setSupported(false);
      setSupportChecked(true);
      return false;
    }
    // Есть ли platform authenticator (Face ID/Touch ID/Windows Hello)?
    const platformOk = await platformAuthenticatorIsAvailable();
    setSupported(platformOk);
    setSupportChecked(true);
    return platformOk;
  }, [supportChecked, supported]);

  // Список зарегистрированных credentials
  const { data, isLoading } = useQuery({
    queryKey: ['webauthn-credentials'],
    queryFn: () => api.get<CredentialsResponse>(EP.webauthnCredentials),
    retry: false,
  });

  const credentials = data?.credentials ?? [];

  const registerNew = useCallback(async () => {
    setBusy(true);
    try {
      const ok = await checkSupport();
      if (!ok) {
        onFeedback('error', 'Биометрия недоступна на этом устройстве');
        return;
      }

      haptic('light');
      // Запрос предлагаемого имени
      const defaultName =
        /iphone/i.test(navigator.userAgent) ? 'Face ID / Touch ID iPhone' :
        /ipad/i.test(navigator.userAgent) ? 'Face ID / Touch ID iPad' :
        /android/i.test(navigator.userAgent) ? 'Биометрия Android' :
        /mac/i.test(navigator.userAgent) ? 'Touch ID Mac' :
        /windows/i.test(navigator.userAgent) ? 'Windows Hello' :
        'Биометрия';

      const nickname = window.prompt('Название устройства для списка (можно пропустить):', defaultName) || defaultName;

      // 1. Получить options с challenge
      const options = await api.get(EP.webauthnRegisterOptions);
      // 2. Показать системный диалог биометрии
      const attResp = await startRegistration({ optionsJSON: options as Parameters<typeof startRegistration>[0]['optionsJSON'] });
      // 3. Отправить attestation на сервер
      await api.post(EP.webauthnRegisterVerify, {
        response: attResp,
        nickname,
      });
      haptic('success');
      onFeedback('ok', 'Биометрия настроена! При следующем входе будет быстрее.');
      await qc.invalidateQueries({ queryKey: ['webauthn-credentials'] });
    } catch (err) {
      haptic('error');
      if (err instanceof ApiError) {
        onFeedback('error', err.message || 'Ошибка регистрации');
      } else if (err instanceof Error && err.name === 'NotAllowedError') {
        onFeedback('error', 'Отменено пользователем');
      } else {
        onFeedback('error', err instanceof Error ? err.message : 'Ошибка');
      }
    } finally {
      setBusy(false);
    }
  }, [checkSupport, onFeedback, qc]);

  const revokeCredential = useCallback(async (id: number) => {
    if (!window.confirm('Удалить этот passkey? Вход через биометрию перестанет работать.')) return;
    setBusy(true);
    try {
      await api.del(EP.webauthnCredentialItem(id));
      haptic('success');
      onFeedback('ok', 'Passkey удалён');
      await qc.invalidateQueries({ queryKey: ['webauthn-credentials'] });
    } catch (err) {
      haptic('error');
      onFeedback('error', err instanceof ApiError ? err.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  }, [onFeedback, qc]);

  return (
    <div style={{ marginBottom: 20 }}>
      <div className="section-subtitle">
        <IconFingerprint size={14} style={{ marginRight: 4 }} /> Биометрия (Face ID / Touch ID)
      </div>

      {credentials.length === 0 ? (
        <div
          style={{
            background: 'var(--card)',
            borderRadius: 12,
            padding: 16,
            marginBottom: 8,
          }}
        >
          <div style={{ fontSize: 14, color: 'var(--text)', marginBottom: 8, lineHeight: 1.4 }}>
            Войди быстрее через Face ID, Touch ID или Windows Hello. При неудаче всегда остаётся fallback на PIN.
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.4 }}>
            Biometric ключ создаётся и хранится в Secure Enclave твоего устройства. Сервер
            хранит только публичный ключ — подделать подпись можно только имея физический
            доступ к твоему разблокированному устройству.
          </div>
          <Button
            block
            icon={<IconPlus size={16} />}
            onClick={registerNew}
            disabled={busy || isLoading}
          >
            {busy ? 'Настраиваю…' : 'Включить биометрию'}
          </Button>
        </div>
      ) : (
        <div className="list-group">
          {credentials.map((cred, idx) => (
            <div
              key={cred.id}
              style={{
                background: 'var(--card)',
                padding: '14px 16px',
                borderTop: idx === 0 ? 'none' : '1px solid var(--border)',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <IconFingerprint size={24} color="var(--green)" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>
                  {cred.nickname || 'Без названия'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Добавлен: {formatDate(cred.created_at)}
                  {cred.backed_up ? ' · синхронизируется' : ''}
                  {cred.last_used_at ? ` · использован ${formatDate(cred.last_used_at)}` : ''}
                </div>
              </div>
              <button
                type="button"
                onClick={() => revokeCredential(cred.id)}
                disabled={busy}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--red)',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  padding: 8,
                }}
                aria-label="Удалить passkey"
              >
                <IconTrash size={18} />
              </button>
            </div>
          ))}
          <div style={{ padding: '8px 16px', background: 'var(--card)', borderTop: '1px solid var(--border)' }}>
            <Button variant="secondary" block icon={<IconPlus size={14} />} onClick={registerNew} disabled={busy}>
              Добавить ещё
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
