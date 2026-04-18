import { useState, useRef, type ChangeEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconVaccine,
  IconCalendar,
  IconPhoto,
  IconCalendarCheck,
  IconAlertCircle,
  IconUpload,
  IconX,
  IconChevronRight,
  IconMedicineSyrup,
} from '@tabler/icons-react';
import {
  Modal,
  Sheet,
  SkeletonList,
  EmptyState,
  Badge,
  Button,
  useConfirm,
  ExpandableText,
  EntityId,
} from '@/shared/ui';
import type { BadgeColor } from '@/shared/ui';
import { qk } from '@/shared/api/keys';
import {
  fetchVaccinations,
  fetchVaccination,
  uploadVaccinationPhoto,
  deleteVaccinationPhoto,
} from '../api';
import { formatDate } from '@/shared/lib/date';
import { haptic } from '@/shared/lib/haptic';
import { CommentsSection } from '@/features/comments/CommentsSection';
import type { Vaccination, VaccinationStatus } from '@/shared/types';

const STATUS_LABELS: Record<VaccinationStatus, string> = {
  scheduled: 'Запланирована',
  done: 'Выполнена',
  skipped: 'Пропущена',
  postponed: 'Отложена',
};

const STATUS_COLORS: Record<VaccinationStatus, BadgeColor> = {
  scheduled: 'orange',
  done: 'green',
  skipped: 'red',
  postponed: 'gray',
};

export default function VaccinationsModal() {
  const { data, isLoading } = useQuery({
    queryKey: qk.vaccinations,
    queryFn: fetchVaccinations,
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const all = data ?? [];

  return (
    <>
      <Modal title="Прививки" desktopStyle="page">
        {isLoading && <SkeletonList count={3} height={64} />}
        {!isLoading && all.length === 0 && (
          <EmptyState
            icon={<IconVaccine size={48} color="var(--text-secondary)" />}
            text="Нет прививок"
          />
        )}

        {all.map((v) => {
          const photoCount = v.photos?.length ?? 0;
          return (
            <div
              key={v.id}
              className="card"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                cursor: 'pointer',
              }}
              onClick={() => {
                haptic('light');
                setSelectedId(v.id);
              }}
            >
              <IconVaccine size={20} color="var(--blue)" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 500 }}>
                  {v.name}
                  <EntityId id={v.id} style={{ marginLeft: 6 }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {v.scheduled_date && (
                    <>
                      <IconCalendar
                        size={11}
                        style={{ verticalAlign: 'middle', marginRight: 2 }}
                      />
                      {formatDate(v.scheduled_date)}
                    </>
                  )}
                  {v.clinic && ` · ${v.clinic}`}
                </div>
                {v.reaction && (
                  <div style={{ fontSize: 12, color: 'var(--orange)', marginTop: 2 }}>
                    <IconAlertCircle
                      size={11}
                      style={{ verticalAlign: 'middle', marginRight: 2 }}
                    />
                    {v.reaction}
                  </div>
                )}
                {photoCount > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--blue)', marginTop: 2 }}>
                    <IconPhoto
                      size={11}
                      style={{ verticalAlign: 'middle', marginRight: 2 }}
                    />
                    {photoCount} фото
                  </div>
                )}
              </div>
              <Badge color={STATUS_COLORS[v.status]}>{STATUS_LABELS[v.status]}</Badge>
              <IconChevronRight
                size={16}
                style={{ color: 'var(--text-secondary)', opacity: 0.4 }}
              />
            </div>
          );
        })}

        <CommentsSection entityType="vaccinations" entityId={0} title="Комментарии к разделу" />
      </Modal>

      <VaccinationDetailSheet id={selectedId} onClose={() => setSelectedId(null)} />
    </>
  );
}

// ── Детальный sub-sheet с фото ──────────────────────────────

function VaccinationDetailSheet({
  id,
  onClose,
}: {
  id: number | null;
  onClose: () => void;
}) {
  const { data: vac } = useQuery({
    queryKey: id ? ['vaccinations', 'item', id] : ['vaccinations', 'none'],
    queryFn: () => fetchVaccination(id as number),
    enabled: id !== null,
  });

  const [fullscreenPhoto, setFullscreenPhoto] = useState<string | null>(null);

  return (
    <>
      <Sheet open={id !== null} onClose={onClose} title={vac?.name ?? ''}>
        {vac && <VaccinationContent vac={vac} onPhotoClick={setFullscreenPhoto} />}
      </Sheet>

      {/* Fullscreen photo viewer */}
      {fullscreenPhoto && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.9)',
            zIndex: 10001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          onClick={() => setFullscreenPhoto(null)}
        >
          <img
            src={fullscreenPhoto}
            alt=""
            style={{
              maxWidth: '95%',
              maxHeight: '95%',
              objectFit: 'contain',
              borderRadius: 8,
            }}
          />
        </div>
      )}
    </>
  );
}

function VaccinationContent({
  vac,
  onPhotoClick,
}: {
  vac: Vaccination;
  onPhotoClick: (url: string) => void;
}) {
  const qc = useQueryClient();
  const { confirm, dialog } = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['vaccinations', 'item', vac.id] });
    void qc.invalidateQueries({ queryKey: qk.vaccinations });
  };

  const uploadMutation = useMutation({
    mutationFn: async (files: FileList) => {
      for (const file of Array.from(files)) {
        await uploadVaccinationPhoto(vac.id, file);
      }
    },
    onSuccess: () => {
      haptic('success');
      invalidate();
    },
    onError: () => haptic('error'),
  });

  const deleteMutation = useMutation({
    mutationFn: (url: string) => deleteVaccinationPhoto(vac.id, url),
    onSuccess: () => {
      haptic('success');
      invalidate();
    },
    onError: () => haptic('error'),
  });

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    uploadMutation.mutate(files);
    e.target.value = '';
  };

  const handleDeletePhoto = async (url: string) => {
    const ok = await confirm({
      message: 'Удалить фото?',
      confirmText: 'Удалить',
      confirmVariant: 'danger',
    });
    if (ok) deleteMutation.mutate(url);
  };

  const photos = vac.photos ?? [];

  return (
    <>
      <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <Badge color={STATUS_COLORS[vac.status]} icon={<IconVaccine size={12} />}>
          {STATUS_LABELS[vac.status]}
        </Badge>
        {vac.dose_number != null && <Badge color="blue">Доза {vac.dose_number}</Badge>}
      </div>

      {vac.vaccine_name && (
        <div
          style={{
            background: 'var(--bg)',
            borderRadius: 12,
            padding: '14px 16px',
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 14, color: 'var(--text)' }}>
            <IconMedicineSyrup
              size={14}
              style={{ verticalAlign: 'middle', marginRight: 4 }}
            />
            Вакцина: <strong>{vac.vaccine_name}</strong>
          </div>
          {vac.batch_number && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Серия: {vac.batch_number}
            </div>
          )}
          {vac.administered_by && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
              Врач: {vac.administered_by}
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
        {vac.scheduled_date && (
          <div>
            <IconCalendar size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Запланировано: {formatDate(vac.scheduled_date)}
          </div>
        )}
        {vac.actual_date && (
          <div>
            <IconCalendarCheck
              size={13}
              style={{ verticalAlign: 'middle', marginRight: 4 }}
            />
            Выполнено: {formatDate(vac.actual_date)}
          </div>
        )}
      </div>

      {vac.reaction && (
        <div
          style={{
            background: 'rgba(255,149,0,0.08)',
            border: '1px solid rgba(255,149,0,0.2)',
            borderRadius: 12,
            padding: '12px 16px',
            marginBottom: 16,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--orange)',
              marginBottom: 4,
            }}
          >
            <IconAlertCircle
              size={13}
              style={{ verticalAlign: 'middle', marginRight: 4 }}
            />
            Реакция
          </div>
          <div style={{ fontSize: 13, color: 'var(--text)' }}>{vac.reaction}</div>
        </div>
      )}

      {vac.notes && (
        <div style={{ marginBottom: 12 }}>
          <ExpandableText
            text={vac.notes}
            bg="var(--card)"
            textStyle={{ fontSize: 13, color: 'var(--text-secondary)' }}
          />
        </div>
      )}

      {/* Photos */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--text)',
            marginBottom: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <IconPhoto size={14} /> Фото документов {photos.length > 0 && `(${photos.length})`}
        </div>

        {photos.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
              gap: 8,
              marginBottom: 12,
            }}
          >
            {photos.map((url, idx) => (
              <div
                key={idx}
                style={{
                  position: 'relative',
                  borderRadius: 8,
                  overflow: 'hidden',
                  aspectRatio: '1',
                  cursor: 'pointer',
                }}
                onClick={() => onPhotoClick(url)}
              >
                <img
                  src={url}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  loading="lazy"
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDeletePhoto(url);
                  }}
                  style={{
                    position: 'absolute',
                    top: 4,
                    right: 4,
                    background: 'rgba(0,0,0,0.6)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '50%',
                    width: 22,
                    height: 22,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  aria-label="Удалить фото"
                >
                  <IconX size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>
            Нет загруженных фото
          </div>
        )}

        <Button
          size="sm"
          variant="secondary"
          icon={<IconUpload size={14} />}
          loading={uploadMutation.isPending}
          onClick={() => fileInputRef.current?.click()}
        >
          Загрузить фото
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          style={{ display: 'none' }}
          onChange={handleFileSelect}
        />
      </div>

      <CommentsSection entityType="vaccination" entityId={vac.id} />
      {dialog}
    </>
  );
}
