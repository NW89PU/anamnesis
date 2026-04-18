import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconChevronDown, IconCheck } from '@tabler/icons-react';
import { qk } from '@/shared/api/keys';
import { api } from '@/shared/api/client';
import { EP } from '@/shared/api/endpoints';
import { usePatientId, changePatient } from '@/shared/auth/usePatientId';
import { haptic } from '@/shared/lib/haptic';
import type { Patient } from '@/shared/types';

/**
 * Patient switcher — фиолетовая плашка с инициалами и ИМЕНЕМ.
 *
 * Имя берётся как второе слово из full_name, потому что в семье обычно
 * общая фамилия, и различать надо по имени ("Ivanov Ivan" → "Ivan").
 *
 * Клик → dropdown со всеми пациентами.
 *
 * Реактивность:
 * - `usePatientId()` — подписан на in-memory store, ре-рендерится при смене
 * - `changePatient(id)` — обновляет localStorage + уведомляет всех подписчиков
 * - `queryClient.clear()` — чистит кэш React Query, данные перезагружаются
 */
export function PatientSwitcher() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const currentId = usePatientId();

  const { data: patients = [] } = useQuery({
    queryKey: qk.patientList,
    queryFn: () => api.get<Patient[]>(EP.patientList),
    retry: false,
  });

  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    // Задержка чтобы не закрыться сразу от того же клика, который открыл
    const timer = setTimeout(() => document.addEventListener('click', onClick), 10);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', onClick);
    };
  }, [open]);

  if (patients.length === 0) return null;

  const current = patients.find((p) => p.id === currentId) ?? patients[0];
  if (!current) return null;

  const handleSelect = (id: number) => {
    haptic('light');
    setOpen(false);
    if (id === currentId) return;
    changePatient(id);
    // Чистим в-памяти + persist-кэш React Query. Без удаления persist
    // старые данные могут re-гидрироваться при следующем mount.
    qc.clear();
    try {
      localStorage.removeItem('anamnesis-query-cache-v1');
    } catch {
      // ignore
    }
    // Принудительно ведём пользователя на dashboard — это гарантирует
    // полный unmount/remount всех Page компонентов с новым patient_id.
    // Без navigate: useQuery с persist-cache мог показать данные
    // предыдущего пациента до первого refetch.
    navigate('/dashboard', { replace: true });
  };

  const showChevron = patients.length > 1;

  return (
    <div ref={dropdownRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          haptic('light');
          if (showChevron) setOpen(!open);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 12px',
          borderRadius: 12,
          background: 'var(--purple)',
          border: 'none',
          cursor: showChevron ? 'pointer' : 'default',
          fontFamily: 'inherit',
          WebkitTapHighlightColor: 'transparent',
          boxShadow: '0 2px 8px rgba(175, 82, 222, 0.3)',
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            color: '#fff',
          }}
        >
          {getInitials(current.full_name)}
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: '#fff',
            maxWidth: 120,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {getDisplayName(current.full_name)}
        </span>
        {showChevron && (
          <IconChevronDown
            size={14}
            style={{
              color: 'rgba(255, 255, 255, 0.7)',
              transition: 'transform 0.15s ease',
              transform: open ? 'rotate(180deg)' : 'none',
            }}
          />
        )}
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 220,
            background: 'var(--card)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.2)',
            overflow: 'hidden',
            zIndex: 10001,
          }}
        >
          {patients.map((p) => {
            const active = p.id === currentId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p.id)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  border: 'none',
                  background: active ? 'rgba(175, 82, 222, 0.08)' : 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: active ? 'var(--purple)' : 'var(--bg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 12,
                    fontWeight: 700,
                    color: active ? '#fff' : 'var(--text-secondary)',
                    flexShrink: 0,
                  }}
                >
                  {getInitials(p.full_name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: active ? 600 : 400,
                      color: 'var(--text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {getDisplayName(p.full_name)}
                  </div>
                  {p.date_of_birth && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      {new Date(p.date_of_birth).toLocaleDateString('ru-RU')}
                    </div>
                  )}
                </div>
                {active && <IconCheck size={14} color="var(--purple)" style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Инициалы — первые 2 заглавных буквы из слов. */
export function getInitials(fullName: string | null): string {
  if (!fullName) return '?';
  return fullName
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Отображаемое имя: второе слово из full_name (имя без фамилии).
 * "Ivanov Ivan" → "Ivan". Если только одно слово — возвращаем его.
 */
export function getDisplayName(fullName: string | null): string {
  if (!fullName) return 'Пациент';
  const parts = fullName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return parts[1]!;
  return parts[0] ?? 'Пациент';
}
