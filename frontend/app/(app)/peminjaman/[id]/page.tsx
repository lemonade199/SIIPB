'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { isApiMode } from '@/lib/config';
import { db } from '@/lib/mock/db';
import { addDays, fmtDate, fmtDateTime, today } from '@/lib/date';
import { EVENT_LABEL } from '@/lib/constants';
import { useAuth } from '@/hooks/use-auth';
import { useTitle } from '@/hooks/use-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Alert, Avatar, Empty, KV, PageHead, Thumb } from '@/components/ui/misc';
import { BorrowBadge, DueText } from '@/components/domain/borrow-status';
import { EmailPreview } from '@/components/domain/email-preview';
import { NotFoundView } from '@/components/layout/app-shell';
import { useConfirm, useToast } from '@/components/providers/feedback-provider';
import { cancelBorrowing, checkout } from '@/services/borrowing';
import { borrowView, detailsOf, emp, isActive, item as getItem, itemsOf, returnOf, unit, user as getUser, userName, conditionLabel } from '@/services/lookup';
import type { ID } from '@/types';

export default function BorrowDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [emailId, setEmailId] = useState<ID | null>(null);
  const b = db.get('borrowings', id);
  useTitle(b?.code || 'Detail peminjaman');
  if (!b) return <NotFoundView text="Transaksi tidak ditemukan." />;

  const e = emp(b.employee_id);
  const v = borrowView(b);
  const ret = returnOf(b);
  const details = detailsOf(b);
  const notifs = db.where('notifications', (n) => n.borrowing_id === b.id).sort((a, c) => a.created_at.localeCompare(c.created_at));
  const logs = db.where('activity_logs', (a) => (a.entity === 'borrowings' && a.entity_id === b.id) || (a.entity === 'returns' && !!ret && a.entity_id === ret.id));
  const canB = can('borrowing.manage');
  const canR = can('return.manage');
  const s = db.data.settings;
  const officer = getUser(b.checked_out_by || b.created_by);

  const onCheckout = async () => {
    const items = itemsOf(b);
    const ok = await confirm({
      title: 'Serahkan barang?',
      message: `${items.length} barang akan diserahkan kepada ${e?.name}. Status barang menjadi DIPINJAM dan email konfirmasi dikirim.`,
      confirmText: 'Checkout',
    });
    if (!ok) return;
    const r = checkout(b.id);
    if (!r.ok) return toast(r.error, 'err');
    toast(`${b.code} diserahkan. Email dikirim ke peminjam.`);
  };
  const onCancel = async () => {
    const reason = await confirm({ title: 'Batalkan draf?', message: 'Draf dibatalkan dan tetap tersimpan sebagai riwayat.', input: 'Alasan pembatalan', confirmText: 'Batalkan draf', danger: true });
    if (!reason) return;
    cancelBorrowing(b.id, String(reason).trim());
    toast('Draf dibatalkan.');
  };

  return (
    <>
      <PageHead
        crumb={
          <>
            <Link href="/peminjaman">Peminjaman</Link> / {b.code}
          </>
        }
        title={b.code}
        desc={`Dicatat ${fmtDateTime(b.created_at)} oleh ${userName(b.created_by)}`}
        actions={
          <>
            {b.status === 'DRAF' && canB && (
              <>
                <Button variant="primary" icon="check" onClick={onCheckout}>
                  Checkout / Serahkan
                </Button>
                <Button icon="pencil" href={`/peminjaman/${b.id}/ubah`}>
                  Ubah
                </Button>
                <Button variant="danger" icon="x" onClick={onCancel}>
                  Batalkan
                </Button>
              </>
            )}
            {isActive(b) && canR && (
              <Button variant="primary" icon="in" href={`/pengembalian/baru?pinjam=${b.id}`}>
                Catat Pengembalian
              </Button>
            )}
            {b.status !== 'DRAF' && b.status !== 'DIBATALKAN' && (
              <Button icon="printer" onClick={() => window.print()}>
                Cetak bukti
              </Button>
            )}
          </>
        }
      />
      <div className="print-only report-head">
        <h2>BUKTI PEMINJAMAN BARANG</h2>
        <div>
          {s.institution} — {s.unit_sarpras}
        </div>
      </div>
      {b.status === 'DRAF' && (
        <Alert type="warn" className="mb-4 no-print">
          Transaksi masih <b>DRAF</b>: barang belum diserahkan, status barang belum berubah, dan notifikasi belum dikirim. Tekan <b>Checkout / Serahkan</b> saat barang diberikan kepada peminjam.
        </Alert>
      )}
      {b.status === 'DIBATALKAN' && (
        <Alert type="info" className="mb-4">
          Draf ini dibatalkan{b.cancel_reason ? <> dengan alasan: <i>{b.cancel_reason}</i></> : ''}.
        </Alert>
      )}
      {v.display === 'TERLAMBAT' && (
        <Alert type="danger" className="mb-4 no-print">
          Transaksi ini <b>terlambat {v.lateDays} hari</b> dari batas {fmtDate(b.due_date, true)}.
        </Alert>
      )}

      <div className="split">
        <div className="stack">
          <Card title="Informasi transaksi">
            <KV
              items={[
                ['Status', <BorrowBadge key="s" b={b} />],
                ['Sisa waktu', <DueText key="d" b={b} />],
                ['Tanggal pinjam', fmtDate(b.borrow_date, true)],
                ['Batas pengembalian', fmtDate(b.due_date, true)],
                ['Diserahkan', b.checked_out_at ? `${fmtDateTime(b.checked_out_at)} · ${userName(b.checked_out_by)}` : '—'],
                [
                  'Dikembalikan',
                  b.returned_at ? (
                    <>
                      {fmtDateTime(b.returned_at)}
                      {ret && (
                        <>
                          {' · '}
                          <Link className="mono" href={`/pengembalian/${ret.id}`}>
                            {ret.code}
                          </Link>
                        </>
                      )}
                    </>
                  ) : (
                    '—'
                  ),
                ],
                ['Tujuan', b.purpose],
                ['Catatan petugas', b.notes],
              ]}
            />
          </Card>

          <Card title={`Barang (${details.length})`} flush>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Barang</th>
                    <th>Kondisi diserahkan</th>
                    <th>Kondisi kembali</th>
                    <th>Status barang kini</th>
                  </tr>
                </thead>
                <tbody>
                  {details.map((d) => {
                    const it = getItem(d.item_id);
                    if (!it) return null;
                    const rd = ret ? db.find('return_details', (x) => x.return_id === ret.id && x.item_id === it.id) : null;
                    return (
                      <tr key={d.id}>
                        <td>
                          <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
                            <Thumb item={it} />
                            <div>
                              <Link className="cell-title" href={`/inventaris/${it.id}`}>
                                {it.item_name}
                              </Link>
                              <div className="cell-sub mono">{it.item_code}</div>
                            </div>
                          </div>
                        </td>
                        <td>{conditionLabel(d.item_condition_out)}</td>
                        <td>
                          {rd ? (
                            <>
                              <Badge status={rd.condition_after} />
                              {!rd.complete && <span className="small text-warn"> tidak lengkap</span>}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
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
                    Petugas Sarpras/IT,
                    <br />
                    <br />
                    <br />
                    <br />
                    {officer?.name}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <Card title="Riwayat notifikasi" desc="notifications & notification_logs" className="no-print">
            {notifs.length ? (
              <ul className="timeline">
                {notifs.map((n) => (
                  <li key={n.id}>
                    <div className="t-time">
                      {fmtDateTime(n.created_at)} · {n.trigger === 'scheduler' ? 'Celery Beat' : 'transaksi'}
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <b>{EVENT_LABEL[n.event] || n.event}</b>
                      <Badge status={n.status} />
                    </div>
                    <div className="small muted">Ke: {n.recipients.map((r) => `${r.name} (${r.type})`).join(', ')}</div>
                    <button type="button" className="link-btn" onClick={() => setEmailId(n.id)}>
                      Lihat email
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty icon="mail">Belum ada notifikasi.</Empty>
            )}
          </Card>
        </div>

        <div className="stack">
          <Card title="Peminjam">
            <div className="row" style={{ flexWrap: 'nowrap', marginBottom: 8 }}>
              <Avatar name={e?.name} />
              <div>
                <b>{e?.name}</b>
                <div className="cell-sub">NIP {e?.nip}</div>
              </div>
            </div>
            <KV
              one
              items={[
                ['Unit kerja', unit(e?.unit_id)?.name],
                ['Email notifikasi', e?.email],
                ['Telepon', e?.phone],
              ]}
            />
            <p className="small muted" style={{ marginTop: 10 }}>
              <Icon name="info" size={14} className="inline align-[-2px]" /> Peminjam tidak memiliki akun dan tidak login.
            </p>
          </Card>

          {isActive(b) && (
            <Card title="Jadwal pengingat" desc="Notifikasi yang sama tidak dikirim dua kali" className="no-print">
              <ul className="list">
                {s.rules
                  .filter((r) => r.active)
                  .map((r) => {
                    const date = addDays(b.due_date, r.days);
                    const sent = notifs.find((n) => n.event === r.event);
                    const passed = date <= today();
                    return (
                      <li key={r.event} style={{ padding: '8px 0' }}>
                        <span className="mono strong" style={{ width: 48 }}>
                          {r.event}
                        </span>
                        <span className="small" style={{ flex: 1 }}>
                          {fmtDate(date)}
                        </span>
                        {isApiMode ? (
                          <span className="small muted">{passed ? 'diproses server' : 'terjadwal'}</span>
                        ) : sent ? (
                          <Badge status={sent.status} />
                        ) : passed ? (
                          <Badge status="DILEWATI">TIDAK DIKIRIM</Badge>
                        ) : (
                          <Badge status="MENUNGGU">TERJADWAL</Badge>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </Card>
          )}

          {can('audit.view') && logs.length > 0 && (
            <Card title="Jejak audit" className="no-print">
              <ul className="timeline">
                {logs.map((a) => (
                  <li key={a.id}>
                    <div className="t-time">{fmtDateTime(a.at)}</div>
                    <div className="small">
                      <b>{userName(a.user_id)}</b> · <span className="mono">{a.action}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
      <EmailPreview id={emailId} onClose={() => setEmailId(null)} />
    </>
  );
}
