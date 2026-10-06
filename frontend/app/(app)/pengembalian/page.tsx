'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/mock/db';
import { fmtDate } from '@/lib/date';
import { match, paginate } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { patchFilter, usePersistentState } from '@/hooks/use-persistent-state';
import { useTitle } from '@/hooks/use-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Empty, PageHead, Pager, SearchInput } from '@/components/ui/misc';
import { BorrowBadge, DueText, LateText } from '@/components/domain/borrow-status';
import { activeBorrowings, emp, itemsOf, returnDetails, userName } from '@/services/lookup';

export default function PengembalianPage() {
  useTitle('Pengembalian');
  const { can } = useAuth();
  const router = useRouter();
  const [f, setF] = usePersistentState('rt.filter', { q: '', page: 1 });
  const set = patchFilter(setF);
  const canR = can('return.manage');

  const active = activeBorrowings().sort((a, b) => a.due_date.localeCompare(b.due_date));
  const rows = db
    .all('returns')
    .filter((r) => {
      const b = db.get('borrowings', r.borrowing_id)!;
      const e = emp(b.employee_id);
      return match(f.q, r.code, b.code, e?.name, ...itemsOf(b).map((i) => i.item_code + ' ' + i.item_name));
    })
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const p = paginate(rows, f.page, 10);

  return (
    <>
      <PageHead
        crumb="Beranda / Pengembalian"
        title="Pengembalian"
        desc="Petugas mencatat barang yang kembali, memeriksa kondisi dan kelengkapan, lalu sistem memperbarui status barang."
        actions={
          canR && (
            <Button variant="primary" icon="in" href="/pengembalian/baru">
              Catat Pengembalian
            </Button>
          )
        }
      />
      <div className="stack">
        <Card title={`Menunggu pengembalian (${active.length})`} flush>
          {active.length ? (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Transaksi</th>
                    <th>Peminjam</th>
                    <th>Barang</th>
                    <th>Batas</th>
                    <th>Sisa waktu</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {active.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <Link className="mono strong" href={`/peminjaman/${b.id}`}>
                          {b.code}
                        </Link>
                      </td>
                      <td>{emp(b.employee_id)?.name}</td>
                      <td className="small">
                        {itemsOf(b)
                          .map((i) => i.item_name)
                          .join(', ')}
                      </td>
                      <td className="nowrap">{fmtDate(b.due_date)}</td>
                      <td className="small nowrap">
                        <DueText b={b} />
                      </td>
                      <td>
                        <BorrowBadge b={b} />
                      </td>
                      <td className="right">
                        {canR && (
                          <Button size="sm" icon="in" href={`/pengembalian/baru?pinjam=${b.id}`}>
                            Kembalikan
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon="checkCircle">Tidak ada transaksi aktif.</Empty>
          )}
        </Card>

        <section className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Riwayat pengembalian</div>
              <div className="card-desc">Riwayat peminjaman tidak dihapus setelah barang kembali</div>
            </div>
          </div>
          <div className="toolbar" style={{ marginTop: 12, borderTop: '1px solid var(--border)' }}>
            <SearchInput value={f.q} onChange={(v) => set('q', v)} placeholder="Cari kode, peminjam, barang…" label="Cari pengembalian" />
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Transaksi</th>
                  <th>Peminjam</th>
                  <th>Tgl kembali</th>
                  <th>Keterlambatan</th>
                  <th>Kondisi akhir</th>
                  <th>Diterima oleh</th>
                </tr>
              </thead>
              <tbody>
                {p.rows.length ? (
                  p.rows.map((r) => {
                    const b = db.get('borrowings', r.borrowing_id)!;
                    const det = returnDetails(r);
                    return (
                      <tr key={r.id} className="clickable" onClick={(ev) => !(ev.target as HTMLElement).closest('a') && router.push(`/pengembalian/${r.id}`)}>
                        <td>
                          <Link className="mono strong" href={`/pengembalian/${r.id}`}>
                            {r.code}
                          </Link>
                        </td>
                        <td>
                          <Link className="mono" href={`/peminjaman/${b.id}`}>
                            {b.code}
                          </Link>
                        </td>
                        <td>
                          <div className="cell-title">{emp(b.employee_id)?.name}</div>
                          <div className="cell-sub">{det.length} barang</div>
                        </td>
                        <td className="nowrap">{fmtDate(r.return_date)}</td>
                        <td>
                          <LateText days={r.late_days} />
                        </td>
                        <td>
                          {det.map((d) => (
                            <Badge key={d.id} status={d.condition_after} className="mr-1" />
                          ))}
                        </td>
                        <td className="small">{userName(r.received_by)}</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7}>
                      <Empty icon="in">Belum ada pengembalian.</Empty>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager page={p} label="pengembalian" onPage={(n) => set('page', n)} />
        </section>
      </div>
    </>
  );
}
