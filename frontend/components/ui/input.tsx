import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** Kelas dasar kontrol form (shadcn/ui). */
export const controlClass =
  'w-full min-w-0 rounded-lg border border-input bg-card px-[11px] text-sm text-foreground outline-none transition-[border-color,box-shadow] placeholder:text-subtle focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/15 disabled:cursor-not-allowed disabled:opacity-60 read-only:bg-[#f7f9fb] aria-invalid:border-destructive';

/** shadcn/ui Input. */
export function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return <input type={type} data-slot="input" className={cn(controlClass, 'h-[38px]', type === 'date' || type === 'time' ? 'w-auto' : '', className)} {...props} />;
}

/** shadcn/ui Textarea. */
export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn(controlClass, 'min-h-[84px] resize-y py-[9px]', className)} {...props} />;
}

/** shadcn/ui NativeSelect. */
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return <select data-slot="native-select" className={cn(controlClass, 'h-[38px] pr-8', className)} {...props} />;
}
