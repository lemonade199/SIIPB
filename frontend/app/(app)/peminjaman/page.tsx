'use client';

import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { db } from '@/lib/mock/db';
import { fmtDate } from '@/lib/date';
import { match, paginate } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { patchFilter, usePersistentState } from '@/hooks/use-persistent-state';
import { useTitle } from '@/hooks/use-title';
import { Button } from '@/components/ui/button';
import { Select, toOptions } from '@/components/ui/form';
import { Empty, PageHead, Pager, SearchInput, Tabs } from '@/components/ui/misc';
import { BorrowBadge, DueText } from '@/components/domain/borrow-status';
import { borrowView, emp, isActive, itemsOf, unit, userName } from '@/services/lookup';
import type { Borrowing } from '@/types';
import { TableWrap } from '@/components/ui/table-wrap';

type TabKey = 'semua' | 'DRAF' | 'aktif' | 'JATUH TEMPO' | 'TERLAMBAT' | 'DIKEMBALIKAN' | 'DIBATALKAN';
const TABS: [TabKey, string][] = [
  ['semua', 'Semua'],
  ['DRAF', 'Draf'],
  ['aktif', 'Aktif'],
  ['JATUH TEMPO', 'Jatuh tempo'],
  ['TERLAMBAT', 'Terlambat'],
  ['DIKEMBALIKAN', 'Dikembalikan'],
  ['DIBATALKAN', 'Dibatalkan'],
];

function tabMatch(b: Borrowing, tab: TabKey) {
  if (tab === 'semua') return true;
  if (tab === 'aktif') return isActive(b);
  return borrowView(b).display === tab || b.status === tab;
}

interface Filter {
  tab: TabKey;
  q: string;
  unit: string;
  from: string;
  to: string;
  page: number;
}

export default function PeminjamanPage() {
  useTitle('Peminjaman');
  const { can } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [f, setF] = usePersistentState<Filter>('pj.filter', { tab: 'semua', q: '', unit: '', from: '', to: '', page: 1 });
  const set = patchFilter(setF);

  useEffect(() => {
    const tab = params.get('tab') as TabKey | null;
    if (tab) setF((p) => ({ ...p, tab, page: 1 }));
  }, [params, setF]);

  const all = db.all('borrowings');
  const rows = all
    .filter((b) => {
      const e = emp(b.employee_id);
      return (
        tabMatch(b, f.tab) &&
        (!f.unit || e?.unit_id === Number(f.unit)) &&
        (!f.from || b.borrow_date >= f.from) &&
        (!f.to || b.borrow_date <= f.to) &&
        match(f.q, b.code, e?.name, e?.nip, b.purpose, ...itemsOf(b).map((i) => i.item_code + ' ' + i.item_name))
      );
    })
    .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const p = paginate(rows, f.page, 10);

  return (
    <>
      <PageHead
        crumb="Beranda / Peminjaman"
        title="Peminjaman"
        desc="Seluruh transaksi peminjaman dicatat oleh petugas. Peminjam hanya menerima notifikasi email."
        actions={
          can('borrowing.manage') && (
            <Button variant="primary" icon="plus" href="/peminjaman/baru">
              Catat Peminjaman
            </Button>
          )
        }
      />
      <section className="card">
        <Tabs label="Status transaksi" value={f.tab} onChange={(k) => set('tab', k)} tabs={TABS.map(([k, l]) => ({ key: k, label: l, count: all.filter((b) => tabMatch(b, k)).length }))} />
        <div className="toolbar">
          <SearchInput value={f.q} onChange={(v) => set('q', v)} placeholder="Cari kode, peminjam, NIP, barang…" label="Cari transaksi" />
          <Select aria-label="Unit kerja" value={f.unit} onChange={(e) => set('unit', e.target.value)} options={toOptions(db.all('units'), 'Semua unit kerja')} />
          <label className="small muted" htmlFor="pj-from">
            Dari
          </label>
          <Input type="date" id="pj-from" value={f.from} onChange={(e) => set('from', e.target.value)} />
          <label className="small muted" htmlFor="pj-to">
            s.d.
          </label>
          <Input type="date" id="pj-to" value={f.to} onChange={(e) => set('to', e.target.value)} />
        </div>
        <TableWrap>
          <table className="table">
            <thead>
              <tr>
                <th>Kode</th>
                <th>Peminjam</th>
                <th>Barang</th>
                <th>Pinjam</th>
                <th>Batas kembali</th>
                <th>Status</th>
                <th>Petugas</th>
              </tr>
            </thead>
            <tbody>
              {p.rows.length ? (
                p.rows.map((b) => {
                  const e = emp(b.employee_id);
                  const items = itemsOf(b);
                  return (
                    <tr key={b.id} className="clickable" onClick={(ev) => !(ev.target as HTMLElement).closest('a') && router.push(`/peminjaman/${b.id}`)}>
                      <td>
                        <Link className="mono strong" href={`/peminjaman/${b.id}`}>
                          {b.code}
                        </Link>
                      </td>
                      <td>
                        <div className="cell-title">{e?.name}</div>
                        <div className="cell-sub">{unit(e?.unit_id)?.name}</div>
                      </td>
                      <td>
                        <div>{items[0]?.item_name ?? '—'}</div>
                        <div className="cell-sub">{items.length > 1 ? `+${items.length - 1} barang lain` : items[0]?.item_code}</div>
                      </td>
                      <td className="nowrap">{fmtDate(b.borrow_date)}</td>
                      <td className="nowrap">{fmtDate(b.due_date)}</td>
                      <td className="nowrap">
                        <BorrowBadge b={b} />
                        <div className="cell-sub">
                          <DueText b={b} />
                        </div>
                      </td>
                      <td className="small">{userName(b.checked_out_by || b.created_by)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7}>
                    <Empty icon="out">Tidak ada transaksi.</Empty>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableWrap>
        <Pager page={p} label="transaksi" onPage={(n) => set('page', n)} />
      </section>
    </>
  );
}
