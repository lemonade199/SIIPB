/** Utilitas berkas di sisi browser: unduh, CSV, kompres foto. */

export function download(filename: string, content: string | Blob, mime = 'text/plain;charset=utf-8') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 500);
}

export interface CsvColumn {
  key: string;
  label: string;
}

/** CSV dengan pemisah ";" dan BOM agar langsung terbaca benar di Microsoft Excel (locale Indonesia). */
export function toCSV(columns: CsvColumn[], rows: Record<string, unknown>[]) {
  const q = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n,]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const lines = [columns.map((c) => q(c.label)).join(';')];
  rows.forEach((r) => lines.push(columns.map((c) => q(r[c.key])).join(';')));
  return '﻿' + lines.join('\r\n');
}

export function downloadCSV(filename: string, columns: CsvColumn[], rows: Record<string, unknown>[]) {
  download(filename, toCSV(columns, rows), 'text/csv;charset=utf-8');
}

/** Perkecil foto di sisi klien (simulasi upload ke MinIO/S3) — hasil berupa data URL JPEG. */
export function readImage(file: File, maxSize = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Berkas bukan gambar yang valid'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', 0.78));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
