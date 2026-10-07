'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { db } from '@/lib/mock/db';
import { ITEM_STATUS , CONDITION_KEYS} from '@/lib/constants';
import { cn, match, paginate } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { patchFilter, usePersistentState } from '@/hooks/use-persistent-state';
import { useTitle } from '@/hooks/use-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, toOptions } from '@/components/ui/form';
import { Alert, Empty, PageHead, Pager, SearchInput, Thumb } from '@/components/ui/misc';
import { cat, loc, conditionLabel } from '@/services/lookup';
import type { Condition, ID, ItemStatus } from '@/types';

interface Filter {
  q: string;
  category: string;
  location: string;
  status: ItemStatus | '';
  condition: Condition | '';
  inactive: boolean;
  page: number;
}

export default function InventarisPage() {
  useTitle('Inventaris');
  const { can } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const [f, setF] = usePersistentState<Filter>('inv.filter', { q: '', category: '', location: '', status: '', condition: '', inactive: false, page: 1 });
  const set = patchFilter(setF);
  const [selected, setSelected] = useState<Set<ID>>(new Set());

  // ?q= dan ?status= (dari pencarian global / dashboard)
  useEffect(() => {
    const q = params.get('q');
    const status = params.get('status');
    if (q !== null || status !== null)
      setF((p) => ({ ...p, q: q ?? p.q, status: (status as ItemStatus) ?? p.status, page: 1 }));
  }, [params, setF]);

  const canManage = can('inventory.manage');
  const canQR = can('qr.manage');

  const rows = db
    .where(
      'items',
      (it) =>
        (f.inactive ? !it.active : it.active) &&
        match(f.q, it.item_code, it.item_name, it.brand, it.model, it.serial_number) &&
        (!f.category || it.category_id === Number(f.category)) &&
        (!f.location || it.location_id === Number(f.location)) &&
        (!f.status || it.item_status === f.status) &&
        (!f.condition || it.condition_status === f.condition),
    )
    .sort((a, b) => a.item_code.localeCompare(b.item_code));
  const p = paginate(rows, f.page, 10);

  const activeItems = db.where('items', (i) => i.active);
  const counts: Record<string, number> = {};
  activeItems.forEach((i) => {
    counts[i.item_status] = (counts[i.item_status] || 0) + 1;
  });
  const chips: [ItemStatus | '', string, number][] = [['', 'Semua', activeItems.length], ...ITEM_STATUS.map((s): [ItemStatus, string, number] => [s, s, counts[s] || 0])];

  const toggle = (id: ID, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const allOnPage = p.rows.length > 0 && p.rows.every((r) => selected.has(r.id));

  return (
    <>
      <PageHead
        crumb="Beranda / Inventaris"
        title="Inventaris Barang"
        desc="Data barang, kategori, lokasi, kondisi, status, foto, dan kode/QR."
        actions={
          <>
            {can('report.export') && (
              <Button icon="file" href="/laporan?type=inventaris">
                Laporan
              </Button>
            )}
            {canManage && (
              <Button variant="primary" icon="plus" href="/inventaris/baru">
                Tambah Barang
              </Button>
            )}
          </>
        }
      />
      <div className="stack">
        <Alert type="info">
          Barang berstatus <b>RUSAK_BERAT</b>, <b>HILANG</b>, atau <b>DALAM_PERBAIKAN</b> tidak dapat dipinjam. Barang tidak dihapus; gunakan <b>Nonaktifkan</b> agar riwayat tetap utuh.
        </Alert>
        <div className="row">
          {chips.map(([v, l, n]) => (
            <Button key={l} size="sm" variant={f.status === v ? 'primary' : 'outline'} onClick={() => set('status', v)}>
              {l} <span className={cn(f.status !== v && 'muted')}>{n}</span>
            </Button>
          ))}
        </div>
        <section className="card">
          <div className="toolbar">
            <SearchInput value={f.q} onChange={(v) => set('q', v)} placeholder="Cari kode, nama, merek, nomor seri…" label="Cari barang" />
            <Select aria-label="Kategori" value={f.category} onChange={(e) => set('category', e.target.value)} options={toOptions(db.all('categories'), 'Semua kategori')} />
            <Select aria-label="Lokasi" value={f.location} onChange={(e) => set('location', e.target.value)} options={toOptions(db.all('locations'), 'Semua lokasi')} />
            <Select
              aria-label="Kondisi"
              value={f.condition}
              onChange={(e) => set('condition', e.target.value as Condition | '')}
              options={[{ value: '', label: 'Semua kondisi' }, ...CONDITION_KEYS.map((k) => ({ value: k, label: conditionLabel(k) }))]}
            />
            <label className="check small">
              <Checkbox checked={f.inactive} onCheckedChange={(c) => set('inactive', c === true)} /> Tampilkan nonaktif
            </label>
          </div>
          {selected.size > 0 && (
            <div className="toolbar" style={{ background: '#f3f7fa' }}>
              <span>
                <b>{selected.size}</b> barang dipilih
              </span>
              <Button size="sm" icon="printer" onClick={() => router.push(`/qr?ids=${[...selected].join(',')}`)}>
                Cetak label QR
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                Batal pilih
              </Button>
            </div>
          )}
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  {canQR && (
                    <th>
                      <Checkbox aria-label="Pilih semua di halaman ini" checked={allOnPage} onCheckedChange={(c) => p.rows.forEach((r) => toggle(r.id, c === true))} />
                    </th>
                  )}
                  <th>Barang</th>
                  <th>Kategori</th>
                  <th>Lokasi</th>
                  <th>Kondisi</th>
                  <th>Status</th>
                  <th className="right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {p.rows.length ? (
                  p.rows.map((it) => {
                    const l = loc(it.location_id);
                    return (
                      <tr key={it.id}>
                        {canQR && (
                          <td style={{ width: 36 }}>
                            <Checkbox checked={selected.has(it.id)} onCheckedChange={(c) => toggle(it.id, c === true)} aria-label={`Pilih ${it.item_code}`} />
                          </td>
                        )}
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
                        <td>{cat(it.category_id)?.name}</td>
                        <td>
                          {l?.name}
                          <div className="cell-sub">{l?.building}</div>
                        </td>
                        <td>{conditionLabel(it.condition_status)}</td>
                        <td>
                          <Badge status={it.item_status} /> {!it.active && <Badge status="NONAKTIF" />}
                        </td>
                        <td className="right nowrap">
                          <Button size="sm" iconOnly icon="eye" title="Detail" href={`/inventaris/${it.id}`} />{' '}
                          {canManage && <Button size="sm" iconOnly icon="pencil" title="Ubah" href={`/inventaris/${it.id}/ubah`} />}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7}>
                      <Empty icon="box">Tidak ada barang yang cocok dengan filter.</Empty>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager page={p} label="barang" onPage={(n) => set('page', n)} />
        </section>
      </div>
    </>
  );
}
