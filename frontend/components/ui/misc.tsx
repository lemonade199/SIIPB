'use client';

import type { CSSProperties, ReactNode } from 'react';
import { cn, initials, type Page } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import type { Item } from '@/types';

/* ---------- Alert ---------- */
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

/* ---------- Empty state ---------- */
export function Empty({ icon = 'search', children, className }: { icon?: IconName; children: ReactNode; className?: string }) {
  return (
    <div className={cn('empty', className)}>
      <Icon name={icon} size={30} className="mx-auto" />
      <div>{children}</div>
    </div>
  );
}

/* ---------- Key/value ---------- */
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

/* ---------- Avatar & thumbnail ---------- */
export function Avatar({ name, dark }: { name?: string | null; dark?: boolean }) {
  return (
    <span className={cn('avatar', dark && 'dark')} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Thumb({ item }: { item?: Item | null }) {
  return (
    <span className="thumb">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {item?.photos?.[0] ? <img src={item.photos[0]} alt="" /> : <Icon name="image" />}
    </span>
  );
}

export function Photo({ src, alt, style }: { src?: string | null; alt: string; style?: CSSProperties }) {
  return (
    <div className="photo" style={style}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={alt} />
      ) : (
        <div className="center small">
          <Icon name="image" size={30} className="mx-auto" />
          Belum ada foto
        </div>
      )}
    </div>
  );
}

/* ---------- Pagination ---------- */
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

/* ---------- Tabs (shadcn/Radix) ---------- */
export { Tabs, type TabDef } from '@/components/ui/tabs';

/* ---------- Toolbar search ---------- */
export function SearchInput({ value, onChange, placeholder, label, autoFocus }: { value: string; onChange: (v: string) => void; placeholder: string; label?: string; autoFocus?: boolean }) {
  return (
    <div className="grow">
      <Icon name="search" size={16} />
      <Input className="pl-[34px]" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label || placeholder} autoFocus={autoFocus} />
    </div>
  );
}

/* ---------- Page header ---------- */
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
