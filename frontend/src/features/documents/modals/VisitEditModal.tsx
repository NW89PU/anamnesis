import { useParams } from 'react-router';
import { IconTrash } from '@tabler/icons-react';
import { Modal, Spinner, Button, useConfirm } from '@/shared/ui';
import { useRouteModal } from '@/shared/hooks/useRouteModal';
import { VisitForm } from '../components/VisitForm';
import { useUpdateVisit, useDeleteVisit } from '../hooks/useVisitMutations';
import { useTimeline } from '../hooks/useTimeline';

/**
 * Модалка редактирования визита. Route: `/documents/visit/:visitId/edit`
 * Показывает все поля, включая AI assessment. Внизу — кнопка удаления.
 */
export default function VisitEditModal() {
  const { visitId } = useParams();
  const id = visitId ? parseInt(visitId, 10) : null;
  const { closeModal } = useRouteModal();
  const { data: timeline } = useTimeline();
  const update = useUpdateVisit();
  const del = useDeleteVisit();
  const { confirm, dialog } = useConfirm();

  const visit = timeline?.find((t) => t.id === id);

  if (!id) return null;

  if (!visit) {
    return (
      <Modal title="Загрузка...">
        <div style={{ textAlign: 'center', padding: 24 }}>
          <Spinner size={24} />
        </div>
      </Modal>
    );
  }

  const handleDelete = async () => {
    const ok = await confirm({
      title: 'Удалить приём?',
      message: 'Привязанные документы останутся. Действие нельзя отменить.',
      confirmText: 'Удалить',
      confirmVariant: 'danger',
    });
    if (!ok) return;
    await del.mutateAsync(id);
    closeModal();
  };

  return (
    <Modal title="Редактирование">
      <VisitForm
        initial={visit}
        showAiField
        submitting={update.isPending}
        submitLabel="Сохранить изменения"
        onSubmit={async (data) => {
          await update.mutateAsync({ id, data });
          closeModal();
        }}
        extraFooter={
          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: '1px solid var(--border)',
            }}
          >
            <Button
              variant="danger"
              size="sm"
              icon={<IconTrash size={14} />}
              onClick={() => void handleDelete()}
              loading={del.isPending}
            >
              Удалить приём
            </Button>
          </div>
        }
      />
      {dialog}
    </Modal>
  );
}
