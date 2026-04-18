import { IconListCheck, IconCircleCheck } from '@tabler/icons-react';
import { haptic } from '@/shared/lib/haptic';

export type PlanTab = 'pending' | 'done';

interface Props {
  active: PlanTab;
  pendingCount: number;
  doneCount: number;
  onChange: (tab: PlanTab) => void;
}

/**
 * Два таба План/Выполнено. Порт из vanilla `plan.js:130-146`.
 * Стили inline — в vanilla они тоже были inline, чтобы сохранить визуал 1:1.
 */
export function PlanTabs({ active, pendingCount, doneCount, onChange }: Props) {
  const mkBtn = (tab: PlanTab, label: string, count: number, color: string, shadow: string) => (
    <button
      type="button"
      onClick={() => {
        haptic('light');
        onChange(tab);
      }}
      style={{
        flex: 1,
        padding: '10px 0',
        borderRadius: 12,
        border: 'none',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        background: active === tab ? color : 'var(--card)',
        color: active === tab ? '#fff' : 'var(--text-secondary)',
        boxShadow: active === tab ? shadow : 'none',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {tab === 'pending' ? <IconListCheck size={16} /> : <IconCircleCheck size={16} />}
      {label} ({count})
    </button>
  );

  return (
    <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
      {mkBtn('pending', 'Запланировано', pendingCount, 'var(--orange)', '0 2px 8px rgba(255,149,0,0.3)')}
      {mkBtn('done', 'Выполнено', doneCount, 'var(--green)', '0 2px 8px rgba(52,199,89,0.3)')}
    </div>
  );
}
