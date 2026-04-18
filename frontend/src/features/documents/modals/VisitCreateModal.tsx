import { Modal } from '@/shared/ui';
import { useRouteModal } from '@/shared/hooks/useRouteModal';
import { VisitForm } from '../components/VisitForm';
import { useCreateVisit } from '../hooks/useVisitMutations';

/**
 * Модалка создания нового визита. Route: `/documents/new`
 */
export default function VisitCreateModal() {
  const { closeModal } = useRouteModal();
  const mutation = useCreateVisit();

  return (
    <Modal title="Новый приём">
      <VisitForm
        onSubmit={async (data) => {
          await mutation.mutateAsync(data);
          closeModal();
        }}
        submitting={mutation.isPending}
        submitLabel="Создать приём"
      />
    </Modal>
  );
}
