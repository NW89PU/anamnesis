import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { IconTestPipe, IconChevronRight, IconAlertTriangle, IconInfoCircle } from '@tabler/icons-react';
import clsx from 'clsx';
import { Modal, SkeletonList, EmptyState, Badge } from '@/shared/ui';
import type { BadgeColor } from '@/shared/ui';
import { qk } from '@/shared/api/keys';
import { fetchLabResults } from '../api';
import { formatDate } from '@/shared/lib/date';
import { calcExpiryStatus } from '@/shared/lib/lab-expiry';
import { haptic } from '@/shared/lib/haptic';
import { motion, AnimatePresence } from 'motion/react';
import type { LabResult, LabResultStatus } from '@/shared/types';

/**
 * Лабораторные анализы.
 *
 * Группировка по (test_name + test_date), внутри — список параметров.
 * Для каждого показываем:
 * - Параметр
 * - Значение (цветное по статусу + жирное)
 * - Норма из полей ref_min / ref_max
 * - Подпись статуса (Норма / Ниже / Выше / Критично) справа цветом
 *
 * Порт из vanilla more.js:451-515 (renderLabResultsList).
 */

const STATUS_LABELS: Record<LabResultStatus, string> = {
  normal: 'Норма',
  low: 'Ниже нормы',
  high: 'Выше нормы',
  critical: 'Критично',
};

const STATUS_COLORS: Record<LabResultStatus, string> = {
  normal: 'var(--green)',
  low: 'var(--orange)',
  high: 'var(--orange)',
  critical: 'var(--red)',
};

export default function LabResultsModal() {
  const { data, isLoading } = useQuery({ queryKey: qk.labResults, queryFn: fetchLabResults });
  const [expanded, setExpanded] = useState<string | null>(null);

  const groups = useMemo(() => {
    const byKey = new Map<string, { key: string; name: string; date: string; rows: LabResult[] }>();
    for (const r of data ?? []) {
      const key = `${r.test_name}|||${r.test_date}`;
      if (!byKey.has(key)) {
        byKey.set(key, { key, name: r.test_name, date: r.test_date, rows: [] });
      }
      byKey.get(key)!.rows.push(r);
    }
    return Array.from(byKey.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [data]);

  return (
    <Modal title="Анализы" desktopStyle="page">
      {isLoading && <SkeletonList count={3} height={64} />}
      {!isLoading && groups.length === 0 && (
        <EmptyState icon={<IconTestPipe size={48} color="var(--text-secondary)" />} text="Нет анализов" />
      )}

      {groups.map((g) => {
        const anomalies = g.rows.filter((r) => r.status && r.status !== 'normal').length;
        const expiry = calcExpiryStatus(g.date, g.name);
        const isOpen = expanded === g.key;
        return (
          <div key={g.key} className="card" style={{ padding: 0, marginBottom: 8, overflow: 'hidden' }}>
            <button
              type="button"
              onClick={() => {
                haptic('light');
                setExpanded(isOpen ? null : g.key);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                background: 'var(--card)',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: 'inherit',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              <IconChevronRight
                size={16}
                style={{
                  color: 'var(--text-secondary)',
                  transition: 'transform 0.2s',
                  transform: isOpen ? 'rotate(90deg)' : 'none',
                  flexShrink: 0,
                }}
              />
              <IconTestPipe size={16} color="var(--blue)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {g.name}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {formatDate(g.date)} · {g.rows.length} показат.
                </div>
              </div>
              {anomalies > 0 && (
                <Badge color="orange" icon={<IconAlertTriangle size={11} />}>
                  {anomalies}
                </Badge>
              )}
              {expiry && <ExpiryBadge status={expiry.status} label={expiry.label} />}
            </button>

            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div style={{ padding: '0 14px 12px 14px' }}>
                    {g.rows.map((r) => (
                      <LabRow key={r.id} row={r} />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </Modal>
  );
}

function LabRow({ row }: { row: LabResult }) {
  const status = row.status;
  const color = status && status in STATUS_COLORS ? STATUS_COLORS[status] : 'var(--text)';
  const label = status && status in STATUS_LABELS ? STATUS_LABELS[status] : '';
  const isAnomaly = status != null && status !== 'normal';

  const rangeText =
    row.ref_min != null && row.ref_max != null
      ? `${row.ref_min}–${row.ref_max}`
      : row.ref_min != null
        ? `от ${row.ref_min}`
        : row.ref_max != null
          ? `до ${row.ref_max}`
          : '—';

  return (
    <>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 4px',
          borderBottom: '1px solid var(--separator)',
          fontSize: 13,
        }}
      >
        <div style={{ flex: 1, color: 'var(--text)', minWidth: 0 }}>{row.parameter}</div>

        {/* Значение (цветное) */}
        <div
          style={{
            fontWeight: isAnomaly ? 700 : 500,
            color,
            whiteSpace: 'nowrap',
            minWidth: 60,
            textAlign: 'right',
          }}
        >
          {row.value != null ? row.value : '—'}
          {row.unit && ` ${row.unit}`}
        </div>

        {/* Норма */}
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            minWidth: 70,
            textAlign: 'right',
            whiteSpace: 'nowrap',
          }}
        >
          {rangeText}
        </div>

        {/* Статус-лейбл */}
        {label && (
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color,
              minWidth: 70,
              textAlign: 'right',
              whiteSpace: 'nowrap',
            }}
          >
            {label}
          </div>
        )}
      </div>

      {row.notes && (
        <div
          style={{
            fontSize: 11,
            color: 'var(--text-secondary)',
            padding: '2px 4px 6px',
            lineHeight: 1.4,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 4,
          }}
        >
          <IconInfoCircle size={11} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{row.notes}</span>
        </div>
      )}
    </>
  );
}

function ExpiryBadge({ status, label }: { status: 'valid' | 'expiring' | 'expired'; label: string }) {
  const color: BadgeColor = status === 'expired' ? 'red' : status === 'expiring' ? 'orange' : 'green';
  return (
    <span className={clsx('badge', `badge-${color}`)} style={{ fontSize: 10, whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}
