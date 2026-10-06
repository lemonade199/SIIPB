import type { IconName } from '@/components/ui/icon';
import type { PermissionKey } from '@/types';

export interface NavItem {
  label: string;
  href: string;
  icon: IconName;
  perm: PermissionKey;
  /** Prefix path untuk penanda menu aktif. */
  base: string;
  count?: 'late' | 'drafts';
}

export const NAV: { group: string; items: NavItem[] }[] = [
  {
    group: 'Utama',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: 'dashboard', perm: 'dashboard.view', base: '/dashboard' },
      { label: 'Inventaris', href: '/inventaris', icon: 'box', perm: 'inventory.view', base: '/inventaris' },
      { label: 'Peminjaman', href: '/peminjaman', icon: 'out', perm: 'borrowing.view', base: '/peminjaman', count: 'drafts' },
      { label: 'Pengembalian', href: '/pengembalian', icon: 'in', perm: 'borrowing.view', base: '/pengembalian' },
      { label: 'Monitoring', href: '/monitoring', icon: 'activity', perm: 'monitoring.view', base: '/monitoring', count: 'late' },
    ],
  },
  {
    group: 'Layanan',
    items: [
      { label: 'Notifikasi', href: '/notifikasi', icon: 'bell', perm: 'notification.view', base: '/notifikasi' },
      { label: 'QR / Barcode', href: '/qr', icon: 'qr', perm: 'inventory.view', base: '/qr' },
      { label: 'Laporan', href: '/laporan', icon: 'file', perm: 'report.view', base: '/laporan' },
      { label: 'Master Data', href: '/master/peminjam', icon: 'database', perm: 'masterdata.manage', base: '/master' },
    ],
  },
  {
    group: 'Administrasi',
    items: [
      { label: 'Pengguna & Role', href: '/pengguna', icon: 'users', perm: 'users.manage', base: '/pengguna' },
      { label: 'Audit Log', href: '/audit', icon: 'shield', perm: 'audit.view', base: '/audit' },
      { label: 'Pengaturan', href: '/pengaturan', icon: 'settings', perm: 'settings.manage', base: '/pengaturan' },
    ],
  },
];

/**
 * Izin per rute (RBAC di sisi antarmuka). Urutan penting: pola paling spesifik lebih dulu.
 * `null` = cukup login.
 */
const ROUTES: [RegExp, PermissionKey | null][] = [
  [/^\/dashboard$/, 'dashboard.view'],
  [/^\/inventaris\/baru$/, 'inventory.manage'],
  [/^\/inventaris\/[^/]+\/ubah$/, 'inventory.manage'],
  [/^\/inventaris(\/[^/]+)?$/, 'inventory.view'],
  [/^\/peminjaman\/baru$/, 'borrowing.manage'],
  [/^\/peminjaman\/[^/]+\/ubah$/, 'borrowing.manage'],
  [/^\/peminjaman(\/[^/]+)?$/, 'borrowing.view'],
  [/^\/pengembalian\/baru$/, 'return.manage'],
  [/^\/pengembalian(\/[^/]+)?$/, 'borrowing.view'],
  [/^\/monitoring$/, 'monitoring.view'],
  [/^\/notifikasi$/, 'notification.view'],
  [/^\/qr$/, 'inventory.view'],
  [/^\/laporan$/, 'report.view'],
  [/^\/master(\/[^/]+)?$/, 'masterdata.manage'],
  [/^\/pengguna$/, 'users.manage'],
  [/^\/audit$/, 'audit.view'],
  [/^\/pengaturan$/, 'settings.manage'],
  [/^\/profil$/, null],
];

/** Kembalikan izin yang dibutuhkan, `null` bila cukup login, atau `undefined` bila rute tidak dikenal. */
export function routePermission(pathname: string): PermissionKey | null | undefined {
  const p = pathname.replace(/\/+$/, '') || '/';
  const hit = ROUTES.find(([re]) => re.test(p));
  return hit ? hit[1] : undefined;
}

/** Halaman awal pertama yang boleh dibuka oleh pengguna. */
export function homeFor(can: (p: PermissionKey) => boolean) {
  for (const g of NAV) for (const it of g.items) if (can(it.perm)) return it.href;
  return '/profil';
}
