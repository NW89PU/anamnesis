import { IconList, IconStethoscope, IconFiles } from '@tabler/icons-react';
import { Chip } from '@/shared/ui';
import type { DocumentsFilter } from '../lib/doc-helpers';

interface Props {
  active: DocumentsFilter;
  onChange: (filter: DocumentsFilter) => void;
}

export function FilterTabs({ active, onChange }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        marginBottom: 16,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-x',
      }}
    >
      <Chip active={active === 'all'} onClick={() => onChange('all')} icon={<IconList size={14} />}>
        Все
      </Chip>
      <Chip
        active={active === 'visits'}
        onClick={() => onChange('visits')}
        icon={<IconStethoscope size={14} />}
      >
        Приёмы
      </Chip>
      <Chip active={active === 'docs'} onClick={() => onChange('docs')} icon={<IconFiles size={14} />}>
        Документы
      </Chip>
    </div>
  );
}
