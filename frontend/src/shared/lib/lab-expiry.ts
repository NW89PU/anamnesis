/**
 * Срок годности лабораторных анализов по названию.
 * Порт из vanilla `frontend/js/pages/more.js` (функция getLabExpiry).
 *
 * ВАЖНО: точная карта срока годности должна совпадать с vanilla. Если найдёшь
 * расхождение — читай vanilla-источник как истину.
 *
 * Возвращает количество месяцев валидности для данного типа анализа.
 */

interface ExpiryRule {
  patterns: string[]; // нижний регистр, .includes()
  months: number;
}

// Порядок важен: более специфичные правила идут первыми.
const RULES: ExpiryRule[] = [
  { patterns: ['оаэ', 'отоакуст'], months: 12 },
  { patterns: ['ээг'], months: 12 },
  { patterns: ['экг'], months: 3 },
  { patterns: ['эхо', 'узи'], months: 12 },
  { patterns: ['общий анализ крови', 'оак', 'кровь общ'], months: 1 },
  { patterns: ['биохим'], months: 1 },
  { patterns: ['моч'], months: 1 },
  { patterns: ['паразит', 'гельминт', 'энтеробиоз'], months: 3 },
  { patterns: ['гормон', 'ттг', 'т3', 'т4'], months: 6 },
  { patterns: ['аллерг', 'ige'], months: 12 },
  { patterns: ['витамин'], months: 6 },
  { patterns: ['иммуно'], months: 6 },
];

const DEFAULT_MONTHS = 6;

export function getLabExpiryMonths(testName: string | null | undefined): number {
  if (!testName) return DEFAULT_MONTHS;
  const name = testName.toLowerCase();
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (name.includes(pattern)) return rule.months;
    }
  }
  return DEFAULT_MONTHS;
}

export interface ExpiryStatus {
  status: 'valid' | 'expiring' | 'expired';
  /** Сколько осталось / просрочено, в днях. Отрицательное = просрочено. */
  daysLeft: number;
  label: string;
}

/**
 * Рассчитывает статус годности анализа по дате сдачи и названию.
 * - valid   — больше 30 дней до окончания
 * - expiring — осталось < 30 дней
 * - expired  — уже просрочен
 */
export function calcExpiryStatus(
  testDate: string | Date | null | undefined,
  testName: string | null | undefined
): ExpiryStatus | null {
  if (!testDate) return null;
  const months = getLabExpiryMonths(testName);
  const taken = new Date(testDate);
  const expiresAt = new Date(taken);
  expiresAt.setMonth(expiresAt.getMonth() + months);

  const msLeft = expiresAt.getTime() - Date.now();
  const daysLeft = Math.floor(msLeft / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return { status: 'expired', daysLeft, label: `Просрочен на ${Math.abs(daysLeft)} дн.` };
  }
  if (daysLeft < 30) {
    return { status: 'expiring', daysLeft, label: `Осталось ${daysLeft} дн.` };
  }
  const monthsLeft = Math.floor(daysLeft / 30);
  return { status: 'valid', daysLeft, label: `Годен ещё ${monthsLeft} мес.` };
}
