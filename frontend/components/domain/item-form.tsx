'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { db } from '@/lib/mock/db';
import { CONDITIONS } from '@/lib/constants';
import { readImage } from '@/lib/file';
import { useTitle } from '@/hooks/use-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SelectField, TextareaField, TextField, toOptions } from '@/components/ui/form';
import { PageHead, Photo } from '@/components/ui/misc';
import { NotFoundView } from '@/components/layout/app-shell';
import { useToast } from '@/components/providers/feedback-provider';
import { genItemCode, saveItem, type ItemInput } from '@/services/inventory';
import { item as getItem } from '@/services/lookup';
import type { Condition, FieldErrors, ID } from '@/types';

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];

/** Form tambah / ubah barang (dipakai /inventaris/baru dan /inventaris/[id]/ubah). */
export function ItemForm({ id }: { id?: ID }) {
  const router = useRouter();
  const toast = useToast();
  const existing = id ? getItem(id) : null;
  useTitle(id ? 'Ubah barang' : 'Tambah barang');

  const [v, setV] = useState<ItemInput>(() => ({
    item_code: existing?.item_code ?? '',
    item_name: existing?.item_name ?? '',
    category_id: existing?.category_id ?? '',
    location_id: existing?.location_id ?? '',
    brand: existing?.brand ?? '',
    model: existing?.model ?? '',
    serial_number: existing?.serial_number ?? '',
    condition_status: existing?.condition_status ?? 'BAIK',
    acquisition_year: existing?.acquisition_year ?? new Date().getFullYear(),
    acquisition_source: existing?.acquisition_source ?? '',
    acquisition_value: existing?.acquisition_value ?? '',
    notes: existing?.notes ?? '',
  }));
  const [photo, setPhoto] = useState<string | null>(existing?.photo ?? null);
  const [photoErr, setPhotoErr] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const fileRef = useRef<HTMLInputElement>(null);

  if (id && !existing) return <NotFoundView text="Barang tidak ditemukan." />;
  const sec = db.data.settings.security;
  const set = <K extends keyof ItemInput>(k: K, val: ItemInput[K]) => setV((p) => ({ ...p, [k]: val }));

  const onFile = async (f: File | undefined) => {
    setPhotoErr('');
    if (!f) return;
    const max = Number(sec.upload_max_mb) * 1024 * 1024;
    if (!ALLOWED.includes(f.type)) return setPhotoErr('Tipe berkas tidak diizinkan. Gunakan JPG, PNG, atau WEBP.');
    if (f.size > max) return setPhotoErr(`Ukuran berkas ${(f.size / 1048576).toFixed(1)} MB melebihi batas.`);
    try {
      setPhoto(await readImage(f, 640));
    } catch (e) {
      setPhotoErr((e as Error).message);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const r = saveItem({ ...v, photo }, id ?? null);
    if (!r.ok) {
      setErrors(r.errors);
      toast('Periksa kembali isian yang ditandai.', 'err');
      return;
    }
    toast(id ? 'Perubahan barang disimpan.' : `Barang ${r.item.item_code} ditambahkan.`);
    router.push(`/inventaris/${r.item.id}`);
  };

  const codePlaceholder = !id && v.category_id ? `Otomatis: ${genItemCode(Number(v.category_id))}` : 'Kosongkan untuk dibuat otomatis';

  return (
    <>
      <PageHead
        crumb={
          <>
            <Link href="/inventaris">Inventaris</Link> / {existing ? 'Ubah' : 'Tambah'}
          </>
        }
        title={existing ? `Ubah ${existing.item_name}` : 'Tambah Barang'}
        desc={existing ? <span className="mono">{existing.item_code}</span> : 'Catat barang baru ke inventaris. Status awal: TERSEDIA.'}
      />
      <form noValidate onSubmit={onSubmit}>
        <div className="split">
          <div className="stack">
            <Card title="Identitas barang">
              <div className="form-grid">
                <TextField
                  label="Kode barang"
                  mono
                  value={v.item_code}
                  placeholder={codePlaceholder}
                  hint="Format: INV-[KODE KATEGORI]-[NOMOR]"
                  error={errors.item_code}
                  onChange={(e) => set('item_code', e.target.value)}
                />
                <TextField
                  label="Nama barang"
                  required
                  value={v.item_name}
                  placeholder="mis. Laptop Lenovo ThinkPad E14"
                  error={errors.item_name}
                  onChange={(e) => set('item_name', e.target.value)}
                />
                <SelectField
                  label="Kategori"
                  required
                  value={v.category_id}
                  error={errors.category_id}
                  onChange={(e) => set('category_id', e.target.value)}
                  options={toOptions(
                    db.where('categories', (c) => c.active || c.id === existing?.category_id),
                    '— Pilih —',
                    (c) => `${c.code} — ${c.name}`,
                  )}
                />
                <SelectField
                  label="Lokasi"
                  required
                  value={v.location_id}
                  error={errors.location_id}
                  onChange={(e) => set('location_id', e.target.value)}
                  options={toOptions(
                    db.where('locations', (l) => l.active || l.id === existing?.location_id),
                    '— Pilih —',
                    (l) => `${l.name} (${l.building})`,
                  )}
                />
                <TextField label="Merek" value={v.brand} onChange={(e) => set('brand', e.target.value)} />
                <TextField label="Model" value={v.model} onChange={(e) => set('model', e.target.value)} />
                <TextField label="Nomor seri" mono value={v.serial_number} placeholder="Jika ada" onChange={(e) => set('serial_number', e.target.value)} />
                <SelectField
                  label="Kondisi"
                  value={v.condition_status}
                  onChange={(e) => set('condition_status', e.target.value as Condition)}
                  options={Object.entries(CONDITIONS).map(([k, l]) => ({ value: k, label: l }))}
                />
              </div>
            </Card>
            <Card title="Perolehan">
              <div className="form-grid">
                <TextField
                  label="Tahun perolehan"
                  type="number"
                  min={1990}
                  max={2100}
                  value={v.acquisition_year}
                  error={errors.acquisition_year}
                  onChange={(e) => set('acquisition_year', e.target.value)}
                />
                <TextField
                  label="Sumber perolehan"
                  placeholder="mis. APBN 2024, Hibah"
                  value={v.acquisition_source}
                  onChange={(e) => set('acquisition_source', e.target.value)}
                />
                <TextField
                  label="Nilai perolehan (Rp)"
                  type="number"
                  min={0}
                  value={v.acquisition_value}
                  error={errors.acquisition_value}
                  onChange={(e) => set('acquisition_value', e.target.value)}
                />
                <TextareaField
                  label="Catatan"
                  full
                  placeholder="Kelengkapan, aksesori, larangan dibawa keluar, dll."
                  value={v.notes}
                  onChange={(e) => set('notes', e.target.value)}
                />
              </div>
            </Card>
          </div>

          <div className="stack">
            <Card title="Foto barang">
              <Photo src={photo} alt="Pratinjau foto" style={{ marginBottom: 12 }} />
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  onFile(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <div className="row">
                <Button icon="upload" onClick={() => fileRef.current?.click()}>
                  Pilih foto
                </Button>
                <Button variant="ghost" onClick={() => setPhoto(null)}>
                  Hapus
                </Button>
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>
                {sec.upload_types}, maks. {sec.upload_max_mb} MB. Disimpan di penyimpanan berkas (MinIO/S3).
              </p>
              {photoErr && (
                <p className="small" style={{ color: 'var(--danger)' }}>
                  {photoErr}
                </p>
              )}
            </Card>
            {existing && (
              <Card title="Status">
                <Badge status={existing.item_status} />
                <p className="small muted" style={{ marginTop: 8 }}>
                  Status tidak diubah di formulir ini. Status berubah otomatis lewat transaksi atau melalui tombol <b>Ubah status</b> di halaman detail.
                </p>
              </Card>
            )}
            <div className="card" style={{ padding: 16 }}>
              <div className="stack" style={{ gap: 8 }}>
                <Button type="submit" variant="primary" icon="check" block>
                  {existing ? 'Simpan perubahan' : 'Simpan barang'}
                </Button>
                <Button block href={existing ? `/inventaris/${existing.id}` : '/inventaris'}>
                  Batal
                </Button>
              </div>
            </div>
          </div>
        </div>
      </form>
    </>
  );
}
