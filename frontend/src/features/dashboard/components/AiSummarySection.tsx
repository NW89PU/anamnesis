import { IconBrain, IconClock, IconUrgent, IconListCheck, IconAlertTriangle } from '@tabler/icons-react';
import { Collapsible } from '@/shared/ui';
import { formatDate } from '@/shared/lib/date';
import type { DashboardAiSummary } from '@/shared/types';

/**
 * AI-сводка — сверху приоритеты/план действий/предупреждения.
 * В новом layout (§9) СВЁРНУТА по умолчанию, чтобы освободить место для цифр.
 *
 * Порт из vanilla `dashboard.js:335-388` (renderAiSummary).
 */
export function AiSummarySection({ data }: { data: DashboardAiSummary | null | undefined }) {
  if (!data || !data.summary) return null;
  const updatedLabel = data.updated_at ? formatDate(data.updated_at) : null;

  return (
    <Collapsible
      title="AI-сводка"
      icon={<IconBrain size={18} color="var(--purple)" />}
      persistKey="dashboard-ai-summary"
      defaultOpen={false}
      badge={
        updatedLabel && (
          <span
            style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              fontWeight: 400,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <IconClock size={11} /> {updatedLabel}
          </span>
        )
      }
    >
      <div
        style={{
          background:
            'linear-gradient(135deg, rgba(175,82,222,0.06) 0%, rgba(0,122,255,0.04) 100%)',
          border: '1px solid rgba(175,82,222,0.15)',
          borderRadius: 12,
          padding: 16,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--purple)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
          }}
        >
          <IconBrain size={20} /> Сводка
        </div>

        <div
          style={{
            fontSize: 13,
            lineHeight: 1.8,
            color: 'var(--text)',
            whiteSpace: 'pre-line',
          }}
        >
          {data.summary}
        </div>

        {data.priorities && data.priorities.length > 0 && (
          <AiListBlock
            color="var(--red)"
            icon={<IconUrgent size={14} />}
            title="Приоритеты"
            items={data.priorities}
          />
        )}

        {data.next_steps && data.next_steps.length > 0 && (
          <AiListBlock
            color="var(--blue)"
            icon={<IconListCheck size={14} />}
            title="План действий"
            items={data.next_steps}
          />
        )}

        {data.warnings && data.warnings.length > 0 && (
          <AiListBlock
            color="var(--orange)"
            icon={<IconAlertTriangle size={14} />}
            title="На что обратить внимание"
            items={data.warnings}
          />
        )}
      </div>
    </Collapsible>
  );
}

function AiListBlock({
  color,
  icon,
  title,
  items,
}: {
  color: string;
  icon: React.ReactNode;
  title: string;
  items: string[];
}) {
  return (
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color,
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {icon} {title}
      </div>
      <ul
        style={{
          margin: 0,
          paddingLeft: 20,
          fontSize: 13,
          lineHeight: 1.8,
          color: 'var(--text)',
        }}
      >
        {items.map((item, idx) => (
          <li key={idx}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
