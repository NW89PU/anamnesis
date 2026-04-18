import {
  IconPhoto,
  IconFileTypePdf,
  IconFile,
  IconExternalLink,
  IconDownload,
  IconFileText,
  IconBrain,
  IconTag,
  IconUser,
  IconBuildingHospital,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Button, ExpandableText, ZoomableImage, CopyButton } from '@/shared/ui';
import { api } from '@/shared/api/client';
import { EP } from '@/shared/api/endpoints';
import { docFileUrl, isImage, isPdf, DOC_CATEGORY_LABELS } from '../lib/doc-helpers';
import { CommentsSection } from '@/features/comments/CommentsSection';
import type { Document } from '@/shared/types';

/**
 * Хук для PDF превью страниц. Backend генерирует PNG через pdftoppm
 * в /uploads/previews/{basename}-{page}.png и отдаёт список через
 * `GET /api/documents/:id/previews`.
 */
interface PreviewsResponse {
  previews: string[];
}

function usePdfPreviews(docId: number, enabled: boolean) {
  return useQuery({
    queryKey: ['document-previews', docId],
    queryFn: () => api.get<PreviewsResponse>(EP.documentPreviews(docId)),
    enabled,
    retry: false,
    // Previews статические — не нужно рефетчить постоянно
    staleTime: 1000 * 60 * 60, // 1 час
  });
}

/**
 * Блок одного документа внутри деталей визита.
 * Порт из vanilla `documents.js:226-285` (renderDocumentBlock).
 */
export function DocumentBlock({ doc }: { doc: Document }) {
  const url = docFileUrl(doc);
  const img = isImage(doc);
  const pdf = isPdf(doc);
  // Запрашиваем PNG-превью страниц только для PDF документов
  const { data: previewsData } = usePdfPreviews(doc.id, pdf);
  const pdfPreviews = previewsData?.previews ?? [];

  return (
    <div
      style={{
        background: 'var(--bg)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
      }}
    >
      <div
        style={{
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {img ? (
          <IconPhoto size={16} color="var(--blue)" />
        ) : pdf ? (
          <IconFileTypePdf size={16} color="var(--red)" />
        ) : (
          <IconFile size={16} color="var(--text-secondary)" />
        )}
        {doc.title ?? doc.original_name ?? 'Документ'}
      </div>

      {url && img && (
        <div
          style={{
            textAlign: 'center',
            maxHeight: '50vh',
            overflow: 'auto',
            borderRadius: 10,
            border: '1px solid var(--border)',
            marginBottom: 10,
          }}
        >
          <ZoomableImage src={url} alt={doc.title ?? ''} />
        </div>
      )}

      {/* PDF — показываем PNG превью страниц (генерируются на бэке
          через pdftoppm). iOS Safari не рендерит PDF в iframe, поэтому
          используем превью везде. Каждая страница — отдельная картинка
          с zoom по клику. */}
      {pdf && pdfPreviews.length > 0 && (
        <div
          style={{
            maxHeight: '50vh',
            overflow: 'auto',
            borderRadius: 10,
            border: '1px solid var(--border)',
            marginBottom: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 8,
            background: 'var(--bg)',
          }}
        >
          {pdfPreviews.map((src, idx) => (
            <div key={idx} style={{ textAlign: 'center' }}>
              <ZoomableImage
                src={src}
                alt={`${doc.title ?? 'PDF'} — стр. ${idx + 1}`}
                style={{ maxWidth: '100%', display: 'block', margin: '0 auto' }}
              />
              {pdfPreviews.length > 1 && (
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--text-secondary)',
                    marginTop: 4,
                  }}
                >
                  стр. {idx + 1} из {pdfPreviews.length}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {url && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {/* Открываем через window.open а не <a target="_blank">, потому
              что в PWA standalone <a target="_blank"> часто открывается в
              том же окне → React Router ловит /uploads/xxx.pdf → catch-all
              → /dashboard. window.open пробивает в системный браузер. */}
          <Button
            size="sm"
            block
            icon={<IconExternalLink size={13} />}
            onClick={(e) => {
              e.stopPropagation();
              window.open(url, '_blank', 'noopener,noreferrer');
            }}
          >
            Открыть
          </Button>
          {/* Для скачивания используем временный якорь — download работает
              через прямую ссылку. Тоже не должен навигировать в PWA. */}
          <Button
            size="sm"
            variant="secondary"
            block
            icon={<IconDownload size={13} />}
            onClick={(e) => {
              e.stopPropagation();
              const a = document.createElement('a');
              a.href = url;
              a.download = doc.original_name ?? doc.title ?? 'document';
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            }}
          >
            Скачать
          </Button>
        </div>
      )}

      {doc.transcription && (
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text)',
              marginBottom: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 4,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconFileText size={13} /> Расшифровка
            </span>
            <CopyButton text={doc.transcription} />
          </div>
          <div
            style={{
              background: 'var(--card)',
              borderRadius: 10,
              padding: 12,
            }}
          >
            <ExpandableText
              text={doc.transcription}
              bg="var(--card)"
              textStyle={{ fontSize: 12, lineHeight: 1.7 }}
              actionColor="var(--text)"
            />
          </div>
        </div>
      )}

      {doc.ai_assessment && (
        <div style={{ marginBottom: 10 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--purple)',
              marginBottom: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <IconBrain size={13} /> Оценка AI
          </div>
          <div
            style={{
              background: '#F8F1FC',
              border: '1px solid rgba(175,82,222,0.15)',
              borderRadius: 10,
              padding: 12,
            }}
          >
            <ExpandableText
              text={doc.ai_assessment}
              bg="#F8F1FC"
              textStyle={{ fontSize: 12, lineHeight: 1.7 }}
              actionColor="var(--purple)"
            />
          </div>
        </div>
      )}

      <div
        style={{
          fontSize: 11,
          color: 'var(--text-secondary)',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
        }}
      >
        {doc.category && (
          <span>
            <IconTag size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} />
            {DOC_CATEGORY_LABELS[doc.category] ?? doc.category}
          </span>
        )}
        {doc.source_doctor && (
          <span>
            <IconUser size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} />
            {doc.source_doctor}
          </span>
        )}
        {doc.source_org && (
          <span>
            <IconBuildingHospital size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} />
            {doc.source_org}
          </span>
        )}
      </div>

      {/* Комментарии к конкретному документу внутри визита.
          Раньше отсутствовали — если у документа были пользовательские
          комменты и ответы AI (entity_type='document'), они не показывались
          и выглядели как "потерянные". */}
      <CommentsSection entityType="document" entityId={doc.id} />
    </div>
  );
}
