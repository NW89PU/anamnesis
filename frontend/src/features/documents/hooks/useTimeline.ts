import { useQuery } from '@tanstack/react-query';
import { qk } from '@/shared/api/keys';
import { fetchTimeline, fetchAllDocuments, fetchTimelineItem } from '../api';

export function useTimeline() {
  return useQuery({
    queryKey: qk.timeline,
    queryFn: fetchTimeline,
  });
}

export function useAllDocuments() {
  return useQuery({
    queryKey: qk.documents,
    queryFn: fetchAllDocuments,
  });
}

export function useTimelineItem(id: number | null) {
  return useQuery({
    queryKey: id ? qk.timelineItem(id) : ['timeline', 'item', 'none'],
    queryFn: () => fetchTimelineItem(id as number),
    enabled: id !== null,
  });
}
