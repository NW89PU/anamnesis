import { useState } from 'react';
import { IconX, IconUser } from '@tabler/icons-react';
import { api } from '@/shared/api/client';
import { EP } from '@/shared/api/endpoints';
import { ApiError } from '@/shared/api/errors';
import { haptic } from '@/shared/lib/haptic';
import { useAuth, type AuthPatient } from '@/shared/auth/useAuth';

interface Props {
  onClose: () => void;
  onCreated: (patient: AuthPatient) => void | Promise<void>;
}

/**
 * Модалка добавления нового пациента (v4.1).
 *
 * Поля: full_name (обязательно), пол, дата рождения, степень родства
 * (free text). После создания → onCreated(patient) → обычно
 * setActivePatient + переход на /dashboard.
 *
 * relationship — свободный текст с placeholder примеров. Используется
 * AI-координатором для family-history и cohabitation-контекста.
 */
export function AddPatientModal({ onClose, onCreated }: Props) {
  const { reloadPatients } = useAuth();
  const [fullName, setFullName] = useState('');
  const [gender, setGender] = useState<'' | 'M' | 'F'>('');
  const [dob, setDob] = useState('');
  const [relationship, setRelationship] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (fullName.trim().length < 2) {
      setError('Введите ФИО (минимум 2 символа)');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await api.post<AuthPatient & { id: number }>(EP.patient, {
        full_name: fullName.trim(),
        gender: gender || null,
        date_of_birth: dob || null,
        relationship: relationship.trim() || null,
      });
      await reloadPatients();
      haptic('success');
      await onCreated(created);
    } catch (err) {
      haptic('error');
      setError(err instanceof ApiError ? err.message : 'Не удалось создать пациента');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, zIndex: 1000, animation: 'fadeIn 150ms',
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        style={{
          background: 'var(--bg)', borderRadius: 20, padding: 24,
          width: '100%', maxWidth: 420, boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
            Новый пациент
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-secondary)', padding: 4,
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <IconX size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={labelStyle}>ФИО *</label>
            <div style={{ position: 'relative' }}>
              <IconUser size={16} style={iconStyle} />
              <input
                type="text"
                autoFocus
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); setError(null); }}
                placeholder="Иванова Мария Петровна"
                style={inputStyle}
              />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Пол</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['M', 'F', ''] as const).map((g) => (
                <button
                  key={g || 'none'}
                  type="button"
                  onClick={() => setGender(g)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: 12,
                    border: `1px solid ${gender === g ? 'var(--purple)' : 'var(--border)'}`,
                    background: gender === g ? 'rgba(121,28,231,0.08)' : 'var(--card)',
                    color: gender === g ? 'var(--purple)' : 'var(--text)',
                    fontSize: 14, fontFamily: 'inherit', cursor: 'pointer',
                    WebkitTapHighlightColor: 'transparent',
                  }}
                >
                  {g === 'M' ? 'Муж.' : g === 'F' ? 'Жен.' : 'Не указан'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Дата рождения</label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              style={inputStyleNoIcon}
            />
          </div>

          <div>
            <label style={labelStyle}>Степень родства</label>
            <input
              type="text"
              value={relationship}
              onChange={(e) => setRelationship(e.target.value)}
              placeholder="я / сын / жена / мать / друг"
              style={inputStyleNoIcon}
            />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4, paddingLeft: 4 }}>
              AI использует эту инфу для контекста семейной истории и совместного проживания
            </div>
          </div>

          {error && (
            <div style={{ fontSize: 13, color: 'var(--red)', textAlign: 'center', padding: '4px 0' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || fullName.trim().length < 2}
            style={{
              width: '100%', padding: '14px 16px', borderRadius: 12, border: 'none',
              background: submitting || fullName.trim().length < 2
                ? 'var(--border)'
                : 'linear-gradient(135deg, var(--purple), var(--blue))',
              color: '#fff', fontSize: 16, fontWeight: 600,
              cursor: submitting || fullName.trim().length < 2 ? 'not-allowed' : 'pointer',
              marginTop: 8, fontFamily: 'inherit',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {submitting ? 'Сохраняем…' : 'Добавить пациента'}
          </button>
        </div>
      </form>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600,
  color: 'var(--text-secondary)', marginBottom: 6, paddingLeft: 4,
  textTransform: 'uppercase', letterSpacing: 0.5,
};
const iconStyle: React.CSSProperties = {
  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
  color: 'var(--text-secondary)',
};
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '12px 12px 12px 36px', borderRadius: 12,
  border: '1px solid var(--border)', background: 'var(--card)',
  fontSize: 15, color: 'var(--text)', outline: 'none', boxSizing: 'border-box',
  fontFamily: 'inherit',
};
const inputStyleNoIcon: React.CSSProperties = {
  ...inputStyle, padding: '12px',
};
