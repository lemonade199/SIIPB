'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';
import { Photo } from '@/components/ui/misc';

/** Galeri foto barang (item_photos): foto utama + thumbnail yang dapat dipilih. */
export function PhotoGallery({ photos, alt }: { photos: string[]; alt: string }) {
  const [idx, setIdx] = useState(0);
  const current = photos[Math.min(idx, photos.length - 1)] ?? null;
  return (
    <div className="stack" style={{ gap: 8 }}>
      <Photo src={current} alt={alt} />
      {photos.length > 1 && (
        <div className="flex flex-wrap gap-1.5" role="list" aria-label="Foto lain">
          {photos.map((src, i) => (
            <button
              key={i}
              type="button"
              role="listitem"
              onClick={() => setIdx(i)}
              aria-label={`Lihat foto ${i + 1}`}
              aria-current={i === idx}
              className={cn('size-12 overflow-hidden rounded-md border-2 bg-muted', i === idx ? 'border-primary' : 'border-transparent')}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
      <span className="small muted">
        <Icon name="image" size={13} className="inline align-[-2px]" /> {photos.length ? `${photos.length} foto` : 'Belum ada foto'}
      </span>
    </div>
  );
}

/** Editor foto untuk form barang: tambah banyak foto, hapus, dan jadikan foto utama. */
export function PhotoEditor({ photos, onChange, max }: { photos: string[]; onChange: (p: string[]) => void; max: number }) {
  return (
    <div className="grid grid-cols-3 gap-2" role="list" aria-label="Foto barang">
      {photos.map((src, i) => (
        <div key={i} role="listitem" className={cn('group relative aspect-square overflow-hidden rounded-lg border bg-muted', i === 0 ? 'border-primary border-2' : 'border-border')}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`Foto ${i + 1}`} className="size-full object-cover" />
          {i === 0 && <span className="absolute left-1 top-1 rounded bg-primary px-1.5 text-[10.5px] font-semibold text-white">Utama</span>}
          <div className="absolute inset-x-1 bottom-1 flex justify-end gap-1">
            {i > 0 && (
              <button
                type="button"
                title="Jadikan foto utama"
                aria-label={`Jadikan foto ${i + 1} sebagai utama`}
                className="grid size-6 place-items-center rounded bg-white/90 text-foreground shadow"
                onClick={() => onChange([src, ...photos.filter((_, j) => j !== i)])}
              >
                <Icon name="check" size={13} />
              </button>
            )}
            <button
              type="button"
              title="Hapus foto"
              aria-label={`Hapus foto ${i + 1}`}
              className="grid size-6 place-items-center rounded bg-white/90 text-danger shadow"
              onClick={() => onChange(photos.filter((_, j) => j !== i))}
            >
              <Icon name="trash" size={13} />
            </button>
          </div>
        </div>
      ))}
      {photos.length === 0 && (
        <div className="col-span-3">
          <Photo src={null} alt="Belum ada foto" />
        </div>
      )}
      {photos.length > 0 && photos.length < max && <div className="grid aspect-square place-items-center rounded-lg border border-dashed border-input text-xs text-subtle">+ foto</div>}
    </div>
  );
}
