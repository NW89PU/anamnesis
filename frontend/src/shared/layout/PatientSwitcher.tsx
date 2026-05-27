import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { IconChevronDown, IconCheck, IconPlus } from '@tabler/icons-react';
import { useAuth, useActivePatient, usePatients } from '@/shared/auth/useAuth';
import { AddPatientModal } from '@/features/patients/AddPatientModal';
import { haptic } from '@/shared/lib/haptic';

/**
 * Patient switcher (v4.1) — фиолетовая плашка с инициалами и именем активного.
 *
 * Источник данных — AuthContext (не отдельный API-запрос). Список patients
 * приходит из /api/me при bootstrap и обновляется через reloadPatients
 * после add/delete.
 *
 * Клик → dropdown со всеми пациентами + кнопка «Добавить». Выбор патиента
 * → setActivePatient (обновляет session на бэке + localStorage + invalidate
 * React Query).
 */
export function PatientSwitcher() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const patients = usePatients();
  const active = useActivePatient();
  const { setActivePatient } = useAuth();

  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const timer = setTimeout(() => document.addEventListener('click', onClick), 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', onClick);
    };
  }, [open]);

  if (!active && patients.length === 0) return null;
  const current = active ?? patients[0];

  const handleSelect = async (id: number) => {
    haptic('light');
    setOpen(false);
    if (id === current?.id) return;
    await setActivePatient(id);
    qc.clear();
    try { localStorage.removeItem('anamnesis-query-cache-v1'); } catch { /* */ }
    navigate('/dashboard', { replace: true });
  };

  const firstName = (full: string) => {
    const parts = full.trim().split(/\s+/).filter(Boolean);
    return parts[1] ?? parts[0] ?? '';
  };
  const initials = (full: string) => {
    const parts = full.trim().split(/\s+/).filter(Boolean);
    const a = parts[0] ?? '?';
    const b = parts[1] ?? '';
    if (b) return (a.charAt(0) + b.charAt(0)).toUpperCase();
    return a.slice(0, 2).toUpperCase();
  };

  return (
    <>
      <div ref={dropdownRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => { haptic('light'); setOpen((o) => !o); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '8px 12px', borderRadius: 12,
            background: 'linear-gradient(135deg, var(--purple), var(--blue))',
            color: '#fff', border: 'none', cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 14, fontWeight: 600,
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          <span
            style={{
              width: 28, height: 28, borderRadius: 14,
              background: 'rgba(255,255,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
            }}
          >
            {current ? initials(current.full_name) : '?'}
          </span>
          <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {current ? firstName(current.full_name) : 'Выбрать'}
          </span>
          {(patients.length > 1 || patients.length === 0) && <IconChevronDown size={14} />}
        </button>

        {open && (
          <div
            style={{
              position: 'absolute', top: 'calc(100% + 4px)', right: 0,
              minWidth: 240, maxWidth: 320,
              background: 'var(--card)', borderRadius: 12,
              boxShadow: '0 12px 32px rgba(0,0,0,0.2)',
              border: '1px solid var(--border)',
              padding: 4, zIndex: 100,
            }}
          >
            {patients.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => void handleSelect(p.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 12px', borderRadius: 8,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--text)', fontSize: 14, textAlign: 'left',
                  fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{p.full_name}</div>
                  {p.relationship && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{p.relationship}</div>
                  )}
                </span>
                {p.id === current?.id && <IconCheck size={16} color="var(--purple)" />}
              </button>
            ))}
            <button
              type="button"
              onClick={() => { setOpen(false); setShowAdd(true); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '10px 12px', borderRadius: 8,
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--purple)', fontSize: 13, textAlign: 'left',
                fontFamily: 'inherit', borderTop: '1px solid var(--border)',
                marginTop: 4, paddingTop: 12,
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <IconPlus size={14} /> Добавить пациента
            </button>
          </div>
        )}
      </div>

      {showAdd && (
        <AddPatientModal
          onClose={() => setShowAdd(false)}
          onCreated={async (p) => {
            setShowAdd(false);
            await setActivePatient(p.id);
            qc.clear();
            try { localStorage.removeItem('anamnesis-query-cache-v1'); } catch { /* */ }
            navigate('/dashboard', { replace: true });
          }}
        />
      )}
    </>
  );
}
