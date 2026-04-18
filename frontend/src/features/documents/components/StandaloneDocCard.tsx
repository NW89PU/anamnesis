import { IconChevronRight, IconFileTypePdf, IconFileText, IconTag, IconUser, IconBrain } from '@tabler/icons-react';
import { haptic } from '@/shared/lib/haptic';
import { Badge, EntityId } from '@/shared/ui';
import { docFileUrl, isImage, isPdf, DOC_CATEGORY_LABELS, parseEventDate } from '../lib/doc-helpers';
import type { Document } from '@/shared/types';

/**
 * Карточка отдельного документа (не привязан к визиту).
 * Порт из vanilla `documents.js` renderStandaloneDocCard.
 */
interface Props {
  doc: Document;
  onClick: (doc: Document) => void;
}

export function StandaloneDocCard({ doc, onClick }: Props) {
  // Приоритет — document_date (дата события, например когда сдали анализ),
  // fallback на created_at (дата загрузки в систему).
  // Так документ попадает в нужное место хронологии.
  const dateSource = doc.document_date || doc.created_at;
  const date = dateSource ? parseEventDate(dateSource) : null;
  const url = docFileUrl(doc);
  const img = isImage(doc);
  const pdf = isPdf(doc);

  return (
    <div
      className="timeline-item standalone-doc"
      style={{ cursor: 'pointer' }}
      onClick={() => {
        haptic('light');
        onClick(doc);
      }}
    >
      {date && (
        <div className="timeline-date">
          <div className="timeline-date-day">{date.day}</div>
          <div className="timeline-date-month">{date.month}</div>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            background: img && url ? 'transparent' : 'var(--bg)',
            border: img && url ? 'none' : '1px solid var(--border)',
            overflow: 'hidden',
          }}
        >
          {img && url ? (
            <img
              src={url}
              alt=""
              loading="lazy"
              style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover' }}
            />
          ) : pdf ? (
            <IconFileTypePdf size={22} color="var(--red)" />
          ) : (
            <IconFileText size={22} color="var(--blue)" />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="timeline-title" style={{ fontSize: 14 }}>
            {doc.title ?? doc.original_name ?? 'Документ'}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, alignItems: 'center' }}>
            {doc.category && (
              <Badge color="gray" icon={<IconTag size={11} />}>
                {DOC_CATEGORY_LABELS[doc.category] ?? doc.category}
              </Badge>
            )}
            {doc.source_doctor && (
              <Badge color="gray" icon={<IconUser size={11} />}>
                {doc.source_doctor}
              </Badge>
            )}
            {doc.ai_assessment && (
              <Badge color="purple" icon={<IconBrain size={11} />}>
                AI
              </Badge>
            )}
            <EntityId id={doc.id} />
          </div>
        </div>

        <IconChevronRight
          size={16}
          style={{ color: 'var(--text-secondary)', opacity: 0.4, flexShrink: 0 }}
        />
      </div>
    </div>
  );
}
