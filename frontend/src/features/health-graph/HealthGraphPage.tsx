import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  IconHeartbeat,
  IconStethoscope,
  IconPill,
  IconCalendar,
  IconAlertTriangle,
  IconArrowLeft,
  IconX,
} from '@tabler/icons-react';
import { useNavigate } from 'react-router';
import { api } from '@/shared/api/client';
import { EP } from '@/shared/api/endpoints';
import { qk } from '@/shared/api/keys';
import { Spinner, Button } from '@/shared/ui';
import { haptic } from '@/shared/lib/haptic';
import { CytoscapeCanvas } from './CytoscapeCanvas';
import { buildGraphElements, type PatientContext } from './graph-elements';

/**
 * Карта здоровья — граф связей всех сущностей пациента.
 * Порт из vanilla `frontend/js/pages/health-graph.js`.
 */

const TYPE_CONFIG: Record<
  string,
  { bg: string; Icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; label: string }
> = {
  diagnosis: { bg: '#AF52DE', Icon: IconHeartbeat, label: 'Диагнозы' },
  specialist: { bg: '#007AFF', Icon: IconStethoscope, label: 'Врачи' },
  medication: { bg: '#34C759', Icon: IconPill, label: 'Препараты' },
  visit: { bg: '#FF9500', Icon: IconCalendar, label: 'Приёмы' },
  error: { bg: '#FF3B30', Icon: IconAlertTriangle, label: 'Проблемы' },
};

export function HealthGraphPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: qk.patientContext,
    queryFn: () => api.get<PatientContext>(EP.patientContext),
  });

  const [activeTypes, setActiveTypes] = useState<Set<string>>(
    new Set(Object.keys(TYPE_CONFIG))
  );
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);

  const elements = useMemo(() => (data ? buildGraphElements(data) : []), [data]);

  const toggleType = (type: string) => {
    haptic('light');
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        if (next.size <= 1) return prev; // не даём скрыть всё
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  return (
    <div style={{ padding: 16 }}>
      <Button
        variant="secondary"
        size="sm"
        icon={<IconArrowLeft size={14} />}
        onClick={() => {
          haptic('light');
          navigate('/more');
        }}
        style={{ marginBottom: 12 }}
      >
        Назад
      </Button>

      {/* Filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        {Object.entries(TYPE_CONFIG).map(([type, c]) => {
          const active = activeTypes.has(type);
          const IconComp = c.Icon;
          return (
            <button
              key={type}
              type="button"
              onClick={() => toggleType(type)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 20,
                border: 'none',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                background: active ? c.bg : 'var(--bg)',
                color: active ? '#fff' : 'var(--text-secondary)',
                opacity: active ? 1 : 0.6,
                transition: 'all 0.2s',
                fontFamily: 'inherit',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <IconComp size={13} />
              {c.label}
            </button>
          );
        })}
      </div>

      {/* Graph container */}
      <div
        style={{
          width: '100%',
          height: 'calc(100vh - 260px)',
          minHeight: 400,
          borderRadius: 'var(--radius)',
          background: 'var(--card)',
          boxShadow: 'var(--shadow)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {isLoading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Spinner size={28} />
          </div>
        )}
        {data && <CytoscapeCanvas elements={elements} activeTypes={activeTypes} onSelectNode={setSelected} />}
      </div>

      {/* Detail panel */}
      {selected && (
        <div
          style={{
            position: 'fixed',
            bottom: 'var(--tab-height)',
            left: 0,
            right: 0,
            background: 'var(--card)',
            borderTop: '1px solid var(--border)',
            padding: '16px 20px',
            zIndex: 50,
            boxShadow: '0 -4px 16px rgba(0,0,0,0.1)',
            borderRadius: '16px 16px 0 0',
            maxHeight: '40vh',
            overflowY: 'auto',
          }}
        >
          <button
            type="button"
            onClick={() => setSelected(null)}
            style={{
              position: 'absolute',
              top: 12,
              right: 16,
              border: 'none',
              background: 'none',
              fontSize: 20,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <IconX size={20} />
          </button>
          <NodeDetail data={selected} />
        </div>
      )}
    </div>
  );
}

function NodeDetail({ data }: { data: Record<string, unknown> }) {
  const type = data['type'] as string;
  const fullLabel = data['fullLabel'] as string;
  const cfg = TYPE_CONFIG[type];
  return (
    <>
      <div
        style={{
          fontSize: 11,
          color: cfg?.bg ?? '#999',
          fontWeight: 600,
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        {cfg?.label ?? type}
      </div>
      <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4, paddingRight: 32 }}>
        {fullLabel}
      </div>
      {type === 'specialist' && data['clinic'] != null && typeof data['clinic'] === 'string' && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{data['clinic']}</div>
      )}
      {type === 'error' && data['description'] != null && typeof data['description'] === 'string' && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
          {data['description']}
        </div>
      )}
    </>
  );
}
