import { useState } from 'react';
import { useNavigate } from 'react-router';
import { IconPlus, IconLogout } from '@tabler/icons-react';
import { useAuth, usePatients } from './useAuth';
import { AddPatientModal } from '@/features/patients/AddPatientModal';
import { haptic } from '@/shared/lib/haptic';

/**
 * Экран выбора пациента (v4.1).
 *
 * Показывается когда юзер authenticated но active patient не выбран
 * (status='no-patients' или 'needs-patient'). Круги с инициалами + цвет,
 * клик → setActivePatient → AppShell.
 *
 * Если patients.length === 0 → центральная кнопка «Добавить первого
 * пациента». Иначе grid + последний круг с «+» для добавления нового.
 */

const COLORS = [
  'linear-gradient(135deg, #791CE7, #007AFF)',
  'linear-gradient(135deg, #FF9500, #FF3B30)',
  'linear-gradient(135deg, #34C759, #007AFF)',
  'linear-gradient(135deg, #AF52DE, #FF2D55)',
  'linear-gradient(135deg, #5AC8FA, #007AFF)',
  'linear-gradient(135deg, #FFCC00, #FF9500)',
];

function initials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  const a = parts[0] ?? '?';
  const b = parts[1] ?? '';
  if (b) return (a.charAt(0) + b.charAt(0)).toUpperCase();
  return a.slice(0, 2).toUpperCase();
}

function age(dob: string | null): string | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) years--;
  if (years < 1) {
    const months = Math.max(0, (now.getFullYear() - birth.getFullYear()) * 12 + m);
    return `${months} мес`;
  }
  return `${years} ${years === 1 ? 'год' : years < 5 ? 'года' : 'лет'}`;
}

export function PatientPickerScreen() {
  const navigate = useNavigate();
  const patients = usePatients();
  const { setActivePatient, logout, user } = useAuth();
  const [showAdd, setShowAdd] = useState(false);

  const handleSelect = async (id: number) => {
    haptic('light');
    await setActivePatient(id);
    navigate('/dashboard', { replace: true });
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg)',
        display: 'flex',
        flexDirection: 'column',
        padding: '40px 20px 20px',
      }}
    >
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <img
          src="/icons/icon.svg"
          alt="Anamnesis"
          style={{
            width: 64,
            height: 64,
            marginBottom: 16,
            filter: 'drop-shadow(0 8px 24px rgba(121,28,231,0.3))',
          }}
        />
        <h1 style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', margin: 0, marginBottom: 6 }}>
          {patients.length === 0 ? 'Добро пожаловать' : 'Кто сегодня?'}
        </h1>
        <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
          {patients.length === 0
            ? 'Добавьте первого пациента, чтобы начать'
            : 'Выберите пациента или добавьте нового'}
        </div>
      </div>

      {patients.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <button
            type="button"
            onClick={() => { haptic('light'); setShowAdd(true); }}
            style={{
              width: 120, height: 120, borderRadius: 60,
              background: 'linear-gradient(135deg, var(--purple), var(--blue))',
              color: '#fff', border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(121,28,231,0.4)',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <IconPlus size={48} />
          </button>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Добавить пациента</div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
            gap: 16,
            maxWidth: 600,
            margin: '0 auto',
            width: '100%',
          }}
        >
          {patients.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              onClick={() => void handleSelect(p.id)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontFamily: 'inherit', padding: '8px 4px',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div
                style={{
                  width: 88, height: 88, borderRadius: 44,
                  background: COLORS[idx % COLORS.length],
                  color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 28, fontWeight: 700,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
              >
                {initials(p.full_name)}
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', textAlign: 'center' }}>
                {p.full_name}
              </div>
              {p.relationship && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.relationship}</div>
              )}
              {age(p.date_of_birth) && (
                <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{age(p.date_of_birth)}</div>
              )}
            </button>
          ))}

          {/* Add-button круг */}
          <button
            type="button"
            onClick={() => { haptic('light'); setShowAdd(true); }}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', padding: '8px 4px',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div
              style={{
                width: 88, height: 88, borderRadius: 44,
                background: 'var(--card)',
                border: '2px dashed var(--border)',
                color: 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <IconPlus size={36} />
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', textAlign: 'center' }}>
              Добавить
            </div>
          </button>
        </div>
      )}

      {/* Footer: текущий юзер + logout */}
      <div style={{ marginTop: 'auto', padding: '24px 0 0', textAlign: 'center' }}>
        {user?.email && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
            Вошли как <b>{user.email}</b>
          </div>
        )}
        <button
          type="button"
          onClick={() => void logout()}
          style={{
            padding: '8px 16px', borderRadius: 12,
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-secondary)', fontSize: 13, fontFamily: 'inherit',
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <IconLogout size={14} /> Выйти
        </button>
      </div>

      {showAdd && (
        <AddPatientModal
          onClose={() => setShowAdd(false)}
          onCreated={async (created) => {
            setShowAdd(false);
            await setActivePatient(created.id);
            navigate('/dashboard', { replace: true });
          }}
        />
      )}
    </div>
  );
}
