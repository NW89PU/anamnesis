import type { PlanItem, Priority } from '@/shared/types';

export const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: 'Срочно',
  high: 'Важно',
  medium: 'Плановое',
  low: 'Плановое',
};

export const PRIORITY_ORDER: Priority[] = ['urgent', 'high', 'medium', 'low'];

export function groupByPriority(items: PlanItem[]): Record<Priority, PlanItem[]> {
  const groups: Record<Priority, PlanItem[]> = {
    urgent: [],
    high: [],
    medium: [],
    low: [],
  };
  for (const item of items) {
    const p: Priority = (item.priority ?? 'medium') as Priority;
    groups[p].push(item);
  }
  return groups;
}
