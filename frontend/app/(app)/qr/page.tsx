'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { db } from '@/lib/mock/db';
import { fmtDate } from '@/lib/date';
import { CONDITIONS } from '@/lib/constants';
import { cn, match, stripQrPrefix } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useTitle } from '@/hooks/use-title';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, Empty, PageHead, Thumb } from '@/components/ui/misc';
import { QrCode } from '@/components/ui/qr-code';
import { DueText } from '@/components/domain/borrow-status';
import { useToast } from '@/components/providers/feedback-provider';
import { audit } from '@/services/audit';
import { qrPayload } from '@/services/inventory';
import { activeBorrowingOfItem, emp, isBorrowable, item as getItem, itemByCode, loc } from '@/services/lookup';
import type { ID } from '@/types';

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (opts: { formats: string[] }) => BarcodeDetectorLike;

export default function QrPage() {
  useTitle('QR / Barcode');
  const { can } = useAuth();
  const toast = useToast();
  const params = useSearchParams();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<ID>>(() => new Set((params.get('ids') || '').split(',').map(Number).filter(Boolean)));
  const [q, setQ] = useState('');
  const [camOn, setCamOn] = useState(false);
  const [camSupported, setCamSupported] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deteksi kemampuan browser setelah mount
    setCamSupported('BarcodeDetector' in window && !!navigator.mediaDevices);
    return () => stopCamera();
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamOn(false);
  }

  async function startCamera() {
    if (streamRef.current) return stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setCamOn(true);
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();
      const Ctor = (window as unknown as { BarcodeDetector: BarcodeDetectorCtor }).BarcodeDetector;
      const det = new Ctor({ formats: ['qr_code', 'code_128', 'code_39'] });
      const tick = async () => {
        if (!streamRef.current) return;
        try {
          const codes = await det.detect(video);
          if (codes.length) {
            setCode(codes[0].rawValue);
            setResult(codes[0].rawValue);
            stopCamera();
            return;
          }
        } catch {
          /* lanjut */
        }
        requestAnimationFrame(tick);
      };
      tick();
    } catch (err) {
      toast('Tidak dapat mengakses kamera: ' + (err as Error).message, 'err');
      stopCamera();
    }
  }

  const canPrint = can('qr.manage');
  const list = db.where('items', (i) => i.active && match(q, i.item_code, i.item_name)).sort((a, b) => a.item_code.localeCompare(b.item_code));
  const labels = [...selected].map((id) => getItem(id)).filter((x): x is NonNullable<typeof x> => !!x);
  const toggle = (id: ID, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  return (
    <>
      <div className="no-print">
        <PageHead crumb="Beranda / QR / Barcode" title="QR / Barcode" desc="Identitas digital barang: pindai untuk akses cepat ke detail, cetak label untuk ditempel pada barang." />
      </div>
      <div className="stack">
        <div className="no-print">
          <Card title="Pindai barang">
            <div className="grid g-2">
              <div className="stack" style={{ gap: 10 }}>
                <div className="field">
                  <label htmlFor="qr-in">Kode dari pemindai</label>
                  <input
                    className="input mono"
                    id="qr-in"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        setResult(code);
                        (e.target as HTMLInputElement).select();
                      }
                    }}
                    placeholder="Arahkan pemindai QR/barcode ke kolom ini, atau ketik INV-… lalu Enter"
                    autoComplete="off"
                  />
                </div>
                <div className="row">
                  <Button icon="search" onClick={() => setResult(code)}>
                    Cari
                  </Button>
                  <Button icon="camera" disabled={!camSupported} onClick={startCamera}>
                    {!camSupported ? 'Kamera tidak didukung browser ini' : camOn ? 'Hentikan kamera' : 'Pindai dengan kamera'}
                  </Button>
                </div>
                <video ref={videoRef} className={cn(!camOn && 'hidden')} playsInline muted style={{ width: '100%', maxWidth: 360, borderRadius: 10, background: '#000' }} />
                <p className="small muted">
                  Pemindai USB/Bluetooth bekerja seperti keyboard. Isi QR berformat <span className="mono">SIIPB:INV-XXX-0000</span>.
                </p>
              </div>
              <div>{result === null ? <Empty icon="scan">Hasil pindaian akan tampil di sini.</Empty> : <ScanResult raw={result} />}</div>
            </div>
          </Card>
        </div>

        {canPrint && (
          <div className="split" style={{ gridTemplateColumns: '320px minmax(0,1fr)' }}>
            <div className="no-print">
              <Card title="Pilih barang">
                <input className="input" placeholder="Cari barang…" aria-label="Cari barang" style={{ marginBottom: 10 }} value={q} onChange={(e) => setQ(e.target.value)} />
                <div className="pick-list" style={{ maxHeight: 460 }}>
                  {list.map((i) => (
                    <label key={i.id} className={cn(selected.has(i.id) && 'sel')}>
                      <input type="checkbox" checked={selected.has(i.id)} onChange={(e) => toggle(i.id, e.target.checked)} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <b>{i.item_name}</b> <span className="mono small muted">{i.item_code}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="row" style={{ marginTop: 10 }}>
                  <Button size="sm" onClick={() => list.forEach((i) => toggle(i.id, true))}>
                    Pilih semua
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                    Kosongkan
                  </Button>
                </div>
              </Card>
            </div>
            <Card
              title={`Label siap cetak (${labels.length})`}
              actions={
                <Button
                  variant="primary"
                  icon="printer"
                  className="no-print"
                  onClick={() => {
                    if (!selected.size) return toast('Pilih minimal satu barang.', 'warn');
                    audit('qr.print', 'items', null, null, { jumlah_label: selected.size });
                    db.save();
                    setTimeout(() => window.print(), 50);
                  }}
                >
                  Cetak label
                </Button>
              }
            >
              <div className="labels-grid">
                {labels.length ? (
                  labels.map((i) => (
                    <div key={i.id} className="label-card">
                      <QrCode value={qrPayload(i)} />
                      <div style={{ minWidth: 0 }}>
                        <div className="small strong" style={{ letterSpacing: '.06em' }}>
                          {db.data.settings.institution.toUpperCase()}
                        </div>
                        <div className="mono strong" style={{ fontSize: 14 }}>
                          {i.item_code}
                        </div>
                        <div className="small">{i.item_name}</div>
                        <div className="small muted">
                          {loc(i.location_id)?.name} · {i.acquisition_year}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="empty no-print">Pilih barang di sebelah kiri untuk membuat label.</div>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}

function ScanResult({ raw }: { raw: string }) {
  const { can } = useAuth();
  const code = stripQrPrefix(raw);
  const it = itemByCode(code);
  if (!it)
    return (
      <Alert type="danger">
        Kode <span className="mono">{code}</span> tidak terdaftar di inventaris.
      </Alert>
    );
  const activeB = activeBorrowingOfItem(it.id);
  return (
    <div className="card" style={{ boxShadow: 'none' }}>
      <div className="card-body row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <Thumb item={it} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <b>{it.item_name}</b>
          <div className="cell-sub mono">{it.item_code}</div>
          <div className="row" style={{ gap: 8, margin: '8px 0' }}>
            <Badge status={it.item_status} />
            <span className="small muted">
              {loc(it.location_id)?.name} · {CONDITIONS[it.condition_status]}
            </span>
          </div>
          {activeB && (
            <div className="small">
              Dipinjam oleh <b>{emp(activeB.employee_id)?.name}</b> sampai {fmtDate(activeB.due_date)} (<DueText b={activeB} />)
            </div>
          )}
          <div className="actions" style={{ marginTop: 10 }}>
            <Button size="sm" icon="eye" href={`/inventaris/${it.id}`}>
              Buka detail
            </Button>
            {activeB && can('return.manage') && (
              <Button size="sm" variant="primary" icon="in" href={`/pengembalian/baru?pinjam=${activeB.id}`}>
                Catat pengembalian
              </Button>
            )}
            {!activeB && isBorrowable(it) && can('borrowing.manage') && (
              <Button size="sm" variant="primary" icon="out" href={`/peminjaman/baru?item=${it.id}`}>
                Pinjamkan
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
