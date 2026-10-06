'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { db } from '@/lib/mock/db';
import { CONDITION_KEYS} from '@/lib/constants';
import { readImage } from '@/lib/file';
import { useTitle } from '@/hooks/use-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SelectField, TextareaField, TextField, toOptions } from '@/components/ui/form';
import { PageHead } from '@/components/ui/misc';
import { PhotoEditor } from '@/components/domain/photo-gallery';
import { NotFoundView } from '@/components/layout/app-shell';
import { useToast } from '@/components/providers/feedback-provider';
import { genItemCode, MAX_PHOTOS, type ItemInput } from '@/services/inventory';
import * as repo from '@/services/repo';
import { CAPABILITIES } from '@/lib/config';
import { item as getItem, conditionLabel } from '@/services/lookup';
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
  const [photos, setPhotos] = useState<string[]>(existing?.photos ?? []);
  const [photoErr, setPhotoErr] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const maxPhotos = CAPABILITIES.multiPhoto ? MAX_PHOTOS : 1;

  if (id && !existing) return <NotFoundView text="Barang tidak ditemukan." />;
  const sec = db.data.settings.security;
  const set = <K extends keyof ItemInput>(k: K, val: ItemInput[K]) => setV((p) => ({ ...p, [k]: val }));

  const onFiles = async (files: File[]) => {
    setPhotoErr('');
    const max = Number(sec.upload_max_mb) * 1024 * 1024;
    const room = maxPhotos - photos.length;
    if (files.length > room) setPhotoErr(`Maksimal ${maxPhotos} foto per barang; ${files.length - Math.max(room, 0)} berkas dilewati.`);
    const added: string[] = [];
    for (const f of files.slice(0, Math.max(room, 0))) {
      if (!ALLOWED.includes(f.type)) {
        setPhotoErr(`${f.name}: tipe berkas tidak diizinkan. Gunakan JPG, PNG, atau WEBP.`);
        continue;
      }
      if (f.size > max) {
        setPhotoErr(`${f.name}: ukuran ${(f.size / 1048576).toFixed(1)} MB melebihi batas.`);
        continue;
      }
      try {
        added.push(await readImage(f, 640));
      } catch (e) {
        setPhotoErr((e as Error).message);
      }
    }
    if (added.length) setPhotos((p) => [...p, ...added]);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const r = await repo.saveItem({ ...v, photos }, id ?? null);
    setSaving(false);
    if (!r.ok) {
      setErrors(r.errors || {});
      toast(r.error, 'err');
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
                  options={CONDITION_KEYS.map((k) => ({ value: k, label: conditionLabel(k) }))}
                />
              </div>
            </Card>
            <Card title="Perolehan">
              <div className="form-grid">
                {CAPABILITIES.acquisitionYear && (
                  <TextField
                  label="Tahun perolehan"
                  type="number"
                  min={1990}
                  max={2100}
                  value={v.acquisition_year}
                  error={errors.acquisition_year}
                  onChange={(e) => set('acquisition_year', e.target.value)}
                />
                )}
                {CAPABILITIES.acquisitionSource && (
                  <TextField
                    label="Sumber perolehan"
                    placeholder="mis. APBN 2024, Hibah"
                    value={v.acquisition_source}
                    onChange={(e) => set('acquisition_source', e.target.value)}
                  />
                )}
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
              <PhotoEditor photos={photos} onChange={setPhotos} max={maxPhotos} />
              <input
                ref={fileRef}
                type="file"
                multiple={maxPhotos > 1}
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Pilih foto barang"
                onChange={(e) => {
                  onFiles(Array.from(e.target.files || []));
                  e.target.value = '';
                }}
              />
              <div className="row" style={{ marginTop: 12 }}>
                <Button icon="upload" disabled={photos.length >= maxPhotos} onClick={() => fileRef.current?.click()}>
                  Tambah foto
                </Button>
                {photos.length > 0 && (
                  <Button variant="ghost" onClick={() => setPhotos([])}>
                    Hapus semua
                  </Button>
                )}
              </div>
              <p className="small muted" style={{ marginTop: 8 }}>
                Maks. {maxPhotos} foto, {sec.upload_types}, {sec.upload_max_mb} MB per berkas. Foto pertama menjadi foto utama. Disimpan di penyimpanan berkas (MinIO/S3).
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
                <Button type="submit" variant="primary" icon="check" block disabled={saving}>
                  {saving ? 'Menyimpan…' : existing ? 'Simpan perubahan' : 'Simpan barang'}
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
