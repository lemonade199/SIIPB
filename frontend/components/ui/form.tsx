'use client';

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface FieldShellProps {
  label?: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  full?: boolean;
  className?: string;
  htmlFor?: string;
  children: ReactNode;
}

/** Bungkus label + kontrol + hint + pesan error (pola shadcn <FormField>). */
export function Field({ label, required, hint, error, full, className, htmlFor, children }: FieldShellProps) {
  return (
    <div className={cn('field', full && 'full', className)}>
      {label && (
        <label htmlFor={htmlFor} className={cn(required && 'req')}>
          {label}
        </label>
      )}
      {children}
      {hint && <span className="hint">{hint}</span>}
      {error && (
        <span className="err" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

type Common = { label?: ReactNode; hint?: ReactNode; error?: string; full?: boolean; mono?: boolean; fieldClassName?: string };

export function TextField({ label, hint, error, full, mono, fieldClassName, className, id, required, ...rest }: Common & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fid = id || auto;
  return (
    <Field label={label} hint={hint} error={error} full={full} required={required} htmlFor={fid} className={fieldClassName}>
      <input id={fid} className={cn('input', mono && 'mono', error && 'invalid', className)} aria-invalid={!!error || undefined} {...rest} />
    </Field>
  );
}

export interface Option {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export function SelectField({
  label,
  hint,
  error,
  full,
  fieldClassName,
  className,
  id,
  required,
  options,
  ...rest
}: Common & SelectHTMLAttributes<HTMLSelectElement> & { options: Option[] }) {
  const auto = useId();
  const fid = id || auto;
  return (
    <Field label={label} hint={hint} error={error} full={full} required={required} htmlFor={fid} className={fieldClassName}>
      <select id={fid} className={cn('input', error && 'invalid', className)} aria-invalid={!!error || undefined} {...rest}>
        {options.map((o) => (
          <option key={String(o.value)} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function TextareaField({ label, hint, error, full, mono, fieldClassName, className, id, required, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fid = id || auto;
  return (
    <Field label={label} hint={hint} error={error} full={full} required={required} htmlFor={fid} className={fieldClassName}>
      <textarea id={fid} rows={rest.rows || 3} className={cn('input', mono && 'mono', error && 'invalid', className)} aria-invalid={!!error || undefined} {...rest} />
    </Field>
  );
}

/** <select> polos untuk toolbar/filter. */
export function Select({ options, className, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { options: Option[] }) {
  return (
    <select className={cn('input', className)} {...rest}>
      {options.map((o) => (
        <option key={String(o.value)} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({ label, className, ...rest }: { label: ReactNode } & Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <label className={cn('check', className)}>
      <input type="checkbox" {...rest} />
      <span>{label}</span>
    </label>
  );
}

export function Switch({ className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  return (
    <label className={cn('switch', className)} title={rest.title}>
      <input type="checkbox" {...rest} />
      <span />
    </label>
  );
}

/** Ubah daftar baris master menjadi opsi <select>. */
export function toOptions<T extends { id: number; name?: string }>(rows: T[], placeholder = '— Pilih —', labelFn?: (r: T) => string): Option[] {
  return [{ value: '', label: placeholder }, ...rows.map((r) => ({ value: r.id, label: labelFn ? labelFn(r) : String(r.name ?? r.id) }))];
}
