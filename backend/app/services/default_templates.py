"""Template email bawaan (Bahasa Indonesia). Dipakai seed; sama dengan migrasi a7c3e91d2b40."""

FOOT = (
    "\n\nKontak petugas: {{nama_petugas}} ({{kontak_petugas}})\nTempat pengembalian: {{lokasi_pengembalian}}"
    "\n\nEmail ini dikirim otomatis oleh SIIPB {{nama_instansi}}. Anda tidak perlu login, mengisi formulir, "
    "atau membalas email ini."
)
TEMPLATES = [
    ("LOAN_CONFIRMATION", "Konfirmasi peminjaman",
     "[SIIPB] Peminjaman {{kode_transaksi}} — kembalikan paling lambat {{batas_kembali}}",
     "Yth. {{nama_peminjam}},\n\nPetugas Sarpras/IT telah mencatat peminjaman barang atas nama Anda:\n\n"
     "{{daftar_barang}}\n\nTanggal peminjaman : {{tanggal_pinjam}}\nBatas pengembalian : {{batas_kembali}}\n"
     "Tujuan             : {{tujuan}}\n\nMohon kembalikan barang sebelum batas waktu. Kondisi dan kelengkapan "
     "barang akan diperiksa saat pengembalian." + FOOT),
    ("H_MINUS_3", "Pengingat H-3", "[SIIPB] Pengingat: batas pengembalian {{kode_transaksi}} tinggal 3 hari",
     "Yth. {{nama_peminjam}},\n\nBarang berikut harus dikembalikan paling lambat {{batas_kembali}} (3 hari lagi):"
     "\n\n{{daftar_barang}}" + FOOT),
    ("H_MINUS_1", "Pengingat H-1", "[SIIPB] Besok batas pengembalian {{kode_transaksi}}",
     "Yth. {{nama_peminjam}},\n\nBesok, {{batas_kembali}}, adalah batas pengembalian barang berikut:\n\n"
     "{{daftar_barang}}" + FOOT),
    ("H_DAY", "Hari ini jatuh tempo", "[SIIPB] Hari ini batas pengembalian {{kode_transaksi}}",
     "Yth. {{nama_peminjam}},\n\nHari ini, {{batas_kembali}}, adalah batas pengembalian barang berikut:\n\n"
     "{{daftar_barang}}\n\nMohon diserahkan ke petugas hari ini." + FOOT),
    ("H_PLUS_1", "Terlambat H+1", "[SIIPB] Peminjaman {{kode_transaksi}} terlambat {{hari_terlambat}} hari",
     "Yth. {{nama_peminjam}},\n\nBatas pengembalian barang berikut telah lewat ({{batas_kembali}}). Saat ini "
     "terlambat {{hari_terlambat}} hari:\n\n{{daftar_barang}}\n\nMohon segera mengembalikan barang." + FOOT),
    ("H_PLUS_3", "Eskalasi H+3", "[SIIPB] ESKALASI: {{kode_transaksi}} terlambat {{hari_terlambat}} hari",
     "Yth. {{nama_peminjam}},\n(tembusan: Petugas Sarpras/IT)\n\nPeminjaman {{kode_transaksi}} telah terlambat "
     "{{hari_terlambat}} hari dari batas {{batas_kembali}}:\n\n{{daftar_barang}}\n\nPetugas akan menindaklanjuti "
     "keterlambatan ini." + FOOT),
    ("H_PLUS_7", "Eskalasi lanjutan H+7",
     "[SIIPB] ESKALASI LANJUTAN: {{kode_transaksi}} terlambat {{hari_terlambat}} hari",
     "Yth. {{nama_peminjam}},\n(tembusan: Petugas Sarpras/IT dan Pimpinan)\n\nPeminjaman {{kode_transaksi}} telah "
     "terlambat {{hari_terlambat}} hari dari batas {{batas_kembali}}:\n\n{{daftar_barang}}\n\nKeterlambatan ini "
     "telah dilaporkan kepada pimpinan unit." + FOOT),
    ("RETURN_CONFIRMATION", "Konfirmasi pengembalian", "[SIIPB] Pengembalian {{kode_transaksi}} telah diterima",
     "Yth. {{nama_peminjam}},\n\nPetugas telah menerima pengembalian barang berikut pada {{tanggal_kembali}}:\n\n"
     "{{daftar_barang_kembali}}\n\nTerima kasih." + FOOT),
]
