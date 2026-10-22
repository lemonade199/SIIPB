'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { db } from '@/lib/mock/db';
import { fmtDate, fmtDateTime } from '@/lib/date';
import { useTitle } from '@/hooks/use-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { KV, PageHead } from '@/components/ui/misc';
import { LateText } from '@/components/domain/borrow-status';
import { humanize, PrintDoc, PrintInfo, PrintSection, PrintSign } from '@/components/domain/print-doc';
import { NotFoundView } from '@/components/layout/app-shell';
import { emp, item as getItem, returnDetails, unit, userName } from '@/services/lookup';
import { TableWrap } from '@/components/ui/table-wrap';

export default function ReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const r = db.get('returns', id);
  useTitle(r?.code || 'Pengembalian');
  if (!r) return <NotFoundView text="Data pengembalian tidak ditemukan." />;
  const b = db.get('borrowings', r.borrowing_id)!;
  const e = emp(b.employee_id);
  const det = returnDetails(r);

  return (
    <>
      <PageHead
        crumb={
          <>
            <Link href="/pengembalian">Pengembalian</Link> / {r.code}
          </>
        }
        title={r.code}
        desc={
          <>
            Pengembalian untuk{' '}
            <Link className="mono" href={`/peminjaman/${b.id}`}>
              {b.code}
            </Link>
          </>
        }
        actions={
          <Button icon="printer" onClick={() => window.print()}>
            Cetak bukti
          </Button>
        }
      />
      <div className="split no-print">
        <div className="stack">
          <Card title="Hasil pemeriksaan" flush>
            <TableWrap>
              <table className="table">
                <thead>
                  <tr>
                    <th>Barang</th>
                    <th>Kondisi akhir</th>
                    <th>Kelengkapan</th>
                    <th>Keterangan</th>
                    <th>Status barang kini</th>
                  </tr>
                </thead>
                <tbody>
                  {det.map((d) => {
                    const it = getItem(d.item_id);
                    if (!it) return null;
                    return (
                      <tr key={d.id}>
                        <td>
                          <Link className="cell-title" href={`/inventaris/${it.id}`}>
                            {it.item_name}
                          </Link>
                          <div className="cell-sub mono">{it.item_code}</div>
                        </td>
                        <td>
                          <Badge status={d.condition_after} />
                        </td>
                        <td>
                          {d.complete ? (
                            <span className="text-ok">Lengkap</span>
                          ) : (
                            <>
                              <span className="text-warn">Tidak lengkap</span>
                              <div className="cell-sub">{d.missing_note}</div>
                            </>
                          )}
                        </td>
                        <td className="small">{d.damage_note || '—'}</td>
                        <td>
                          <Badge status={it.item_status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </Card>
        </div>
        <div className="stack">
          <Card title="Ringkasan">
            <KV
              one
              items={[
                ['Peminjam', e?.name],
                ['Unit kerja', unit(e?.unit_id)?.name],
                ['Tanggal pinjam', fmtDate(b.borrow_date)],
                ['Batas kembali', fmtDate(b.due_date)],
                ['Tanggal kembali', fmtDate(r.return_date, true)],
                ['Keterlambatan', <LateText key="l" days={r.late_days} />],
                ['Diterima oleh', userName(r.received_by)],
                ['Dicatat', fmtDateTime(r.created_at)],
                ['Catatan', r.notes],
              ]}
            />
          </Card>
        </div>
      </div>
      <PrintDoc title="Bukti Pengembalian Barang" number={r.code} subtitle={`Pengembalian atas peminjaman ${b.code}`}>
        <PrintSection title="Data pengembalian">
          <PrintInfo
            rows={[
              ['Peminjam', e?.name],
              ['NIP', e?.nip],
              ['Unit kerja', unit(e?.unit_id)?.name],
              ['Diterima oleh', userName(r.received_by)],
              ['Tanggal pinjam', fmtDate(b.borrow_date, true)],
              ['Batas kembali', fmtDate(b.due_date, true)],
              ['Tanggal kembali', fmtDate(r.return_date, true)],
              ['Keterlambatan', r.late_days > 0 ? `${r.late_days} hari` : 'Tepat waktu'],
              ['Catatan', r.notes],
            ]}
          />
        </PrintSection>
        <PrintSection title={`Hasil pemeriksaan barang (${det.length})`}>
          <table className="pd-table">
            <thead>
              <tr>
                <th className="num">No</th>
                <th>Kode</th>
                <th>Nama barang</th>
                <th>Kondisi akhir</th>
                <th>Kelengkapan</th>
                <th>Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {det.map((d, i) => {
                const it = getItem(d.item_id);
                return (
                  <tr key={d.id}>
                    <td className="num">{i + 1}</td>
                    <td className="code">{it?.item_code}</td>
                    <td>{it?.item_name}</td>
                    <td>{humanize(d.condition_after)}</td>
                    <td>{d.complete ? 'Lengkap' : `Tidak lengkap${d.missing_note ? ` (${d.missing_note})` : ''}`}</td>
                    <td>{d.damage_note || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </PrintSection>
        <PrintSign
          cols={[
            { role: 'Peminjam,', name: e?.name },
            { role: 'Petugas penerima,', name: userName(r.received_by) },
          ]}
        />
      </PrintDoc>
    </>
  );
}
