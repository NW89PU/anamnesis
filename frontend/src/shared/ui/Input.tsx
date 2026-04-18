import clsx from 'clsx';
import type { InputHTMLAttributes } from 'react';

/**
 * Текстовый input. Применяет класс `.form-input` из app.css.
 *
 * Работает и с react-hook-form, и с контролируемыми useState:
 * ```tsx
 * // RHF:
 * <Input {...register('name')} placeholder="Имя" />
 * // Контролируемый:
 * <Input value={query} onChange={e => setQuery(e.target.value)} />
 * ```
 */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export function Input({ invalid, className, ...rest }: InputProps) {
  return (
    <input
      className={clsx('form-input', invalid && 'form-input-invalid', className)}
      {...rest}
    />
  );
}
