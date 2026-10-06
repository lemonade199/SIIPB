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
import { NotFoundView } from '@/components/layout/app-shell';
import { emp, item as getItem, returnDetails, unit, userName } from '@/services/lookup';

export default function ReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const r = db.get('returns', id);
  useTitle(r?.code || 'Pengembalian');
  if (!r) return <NotFoundView text="Data pengembalian tidak ditemukan." />;
  const b = db.get('borrowings', r.borrowing_id)!;
  const e = emp(b.employee_id);
  const det = returnDetails(r);
  const s = db.data.settings;

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
      <div className="print-only report-head">
        <h2>BUKTI PENGEMBALIAN BARANG</h2>
        <div>
          {s.institution} — {s.unit_sarpras}
        </div>
      </div>
      <div className="split">
        <div className="stack">
          <Card title="Hasil pemeriksaan" flush>
            <div className="table-wrap">
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
            </div>
          </Card>
          <div className="print-only" style={{ marginTop: 40 }}>
            <table style={{ width: '100%', textAlign: 'center' }}>
              <tbody>
                <tr>
                  <td>
                    Peminjam,
                    <br />
                    <br />
                    <br />
                    <br />
                    {e?.name}
                  </td>
                  <td>
                    Petugas penerima,
                    <br />
                    <br />
                    <br />
                    <br />
                    {userName(r.received_by)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
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
    </>
  );
}
