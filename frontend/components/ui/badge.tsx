import { cva, type VariantProps } from 'class-variance-authority';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** shadcn/ui Badge dengan varian warna status SIIPB. */
export const badgeVariants = cva(
  'badge inline-flex w-fit shrink-0 items-center gap-[5px] whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-[11.5px] font-[650] tracking-[.02em] before:size-1.5 before:rounded-full before:bg-current before:opacity-85 before:content-[""]',
  {
    variants: {
      tone: {
        ok: 'bg-ok-bg text-ok',
        info: 'bg-info-bg text-info',
        warn: 'bg-warn-bg text-warn',
        late: 'bg-late-bg text-late',
        danger: 'bg-danger-bg text-danger',
        purple: 'bg-purple-bg text-purple',
        gray: 'bg-gray-bg text-gray',
      },
    },
    defaultVariants: { tone: 'gray' },
  },
);
type Tone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

const STATUS_TONE: Record<string, Tone> = {
  TERSEDIA: 'ok',
  DIPINJAM: 'info',
  RUSAK: 'warn',
  RUSAK_BERAT: 'danger',
  DALAM_PERBAIKAN: 'purple',
  HILANG: 'danger',
  DRAF: 'gray',
  'JATUH TEMPO': 'warn',
  TERLAMBAT: 'late',
  DIKEMBALIKAN: 'gray',
  DIBATALKAN: 'gray',
  TERKIRIM: 'ok',
  GAGAL: 'danger',
  MENUNGGU: 'warn',
  DILEWATI: 'gray',
  SUKSES: 'ok',
  AKTIF: 'ok',
  NONAKTIF: 'gray',
  BAIK: 'ok',
  RUSAK_RINGAN: 'warn',
};

export const statusTone = (status: string): Tone => STATUS_TONE[status] || 'gray';

/** Badge status. `status` menentukan warna; `children` (opsional) mengganti label. */
export function Badge({ status, tone, children, className }: { status?: string; tone?: Tone; children?: ReactNode; className?: string }) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ tone: tone ?? statusTone(status || '') }), className)}>
      {children ?? status}
    </span>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center rounded-md bg-gray-bg px-2 py-0.5 text-xs font-medium text-gray', className)}>{children}</span>;
}
