/**
 * Текстовые утилиты.
 * Порт из vanilla `frontend/js/utils.js`.
 *
 * ВАЖНО: `escapeHtml` из vanilla здесь НЕ нужен — React автоматически
 * экранирует все строки в JSX. Единственное исключение — `dangerouslySetInnerHTML`,
 * которое мы запрещаем (см. §16 плана).
 */

/**
 * Обрезает текст до N символов, берёт только первую непустую строку,
 * добавляет "..." если обрезано. Используется для превью в списках.
 */
export function truncate(text: string | null | undefined, maxLen: number): string {
  if (!text) return '';
  const firstLine = text.split('\n').find((l) => l.trim()) ?? '';
  return firstLine.length > maxLen ? firstLine.slice(0, maxLen) + '...' : firstLine;
}

/**
 * Первая буква заглавная.
 */
export function capitalize(text: string | null | undefined): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Плюрализация для русского: "1 день", "2 дня", "5 дней".
 * n — число, forms — [singular, few, many].
 */
export function plural(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}
