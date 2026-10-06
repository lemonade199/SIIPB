import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="boot">
      <div style={{ textAlign: 'center', display: 'grid', gap: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 650 }}>Halaman tidak ditemukan</h1>
        <p className="muted">Alamat yang Anda buka tidak tersedia (404).</p>
        <Link href="/" className="btn btn-primary" style={{ justifySelf: 'center' }}>
          Kembali ke beranda
        </Link>
      </div>
    </div>
  );
}
