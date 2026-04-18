import { api } from '@/shared/api/client';
import { EP } from '@/shared/api/endpoints';
import type {
  Specialist,
  Medication,
  Vaccination,
  GrowthMeasurement,
  LabResult,
  Reminder,
} from '@/shared/types';

export const fetchSpecialists = (): Promise<Specialist[]> =>
  api.get<Specialist[]>(EP.specialists);

export const fetchMedications = (): Promise<Medication[]> =>
  api.get<Medication[]>(EP.medications);

export const fetchVaccinations = (): Promise<Vaccination[]> =>
  api.get<Vaccination[]>(EP.vaccinations);

export const fetchVaccination = (id: number): Promise<Vaccination> =>
  api.get<Vaccination>(EP.vaccinationItem(id));

export const uploadVaccinationPhoto = (id: number, file: File): Promise<unknown> => {
  const fd = new FormData();
  fd.append('photo', file);
  return api.upload(EP.vaccinationPhotos(id), fd);
};

export const deleteVaccinationPhoto = (id: number, photoUrl: string): Promise<unknown> =>
  api.del(EP.vaccinationPhotos(id), { photo_url: photoUrl });

export const fetchGrowth = (): Promise<GrowthMeasurement[]> =>
  api.get<GrowthMeasurement[]>(EP.growth);

export const fetchLabResults = (): Promise<LabResult[]> =>
  api.get<LabResult[]>(EP.labResults);

export const fetchReminders = (): Promise<Reminder[]> =>
  api.get<Reminder[]>(EP.reminders);

/**
 * Реальный ответ бэкенда /api/search возвращает объекты с произвольными
 * полями в зависимости от типа сущности (name, status, и т.д.) и помечает
 * тип полем `_type`. Обёрнут в `{ results: [...] }`.
 */
interface SearchHit {
  _type: string;
  id: number;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  status?: string | null;
}

/**
 * Defensive parsing — бэкенд может вернуть:
 * - прямой массив
 * - обёртку `{ results: [...] }` (реальный формат)
 * - что-то ещё (например HTML страницу ошибки, unexpected JSON)
 * В любом случае возвращаем валидный массив, никогда не кидаем exception.
 */
export const search = async (q: string): Promise<SearchHit[]> => {
  try {
    const data = await api.get<unknown>(EP.search(q));
    if (Array.isArray(data)) return data as SearchHit[];
    if (data && typeof data === 'object' && 'results' in data) {
      const results = (data as { results: unknown }).results;
      if (Array.isArray(results)) return results as SearchHit[];
    }
    return [];
  } catch {
    return [];
  }
};

export type { SearchHit };

interface VersionInfo {
  version: string;
}
export const fetchVersion = (): Promise<VersionInfo> => api.get<VersionInfo>(EP.version);

interface ChangelogEntry {
  id: number;
  version: string;
  reason: string | null;
  changes: string[];
  created_at: string;
}
export const fetchChangelog = (): Promise<ChangelogEntry[]> =>
  api.get<ChangelogEntry[]>(EP.changelog);

export type { ChangelogEntry, VersionInfo };
