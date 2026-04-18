import { api } from '@/shared/api/client';
import { EP } from '@/shared/api/endpoints';
import type { Comment } from '@/shared/types';

interface CommentsQuery {
  entity_type: string;
  entity_id: number;
  limit?: number;
  order?: 'asc' | 'desc';
}

export async function fetchComments(q: CommentsQuery): Promise<Comment[]> {
  const params = new URLSearchParams({
    entity_type: q.entity_type,
    entity_id: String(q.entity_id),
  });
  if (q.limit) params.set('limit', String(q.limit));
  if (q.order) params.set('order', q.order);
  return api.get<Comment[]>(`${EP.comments}?${params.toString()}`);
}

export async function addComment(entity_type: string, entity_id: number, text: string): Promise<Comment> {
  return api.post<Comment>(EP.comments, { entity_type, entity_id, text });
}

export async function deleteComment(id: number): Promise<void> {
  await api.del(EP.commentItem(id));
}
