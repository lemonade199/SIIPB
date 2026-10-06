import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

const BADGE: Record<string, string> = {
  TERSEDIA: 'b-ok',
  DIPINJAM: 'b-info',
  RUSAK: 'b-warn',
  RUSAK_BERAT: 'b-danger',
  DALAM_PERBAIKAN: 'b-purple',
  HILANG: 'b-danger',
  DRAF: 'b-gray',
  'JATUH TEMPO': 'b-warn',
  TERLAMBAT: 'b-late',
  DIKEMBALIKAN: 'b-gray',
  DIBATALKAN: 'b-gray',
  TERKIRIM: 'b-ok',
  GAGAL: 'b-danger',
  MENUNGGU: 'b-warn',
  DILEWATI: 'b-gray',
  SUKSES: 'b-ok',
  AKTIF: 'b-ok',
  NONAKTIF: 'b-gray',
  BAIK: 'b-ok',
  RUSAK_RINGAN: 'b-warn',
};

/** Badge status. `status` menentukan warna; `children` (opsional) mengganti label. */
export function Badge({ status, children, className }: { status: string; children?: ReactNode; className?: string }) {
  return <span className={cn('badge', BADGE[status] || 'b-gray', className)}>{children ?? status}</span>;
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('tag', className)}>{children}</span>;
}
