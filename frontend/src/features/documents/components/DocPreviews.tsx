import { IconFileTypePdf, IconFileText } from '@tabler/icons-react';
import { docFileUrl, isImage, isPdf } from '../lib/doc-helpers';
import type { Document } from '@/shared/types';

/**
 * Строка превью документов под карточкой визита — иконки PDF/изображения.
 * Порт из vanilla `documents.js:196-222`.
 */
export function DocPreviews({ docs }: { docs: Document[] | undefined }) {
  if (!docs || docs.length === 0) return null;
  const images = docs.filter(isImage);
  const others = docs.filter((d) => !isImage(d));

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        marginTop: 10,
        flexWrap: 'wrap',
        alignItems: 'center',
      }}
    >
      {images.map((doc) => {
        const url = docFileUrl(doc);
        if (!url) return null;
        return (
          <div
            key={doc.id}
            style={{
              width: 52,
              height: 52,
              borderRadius: 8,
              overflow: 'hidden',
              border: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            <img
              src={url}
              alt=""
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        );
      })}
      {others.map((doc) => (
        <div
          key={doc.id}
          style={{
            width: 52,
            height: 52,
            borderRadius: 8,
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            background: 'var(--bg)',
          }}
        >
          {isPdf(doc) ? (
            <IconFileTypePdf size={22} color="var(--red)" />
          ) : (
            <IconFileText size={22} color="var(--blue)" />
          )}
        </div>
      ))}
    </div>
  );
}
