'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/lib/mock/db';
import { fmtDate, fmtDateTime } from '@/lib/date';
import { ITEM_STATUS, NOT_BORROWABLE } from '@/lib/constants';
import { capitalize, rupiah } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useTitle } from '@/hooks/use-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Modal } from '@/components/ui/dialog';
import { SelectField, TextareaField } from '@/components/ui/form';
import { Alert, Empty, KV, PageHead } from '@/components/ui/misc';
import { PhotoGallery } from '@/components/domain/photo-gallery';
import { QrCode } from '@/components/ui/qr-code';
import { BorrowBadge, DueText } from '@/components/domain/borrow-status';
import { NotFoundView } from '@/components/layout/app-shell';
import { useConfirm, useToast } from '@/components/providers/feedback-provider';
import { qrPayload } from '@/services/inventory';
import * as repo from '@/services/repo';
import { CAPABILITIES, isApiMode } from '@/lib/config';
import { statusDesc, statusLabel } from '@/services/lookup';
import { activeBorrowingOfItem, cat, emp, isBorrowable, item as getItem, loc, userName, conditionLabel } from '@/services/lookup';
import type { ItemStatus } from '@/types';

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const it = getItem(Number(id));
  useTitle(it?.item_code || 'Detail barang');
  const [statusOpen, setStatusOpen] = useState(false);
  const [newStatus, setNewStatus] = useState<ItemStatus>('TERSEDIA');
  const [note, setNote] = useState('');
  const itemId = it?.id;

  // Mode api: riwayat pergerakan diambil dari GET /assets/{id}/history saat halaman dibuka.
  useEffect(() => {
    if (isApiMode && itemId) repo.loadItemHistory(itemId).catch(() => undefined);
  }, [itemId]);

  if (!it) return <NotFoundView text="Barang tidak ditemukan." />;

  const canManage = can('inventory.manage');
  const c = cat(it.category_id);
  const l = loc(it.location_id);
  const activeB = activeBorrowingOfItem(it.id);
  const history = db
    .where('borrowing_details', (d) => d.item_id === it.id)
    .map((d) => db.get('borrowings', d.borrowing_id))
    .filter((b): b is NonNullable<typeof b> => !!b && b.status !== 'DIBATALKAN')
    .sort((a, b) => b.borrow_date.localeCompare(a.borrow_date));
  const moves = db.where('item_movements', (m) => m.item_id === it.id).sort((a, b) => b.at.localeCompare(a.at));

  const openStatus = () => {
    setNewStatus(it.item_status);
    setNote('');
    setStatusOpen(true);
  };
  const saveStatus = async () => {
    const r = await repo.setItemStatus(it.id, newStatus, note);
    if (!r.ok) return toast(r.error, 'err');
    setStatusOpen(false);
    toast(`Status ${it.item_code} menjadi ${newStatus}.`);
  };
  const deactivate = async () => {
    const reason = await confirm({
      title: 'Nonaktifkan barang?',
      message: `${it.item_name} tidak akan muncul pada pencatatan peminjaman. Data dan riwayat tidak dihapus.`,
      input: 'Alasan',
      inputRequired: true,
      confirmText: 'Nonaktifkan',
      danger: true,
    });
    if (!reason) return;
    const r = await repo.setItemActive(it.id, false, String(reason));
    if (!r.ok) return toast(r.error, 'err');
    toast('Barang dinonaktifkan.');
  };

  return (
    <>
      <PageHead
        crumb={
          <>
            <Link href="/inventaris">Inventaris</Link> / {it.item_code}
          </>
        }
        title={it.item_name}
        desc={
          <>
            <span className="mono">{it.item_code}</span> · diperbarui {fmtDateTime(it.updated_at)}
          </>
        }
        actions={
          <>
            {can('borrowing.manage') && isBorrowable(it) && (
              <Button variant="primary" icon="out" href={`/peminjaman/baru?item=${it.id}`}>
                Pinjamkan
              </Button>
            )}
            {canManage && (
              <Button icon="pencil" href={`/inventaris/${it.id}/ubah`}>
                Ubah
              </Button>
            )}
            {canManage && CAPABILITIES.manualItemStatus && it.active && it.item_status !== 'DIPINJAM' && (
              <Button icon="refresh" onClick={openStatus}>
                Ubah status
              </Button>
            )}
            {canManage &&
              (it.active ? (
                <Button variant="danger" icon="archive" onClick={deactivate}>
                  Nonaktifkan
                </Button>
              ) : (
                <Button
                  icon="refresh"
                  onClick={async () => {
                    const r = await repo.setItemActive(it.id, true, 'Diaktifkan kembali');
                    if (!r.ok) return toast(r.error, 'err');
                    toast('Barang diaktifkan kembali.');
                  }}
                >
                  Aktifkan kembali
                </Button>
              ))}
          </>
        }
      />

      {!it.active && (
        <Alert type="warn" className="mb-4">
          Barang ini <b>nonaktif</b> dan tidak muncul pada pencatatan peminjaman. Riwayat tetap tersimpan.
        </Alert>
      )}
      {NOT_BORROWABLE.includes(it.item_status) && (
        <Alert type="warn" className="mb-4">
          Barang berstatus <b>{it.item_status}</b> sehingga tidak dapat dipinjam.
        </Alert>
      )}

      <div className="split">
        <div className="stack">
          <Card title="Atribut inventaris">
            <div className="grid items-start gap-5 md:grid-cols-[240px_minmax(0,1fr)]">
              <PhotoGallery key={it.id} photos={it.photos} alt={`Foto ${it.item_name}`} />
              <KV
                items={[
                  ['Kode barang', <span key="k" className="mono">{it.item_code}</span>],
                  ['Nama barang', it.item_name],
                  ['Kategori', c?.name],
                  ['Merek / model', [it.brand, it.model].filter(Boolean).join(' / ')],
                  ['Nomor seri', <span key="s" className="mono">{it.serial_number}</span>],
                  ['Tahun perolehan', it.acquisition_year],
                  ['Sumber perolehan', it.acquisition_source],
                  ['Nilai perolehan', rupiah(it.acquisition_value)],
                  [
                    'Lokasi',
                    <>
                      {l?.name} <span className="muted small">· {l?.building}</span>
                    </>,
                  ],
                  ['Kondisi', conditionLabel(it.condition_status)],
                  [
                    'Status',
                    <>
                      <Badge status={it.item_status} /> {!it.active && <Badge status="NONAKTIF" />}
                    </>,
                  ],
                  ['Catatan', it.notes],
                ]}
              />
            </div>
          </Card>

          <Card title="Riwayat peminjaman" flush>
            {history.length ? (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Transaksi</th>
                      <th>Peminjam</th>
                      <th>Pinjam</th>
                      <th>Batas</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <Link className="mono" href={`/peminjaman/${b.id}`}>
                            {b.code}
                          </Link>
                        </td>
                        <td>{emp(b.employee_id)?.name}</td>
                        <td>{fmtDate(b.borrow_date)}</td>
                        <td>{fmtDate(b.due_date)}</td>
                        <td>
                          <BorrowBadge b={b} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty icon="history">Belum pernah dipinjam.</Empty>
            )}
          </Card>

          <Card title="Riwayat pergerakan & status" desc="item_movements — dicatat otomatis oleh sistem">
            <ul className="timeline">
              {moves.map((m) => (
                <li key={m.id}>
                  <div className="t-time">
                    {fmtDateTime(m.at)} · {userName(m.user_id)}
                  </div>
                  <div>
                    <b>{capitalize(m.type.replace(/_/g, ' ').toLowerCase())}</b>{' '}
                    {m.from_status && m.to_status ? (
                      <>
                        <Badge status={m.from_status} /> → <Badge status={m.to_status} />
                      </>
                    ) : (
                      m.to_status && <Badge status={m.to_status} />
                    )}
                  </div>
                  {m.note && <div className="small muted">{m.note}</div>}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="stack">
          <Card title="Identitas QR">
            <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
              <QrCode value={qrPayload(it)} />
              <div className="stack" style={{ gap: 8 }}>
                <span className="mono strong">{it.item_code}</span>
                <span className="small muted">Pindai QR ini pada kolom pencarian / menu QR untuk membuka detail barang.</span>
                {can('qr.manage') && (
                  <Button size="sm" icon="printer" href={`/qr?ids=${it.id}`}>
                    Cetak label
                  </Button>
                )}
              </div>
            </div>
          </Card>
          {activeB && (
            <Card title="Sedang dipinjam" actions={<BorrowBadge b={activeB} />}>
              <KV
                one
                items={[
                  ['Peminjam', <Link key="p" href={`/peminjaman/${activeB.id}`}>{emp(activeB.employee_id)?.name}</Link>],
                  ['Transaksi', <span key="t" className="mono">{activeB.code}</span>],
                  ['Dipinjam', fmtDate(activeB.borrow_date)],
                  ['Batas kembali', fmtDate(activeB.due_date)],
                  ['Sisa waktu', <DueText key="d" b={activeB} />],
                ]}
              />
              {can('return.manage') && (
                <div style={{ marginTop: 12 }}>
                  <Button variant="primary" icon="in" block href={`/pengembalian/baru?pinjam=${activeB.id}`}>
                    Catat pengembalian
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      <Modal
        open={statusOpen}
        onClose={() => setStatusOpen(false)}
        title="Ubah status barang"
        desc={`${it.item_code} — ${it.item_name}`}
        footer={
          <>
            <Button onClick={() => setStatusOpen(false)}>Batal</Button>
            <Button variant="primary" onClick={saveStatus}>
              Simpan
            </Button>
          </>
        }
      >
        <div className="stack" style={{ gap: 12 }}>
          <SelectField
            label="Status baru"
            required
            value={newStatus}
            onChange={(e) => setNewStatus(e.target.value as ItemStatus)}
            options={ITEM_STATUS.filter((s) => s !== 'DIPINJAM').map((s) => ({ value: s, label: `${s} — ${statusLabel(s)}` }))}
            hint={statusDesc(newStatus)}
          />
          <TextareaField label="Keterangan" rows={2} placeholder="mis. dikirim ke vendor untuk servis" value={note} onChange={(e) => setNote(e.target.value)} />
          <Alert type="info">Status DIPINJAM hanya diberikan melalui checkout peminjaman. Perubahan dicatat pada riwayat dan audit log.</Alert>
        </div>
      </Modal>
    </>
  );
}
