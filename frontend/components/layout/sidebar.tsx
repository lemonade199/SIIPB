'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { db } from '@/lib/mock/db';
import { relDue } from '@/lib/date';
import { NAV } from '@/lib/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { Icon } from '@/components/ui/icon';
import { Avatar } from '@/components/ui/misc';
import { useConfirm } from '@/components/providers/feedback-provider';
import { logout } from '@/services/repo';
import { activeBorrowings } from '@/services/lookup';

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, role, can } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const confirm = useConfirm();
  if (!user) return null;

  const late = activeBorrowings().filter((b) => relDue(b.due_date).n < 0).length;
  const drafts = db.where('borrowings', (b) => b.status === 'DRAF').length;

  const onLogout = async () => {
    if (await confirm({ title: 'Keluar dari SIIPB?', message: 'Sesi (token JWT) Anda akan diakhiri.', confirmText: 'Keluar' })) {
      await logout();
      router.replace('/login');
    }
  };

  return (
    <aside className="sidebar" aria-label="Navigasi utama">
      <div className="brand">
        <span className="brand-logo">
          <Icon name="box" size={20} />
        </span>
        <div>
          <div className="brand-name">SIIPB</div>
          <div className="brand-sub">{db.data.settings.institution}</div>
        </div>
      </div>
      <nav className="nav">
        {NAV.map(({ group, items }) => {
          const visible = items.filter((it) => can(it.perm));
          if (!visible.length) return null;
          return (
            <div key={group} style={{ display: 'contents' }}>
              <div className="nav-group">{group}</div>
              {visible.map((it) => {
                const active = pathname === it.base || pathname.startsWith(it.base + '/');
                return (
                  <Link key={it.href} href={it.href} className={cn(active && 'active')} aria-current={active ? 'page' : undefined} onClick={onNavigate}>
                    <Icon name={it.icon} />
                    <span>{it.label}</span>
                    {it.count === 'late' && late > 0 && (
                      <span className="count" title={`${late} transaksi terlambat`}>
                        {late}
                      </span>
                    )}
                    {it.count === 'drafts' && drafts > 0 && (
                      <span className="count" style={{ background: '#c8d9e6', color: '#2f4156' }} title={`${drafts} draf belum diserahkan`}>
                        {drafts}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className="sidebar-foot">
        <Avatar name={user.name} dark />
        <Link className="who" href="/profil" style={{ textDecoration: 'none' }} onClick={onNavigate}>
          <b>{user.name}</b>
          <span>{role?.name}</span>
        </Link>
        <button type="button" title="Keluar" aria-label="Keluar" onClick={onLogout}>
          <Icon name="logout" />
        </button>
      </div>
    </aside>
  );
}
