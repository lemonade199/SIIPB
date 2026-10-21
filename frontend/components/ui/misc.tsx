'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import { cn, initials, type Page } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import type { Item } from '@/types';

export type AlertType = 'info' | 'warn' | 'danger' | 'ok';
const ALERT_ICON: Record<AlertType, IconName> = { info: 'info', warn: 'alert', danger: 'alert', ok: 'checkCircle' };
export function Alert({ type = 'info', icon, children, className }: { type?: AlertType; icon?: IconName; children: ReactNode; className?: string }) {
  return (
    <div data-slot="alert" className={cn('alert', `alert-${type}`, className)} role={type === 'danger' ? 'alert' : undefined}>
      <Icon name={icon || ALERT_ICON[type]} />
      <div>{children}</div>
    </div>
  );
}

export function Empty({ icon = 'search', children, className }: { icon?: IconName; children: ReactNode; className?: string }) {
  return (
    <div className={cn('empty', className)}>
      <Icon name={icon} size={30} className="mx-auto" />
      <div>{children}</div>
    </div>
  );
}

export function KV({ items, one }: { items: [string, ReactNode][]; one?: boolean }) {
  return (
    <dl className={cn('kv', one && 'one')}>
      {items.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v === '' || v === null || v === undefined ? '—' : v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Avatar({ name, dark }: { name?: string | null; dark?: boolean }) {
  return (
    <span className={cn('avatar', dark && 'dark')} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

/** Foto yang gagal dimuat (berkas hilang di server) diganti placeholder, bukan ikon gambar rusak. */
function useBroken(src?: string | null) {
  const [broken, setBroken] = useState<string | null>(null);
  return { ok: !!src && broken !== src, onError: () => setBroken(src ?? null), missing: !!src && broken === src };
}

export function Thumb({ item }: { item?: Item | null }) {
  const src = item?.photos?.[0];
  const img = useBroken(src);
  return (
    <span className="thumb">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {img.ok ? <img src={src} alt="" onError={img.onError} /> : <Icon name="image" />}
    </span>
  );
}

export function Photo({ src, alt, style }: { src?: string | null; alt: string; style?: CSSProperties }) {
  const img = useBroken(src);
  return (
    <div className="photo" style={style}>
      {img.ok ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src!} alt={alt} onError={img.onError} />
      ) : (
        <div className="center small">
          <Icon name="image" size={30} className="mx-auto" />
          {img.missing ? 'Foto tidak ditemukan' : 'Belum ada foto'}
        </div>
      )}
    </div>
  );
}

export function Pager<T>({ page, label = 'data', onPage }: { page: Page<T>; label?: string; onPage: (p: number) => void }) {
  return (
    <div className="pager">
      <span>
        Menampilkan {page.from}–{page.to} dari {page.total} {label}
      </span>
      <div className="actions">
        <Button size="sm" icon="chevLeft" disabled={page.page <= 1} onClick={() => onPage(page.page - 1)}>
          Sebelumnya
        </Button>
        <span className="small">
          Hal. {page.page} / {page.pages}
        </span>
        <Button size="sm" disabled={page.page >= page.pages} onClick={() => onPage(page.page + 1)}>
          Berikutnya
        </Button>
      </div>
    </div>
  );
}

export { Tabs, type TabDef } from '@/components/ui/tabs';

export function SearchInput({ value, onChange, placeholder, label, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; label?: string; autoFocus?: boolean }) {
  return (
    <div className="grow">
      <Icon name="search" size={16} />
      <Input className="pl-[34px]" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label || placeholder} autoFocus={autoFocus} />
    </div>
  );
}

export function PageHead({ title, desc, actions, crumb, className }: { title: ReactNode; desc?: ReactNode; actions?: ReactNode; crumb?: ReactNode; className?: string }) {
  return (
    <div className={cn('page-head', className)}>
      <div>
        {crumb && <div className="crumb">{crumb}</div>}
        <h1>{title}</h1>
        {desc && <p>{desc}</p>}
      </div>
      {actions && <div className="actions no-print">{actions}</div>}
    </div>
  );
}

export function Spinner({ label = 'Memuat…' }: { label?: string }) {
  return (
    <div className="boot" role="status">
      <div style={{ display: 'grid', placeItems: 'center', gap: 10 }}>
        <span className="spinner" />
        <span className="small">{label}</span>
      </div>
    </div>
  );
}
