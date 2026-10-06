'use client';

import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export { Checkbox, Switch } from '@/components/ui/checkbox';

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

/** Bungkus label + kontrol + hint + pesan error (pola shadcn <FormItem>). */
export function Field({ label, required, hint, error, full, className, htmlFor, children }: FieldShellProps) {
  return (
    <div data-slot="form-item" className={cn('field', full && 'full', className)}>
      {label && (
        <Label htmlFor={htmlFor} className={cn(required && 'req')}>
          {label}
        </Label>
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
      <Input id={fid} className={cn(mono && 'font-mono', rest.type === 'date' || rest.type === 'time' ? 'w-full' : '', className)} aria-invalid={!!error || undefined} {...rest} />
    </Field>
  );
}

export interface Option {
  value: string | number;
  label: string;
  disabled?: boolean;
}

function OptionList({ options }: { options: Option[] }) {
  return (
    <>
      {options.map((o) => (
        <option key={String(o.value)} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
    </>
  );
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
      <NativeSelect id={fid} className={className} aria-invalid={!!error || undefined} {...rest}>
        <OptionList options={options} />
      </NativeSelect>
    </Field>
  );
}

export function TextareaField({ label, hint, error, full, mono, fieldClassName, className, id, required, ...rest }: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fid = id || auto;
  return (
    <Field label={label} hint={hint} error={error} full={full} required={required} htmlFor={fid} className={fieldClassName}>
      <Textarea id={fid} rows={rest.rows || 3} className={cn(mono && 'font-mono text-[13px]', className)} aria-invalid={!!error || undefined} {...rest} />
    </Field>
  );
}

/** <select> ringkas untuk toolbar/filter. */
export function Select({ options, className, ...rest }: SelectHTMLAttributes<HTMLSelectElement> & { options: Option[] }) {
  return (
    <NativeSelect className={cn('w-auto', className)} {...rest}>
      <OptionList options={options} />
    </NativeSelect>
  );
}

/** Checkbox + label (shadcn Checkbox). */
export function CheckField({
  label,
  checked,
  onCheckedChange,
  disabled,
  className,
  id,
}: {
  label: ReactNode;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  className?: string;
  id?: string;
}) {
  const auto = useId();
  const fid = id || auto;
  return (
    <div className={cn('check', className)}>
      <Checkbox id={fid} checked={checked} disabled={disabled} onCheckedChange={(v) => onCheckedChange(v === true)} />
      <label htmlFor={fid} className="cursor-pointer">
        {label}
      </label>
    </div>
  );
}

/** Ubah daftar baris master menjadi opsi <select>. */
export function toOptions<T extends { id: number; name?: string }>(rows: T[], placeholder = '— Pilih —', labelFn?: (r: T) => string): Option[] {
  return [{ value: '', label: placeholder }, ...rows.map((r) => ({ value: r.id, label: labelFn ? labelFn(r) : String(r.name ?? r.id) }))];
}
