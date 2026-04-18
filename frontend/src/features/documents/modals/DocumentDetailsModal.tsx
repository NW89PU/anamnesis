import { useParams } from 'react-router';
import { Modal, Spinner } from '@/shared/ui';
import { useAllDocuments } from '../hooks/useTimeline';
import { DocumentBlock } from '../components/DocumentBlock';
import { CommentsSection } from '@/features/comments/CommentsSection';

/**
 * Модалка деталей standalone-документа (не привязан к визиту).
 * Route: `/documents/doc/:docId`
 */
export default function DocumentDetailsModal() {
  const { docId } = useParams();
  const id = docId ? parseInt(docId, 10) : null;
  const { data: docs } = useAllDocuments();
  const doc = docs?.find((d) => d.id === id);

  if (!id) return null;

  if (!doc) {
    return (
      <Modal title="Загрузка...">
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spinner size={24} />
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={doc.title ?? doc.original_name ?? 'Документ'}>
      <DocumentBlock doc={doc} />
      <CommentsSection entityType="document" entityId={doc.id} />
    </Modal>
  );
}
