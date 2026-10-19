/**
 * Motif garis kode batang, hiasan yang sesuai dengan dunia inventaris (label barang).
 * Bukan kode asli dan tidak bisa dipindai; hanya dekorasi, tersembunyi dari pembaca layar.
 */
export function Barcode({ seed = 'SIIPB', height = 56, bars = 44, className }: { seed?: string; height?: number; bars?: number; className?: string }) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const rects: { x: number; w: number }[] = [];
  let x = 0;
  for (let i = 0; i < bars * 2; i++) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const w = 1 + ((h >>> 24) % 4);
    if (i % 2 === 0) rects.push({ x, w });
    x += w;
  }
  return (
    <svg className={className} width={x * 1.6} height={height} viewBox={`0 0 ${x} 40`} preserveAspectRatio="none" fill="currentColor" aria-hidden="true" focusable="false">
      {rects.map((r) => (
        <rect key={r.x} x={r.x} y={0} width={r.w} height={40} />
      ))}
    </svg>
  );
}
