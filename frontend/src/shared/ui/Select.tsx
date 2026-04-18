import clsx from 'clsx';
import type { SelectHTMLAttributes, ReactNode } from 'react';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  children: ReactNode;
}

export function Select({ invalid, className, children, ...rest }: SelectProps) {
  return (
    <select
      className={clsx('form-select', invalid && 'form-input-invalid', className)}
      {...rest}
    >
      {children}
    </select>
  );
}
