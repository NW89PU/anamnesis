import { useQuery } from '@tanstack/react-query';
import { IconRuler2 } from '@tabler/icons-react';
import { Modal, SkeletonList, EmptyState, EntityId } from '@/shared/ui';
import { qk } from '@/shared/api/keys';
import { fetchGrowth } from '../api';
import { formatDate } from '@/shared/lib/date';

export default function GrowthModal() {
  const { data, isLoading } = useQuery({ queryKey: qk.growth, queryFn: fetchGrowth });
  const all = data ?? [];

  return (
    <Modal title="Рост и вес" desktopStyle="page">
      {isLoading && <SkeletonList count={3} height={56} />}
      {!isLoading && all.length === 0 && (
        <EmptyState icon={<IconRuler2 size={48} color="var(--text-secondary)" />} text="Нет измерений" />
      )}
      {all.length > 0 && (
        <div
          style={{
            background: 'var(--card)',
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: 'var(--shadow)',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg)' }}>
                <th style={{ padding: '10px 8px', textAlign: 'left', fontWeight: 600 }}>Дата</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600 }}>Рост</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600 }}>Вес</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600 }}>Голова</th>
                <th style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 600, width: 40 }}>#</th>
              </tr>
            </thead>
            <tbody>
              {all.map((g) => (
                <tr key={g.id} style={{ borderTop: '1px solid var(--separator)' }}>
                  <td style={{ padding: '10px 8px' }}>{formatDate(g.measured_at)}</td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                    {g.height_cm != null ? `${g.height_cm} см` : '—'}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                    {g.weight_kg != null ? `${g.weight_kg} кг` : '—'}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                    {g.head_circumference_cm != null ? `${g.head_circumference_cm} см` : '—'}
                  </td>
                  <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                    <EntityId id={g.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
