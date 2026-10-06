'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { routePermission } from '@/lib/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Card } from '@/components/ui/card';
import { Empty, PageHead, Spinner } from '@/components/ui/misc';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

export function Forbidden() {
  return (
    <>
      <PageHead title="Akses ditolak" />
      <Card>
        <Empty icon="lock">Peran Anda tidak memiliki izin untuk membuka halaman ini (HTTP 403). Hubungi administrator bila memerlukan akses.</Empty>
      </Card>
    </>
  );
}

export function NotFoundView({ text = 'Alamat yang Anda buka tidak tersedia (404).' }: { text?: string }) {
  return (
    <>
      <PageHead title="Halaman tidak ditemukan" />
      <Card>
        <Empty icon="search">{text}</Empty>
      </Card>
    </>
  );
}

/** Kerangka aplikasi terautentikasi: sidebar, topbar, dan RBAC per rute. */
export function AppShell({ children }: { children: ReactNode }) {
  const { user, can } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!user) router.replace('/login');
  }, [user, router]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  if (!user) return <Spinner label="Mengalihkan ke halaman masuk…" />;

  const perm = routePermission(pathname);
  const allowed = perm === undefined || perm === null || can(perm);

  return (
    <div
      className={cn('app', navOpen && 'nav-open')}
      onClick={(e) => {
        const t = e.target as HTMLElement;
        if (navOpen && !t.closest('.sidebar') && !t.closest('.menu-btn')) setNavOpen(false);
      }}
    >
      <Sidebar onNavigate={() => setNavOpen(false)} />
      <div className="main">
        <Topbar onMenu={() => setNavOpen((o) => !o)} />
        <main className="content" id="view" tabIndex={-1}>
          {allowed ? children : <Forbidden />}
        </main>
      </div>
    </div>
  );
}
