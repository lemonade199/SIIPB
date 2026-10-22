'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { db } from '@/lib/mock/db';
import { fmtDate, fmtDateTime, offsetDays, today } from '@/lib/date';
import { EVENT_LABEL } from '@/lib/constants';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { Button, buttonClass } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { StatIcon } from '@/components/ui/card';
import { inbox } from '@/services/notification';
import * as repo from '@/services/repo';
import { emp } from '@/services/lookup';

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!bellRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [open]);

  if (!user) return null;
  const list = inbox(user);
  const unread = list.filter((n) => !n.read_by.includes(user.id)).length;
  const off = offsetDays();

  return (
    <header className="topbar">
      <Button variant="ghost" iconOnly icon="menu" className="menu-btn min-[901px]:hidden" title="Buka menu" onClick={onMenu} />
      <span className="spacer" />
      <span className={cn('date-chip', off && 'demo')} title={off ? `Mode demo: tanggal sistem digeser ${off} hari` : 'Tanggal sistem'}>
        <Icon name="calendar" size={15} />
        <span className="long">{fmtDate(today(), true)}</span>
        {off !== 0 && <span>· demo {off > 0 ? '+' : ''}{off} hr</span>}
      </span>
      <div className="bell" ref={bellRef}>
        <button type="button" className={buttonClass({ variant: 'ghost', iconOnly: true, className: 'relative' })} aria-label={`Notifikasi (${unread} belum dibaca)`} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <Icon name="bell" size={20} />
          {unread > 0 && <span className="dot">{unread}</span>}
        </button>
        {open && (
          <div className="dropdown">
            <div className="dropdown-head">
              <b>Notifikasi untuk Anda</b>
              <button type="button" className="link-btn" onClick={() => void repo.markAllRead(user)}>
                Tandai semua dibaca
              </button>
            </div>
            <div className="dropdown-list">
              {list.length ? (
                list.slice(0, 12).map((n) => {
                  const b = db.get('borrowings', n.borrowing_id);
                  const isUnread = !n.read_by.includes(user.id);
                  const go = () => {
                    void repo.markRead(n.id, user.id);
                    setOpen(false);
                    router.push(b ? `/peminjaman/${b.id}` : '/notifikasi');
                  };
                  return (
                    <div key={n.id} className={cn('dropdown-item', isUnread && 'unread')} role="button" tabIndex={0} onClick={go} onKeyDown={(e) => e.key === 'Enter' && go()}>
                      <StatIcon icon={n.status === 'GAGAL' ? 'alert' : 'clock'} tone={n.status === 'GAGAL' ? 'danger' : 'late'} size={16} />
                      <div style={{ minWidth: 0 }}>
                        <div className="strong" style={{ fontSize: 13 }}>
                          {EVENT_LABEL[n.event] || n.event} · <span className="mono">{b?.code}</span>
                        </div>
                        <div className="small muted">
                          {b ? emp(b.employee_id)?.name : ''} — {n.status === 'GAGAL' ? 'pengiriman email gagal' : 'email terkirim'}
                        </div>
                        <div className="small subtle">{fmtDateTime(n.created_at)}</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty small">Belum ada eskalasi untuk Anda.</div>
              )}
            </div>
            <div className="dropdown-head" style={{ borderTop: '1px solid var(--border)', borderBottom: 0 }}>
              <Link href="/notifikasi" className="small strong" onClick={() => setOpen(false)}>
                Lihat riwayat notifikasi
              </Link>
              <span className="small muted">Eskalasi H+3 / H+7</span>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
