# Panduan Pengguna SIIPB

SIIPB (Sistem Informasi Inventaris Barang, Peminjaman, dan Pengembalian Barang) dipakai oleh Administrator, Petugas
Sarpras/IT, dan Pimpinan. Peminjam tidak perlu memakai aplikasi ini. Peminjaman dan pengembalian dicatat oleh petugas,
lalu peminjam menerima email konfirmasi, pengingat, dan pemberitahuan bila terlambat.

Isi panduan:

1. Hak akses
2. Login dan logout
3. Dashboard
4. Master Data
5. Inventaris
6. Mencatat peminjaman
7. Mencatat pengembalian
8. Monitoring
9. Notifikasi
10. QR / Barcode
11. Laporan
12. Profil dan kata sandi
13. Menu khusus Administrator
14. Masalah yang sering terjadi

## 1. Hak akses

| Menu | Administrator | Petugas Sarpras/IT | Pimpinan |
|---|---|---|---|
| Dashboard | Ya | Ya | Ya |
| Inventaris | Kelola | Kelola | Lihat |
| Peminjaman dan Pengembalian | Kelola | Kelola | Lihat |
| Monitoring | Ya | Ya | Ya |
| Notifikasi | Kelola | Kelola | Lihat |
| QR / Barcode | Ya | Ya | Tidak |
| Laporan | Lihat dan unduh | Lihat dan unduh | Lihat dan unduh |
| Master Data | Ya | Ya | Tidak |
| Pengguna & Role, Audit Log, Pengaturan | Ya | Tidak | Tidak |

Administrator dapat mengubah hak akses ini di menu Pengguna & Role. Menu yang tidak boleh diakses tidak akan tampil
di sidebar.

## 2. Login dan logout

Login dengan username dan kata sandi:

1. Buka alamat SIIPB, misalnya https://averus.my.id.
2. Isi username atau email, lalu kata sandi.
3. Ketik kode CAPTCHA yang tampil di gambar. Kodenya 6 karakter, boleh huruf besar atau kecil. Jika gambar sulit
   dibaca, klik ikon muat ulang di sebelahnya.
4. Klik Sign in.

Kode CAPTCHA hanya berlaku 5 menit dan hanya bisa dipakai sekali. Jika login gagal, isi lagi dengan kode dari gambar
yang baru.

Jika Administrator sudah mengaktifkan SSO, Anda juga bisa klik Sign in with SSO dan login memakai akun organisasi.
Login lewat SSO tidak memakai CAPTCHA.

Untuk logout, klik ikon keluar di bagian bawah sidebar, di samping nama Anda.

## 3. Dashboard

Dashboard berisi ringkasan: jumlah barang per status, peminjaman yang masih berjalan, transaksi yang sebentar lagi
jatuh tempo, transaksi terlambat, dan statistik peminjaman. Klik kartu atau baris data untuk melihat detailnya.

Ikon lonceng di kanan atas berisi notifikasi untuk akun Anda. Klik Tandai semua dibaca untuk menandai semuanya
sudah dibaca.

## 4. Master Data

Isi Master Data terlebih dahulu sebelum memasukkan barang atau mencatat transaksi. Menu ini terdiri dari empat tab:

| Tab | Data yang diisi |
|---|---|
| Peminjam / Pegawai | Nama, NIP 18 digit, unit kerja, email, dan nomor telepon 10 sampai 13 digit yang diawali 0 |
| Kategori | Kode dan nama kategori, contohnya LPT untuk Laptop |
| Lokasi | Kode, nama, dan keterangan tempat penyimpanan |
| Unit Kerja | Kode dan nama unit kerja |

Email peminjam wajib diisi karena dipakai untuk mengirim notifikasi. Nomor telepon boleh diketik memakai spasi,
tanda hubung, atau awalan +62. Sistem akan menyimpannya dalam bentuk angka saja, misalnya +62 812-3456-7890
menjadi 081234567890.

Data yang sudah dipakai di transaksi tidak bisa dihapus. Data seperti itu cukup dinonaktifkan agar tidak muncul lagi
di pilihan.

## 5. Inventaris

Menambah barang:

1. Buka menu Inventaris, lalu klik Tambah Barang.
2. Isi nama barang, kategori, lokasi, merek dan model, nomor seri, serta kondisi. Kode barang (INV-...) akan dibuat
   otomatis jika dikosongkan.
3. Di bagian Perolehan, isi tahun perolehan, sumber perolehan (misalnya APBN 2024 atau Hibah), dan nilai perolehan.
   Nilai perolehan ditulis dalam angka tanpa titik, misalnya 14500000.
4. Tambahkan foto jika ada, lalu klik Simpan barang.

Untuk mengubah status barang, buka halaman detail barang lalu pilih status yang baru. Contohnya, barang yang sudah
selesai diperbaiki diubah dari Dalam perbaikan menjadi Tersedia. Status barang yang sedang dipinjam tidak bisa diubah
manual.

Barang yang sudah tidak dipakai bisa dinonaktifkan lewat tombol Nonaktifkan di halaman detail. Data dan riwayatnya
tetap tersimpan, tetapi barang tidak bisa dipinjam lagi. Barang yang belum pernah dipinjam boleh dihapus permanen.

Perubahan lokasi, kondisi, dan status barang tercatat di bagian Riwayat pada halaman detail barang.

Barang dengan status Rusak berat, Hilang, atau Dalam perbaikan tidak bisa dipinjam.

## 6. Mencatat peminjaman

Peminjam cukup datang ke petugas. Peminjam tidak perlu login atau mengisi formulir apa pun.

1. Buka menu Peminjaman, lalu klik Catat Peminjaman.
2. Pilih peminjam dengan mengetik nama, NIP, atau unit kerja. Peminjam harus sudah punya email di Master Data.
3. Pilih barang dengan mencentang dari daftar. Bisa juga dengan mengetik atau memindai kode barang (INV-...) di kolom
   Pindai / ketik kode barang lalu tekan Enter. Daftar hanya menampilkan barang yang tersedia.
4. Isi tanggal pinjam, batas kembali, tujuan peminjaman, dan catatan, misalnya kelengkapan yang ikut dibawa.
5. Periksa Ringkasan transaksi di sebelah kanan, termasuk kode transaksinya (PJM-...).
6. Klik salah satu tombol berikut:
   - Simpan & Serahkan (Checkout): status barang langsung berubah menjadi Dipinjam dan email konfirmasi terkirim ke
     peminjam.
   - Simpan sebagai draf: transaksi disimpan, tetapi status barang belum berubah. Draf bisa diubah atau diserahkan
     nanti.
7. Di halaman detail transaksi, klik Cetak bukti untuk mencetak bukti peminjaman. Bukti ini ditandatangani oleh
   peminjam dan petugas.

Draf yang tidak jadi dipakai bisa dibatalkan dengan tombol Batalkan di halaman detail transaksi.

## 7. Mencatat pengembalian

1. Buka menu Pengembalian, lalu klik Catat Pengembalian. Bisa juga dari halaman detail transaksi dengan klik
   Catat Pengembalian.
2. Cari transaksinya berdasarkan nama peminjam, kode PJM-..., atau kode barang, lalu klik baris transaksi tersebut.
3. Pilih kondisi setiap barang saat dikembalikan. Status barang akan berubah sesuai pilihan:

   | Kondisi yang dipilih | Status barang setelah disimpan |
   |---|---|
   | Baik, siap dipinjam lagi | Tersedia |
   | Rusak ringan | Rusak |
   | Rusak, langsung diperbaiki | Dalam perbaikan |
   | Rusak berat | Rusak berat |
   | Hilang | Hilang |

4. Isi kelengkapan dan catatan. Keterangan wajib diisi untuk barang yang rusak atau hilang.
5. Klik Simpan Pengembalian. Jika pilihan Kirim konfirmasi pengembalian dicentang, peminjam akan menerima email
   konfirmasi.
6. Klik Cetak bukti untuk mencetak bukti pengembalian.

Pengembalian yang terlambat tetap bisa dicatat seperti biasa. Lama keterlambatannya dihitung otomatis oleh sistem.

## 8. Monitoring

Menu Monitoring dipakai untuk memantau peminjaman dan kondisi barang. Ada empat tab:

| Tab | Isi |
|---|---|
| Semua aktif | Barang yang sedang dipinjam |
| Jatuh tempo ≤ 3 hari | Transaksi dengan batas kembali dalam 3 hari ke depan |
| Terlambat | Transaksi yang sudah melewati batas kembali |
| Rusak / hilang | Barang dengan status rusak, dalam perbaikan, atau hilang |

Daftar bisa dipersempit dengan pencarian, filter unit kerja, filter kategori, dan pilihan urutan. Tombol Kembalikan
pada setiap baris membuka form pengembalian untuk transaksi itu. Tombol Ekspor Excel mengunduh daftar yang sedang
tampil.

Setiap hari sistem memeriksa transaksi yang jatuh tempo secara otomatis, pada jam yang diatur Administrator
(bawaan pukul 08.00 WIB). Transaksi yang lewat batas diubah menjadi Terlambat, lalu email pengingat dikirim
sesuai jadwal berikut:

| Waktu | Penerima |
|---|---|
| H-3, H-1, hari H, dan H+1 | Peminjam |
| H+3 | Peminjam dan petugas |
| H+7 | Peminjam, petugas, dan pimpinan |

Pemeriksaan juga bisa dijalankan kapan saja dengan tombol Jalankan pemeriksaan. Pengingat yang sama tidak akan
dikirim dua kali untuk transaksi yang sama.

## 9. Notifikasi

Menu Notifikasi memiliki tiga tab:

- Riwayat notifikasi berisi semua email yang dibuat sistem. Klik salah satu baris untuk melihat isi emailnya.
- Log pengiriman berisi hasil pengiriman email, berhasil atau gagal.
- Jalannya scheduler berisi riwayat pemeriksaan jatuh tempo, baik yang otomatis maupun yang dijalankan manual.

Email yang gagal terkirim bisa dikirim lagi dengan tombol Kirim ulang di halaman pratinjau email.

## 10. QR / Barcode

Untuk mencari barang dengan QR, arahkan alat pemindai ke kolom pindai, atau ketik kode INV-... lalu tekan Enter.
Halaman detail barang akan terbuka.

Untuk mencetak label, pilih barang di bagian Pilih barang lalu klik Cetak label. Label yang sudah dicetak ditempel
pada barangnya.

## 11. Laporan

1. Buka menu Laporan, lalu pilih jenis laporan: Inventaris, Peminjaman, Pengembalian, Keterlambatan, atau Kerusakan &
   kehilangan.
2. Atur filter yang diperlukan, seperti periode, kategori, lokasi, atau unit kerja. Jika periode tidak diubah, semua
   periode akan ditampilkan.
3. Periksa tabel pratinjaunya, lalu unduh dalam bentuk PDF atau Excel, atau klik Cetak.

Laporan yang dicetak memuat kop instansi dan kolom tanda tangan pimpinan serta petugas.

## 12. Profil dan kata sandi

Klik nama Anda di bagian bawah sidebar untuk membuka halaman Profil Saya. Di halaman ini Anda bisa:

- Mengubah nama, email, dan nomor telepon, lalu klik Simpan profil.
- Mengganti kata sandi. Isi kata sandi lama dan kata sandi baru (minimal 8 karakter, terdiri dari huruf dan angka),
  lalu klik Simpan kata sandi. Akun Anda di perangkat lain akan otomatis logout.
- Melihat daftar hak akses yang dimiliki akun Anda.

## 13. Menu khusus Administrator

Pengguna & Role:

- Tambah pengguna dengan mengisi username, nama, email, role, dan kata sandi awal. Minta pengguna mengganti kata
  sandinya sendiri setelah login pertama.
- Nonaktifkan pengguna yang sudah tidak bertugas. Administrator terakhir tidak bisa dinonaktifkan.
- Tambah role baru atau ubah hak akses role yang sudah ada. Perubahan langsung berlaku.

Audit Log mencatat siapa melakukan apa dan kapan, lengkap dengan data sebelum dan sesudah diubah. Catatan ini bisa
disaring berdasarkan tanggal, pengguna, dan jenis tindakan, lalu diekspor ke Excel.

Pengaturan terdiri dari beberapa bagian:

| Bagian | Keterangan |
|---|---|
| Identitas & kontak | Nama instansi, unit Sarpras, kontak petugas, dan tempat pengembalian. Data ini dipakai di email dan dokumen cetak. |
| Server email (SMTP) | Alamat server, port, enkripsi, dan akun pengirim email. Gunakan tombol Kirim email uji untuk mengecek pengaturannya. |
| Template email | Isi email untuk setiap jenis pemberitahuan. Klik Simpan template setelah mengubah. |
| Aturan pengingat & eskalasi | Mengaktifkan atau menonaktifkan tiap pengingat dan menentukan penerimanya |
| Penjadwal (Celery Beat) | Jam pemeriksaan harian dan zona waktu |
| Keamanan, JWT & SSO | Lama sesi login dan pengaturan login SSO |
| Backup MariaDB | Membuat backup, mengunduh file backup, dan mencatat hasil uji restore |

Cara mengisi pengaturan SMTP dan SSO dijelaskan lebih lengkap di [PANDUAN-SSO-SMTP.md](PANDUAN-SSO-SMTP.md).

## 14. Masalah yang sering terjadi

### Email ke peminjam tidak terkirim

Cek alamat email peminjam di Master Data dan cek pengaturan SMTP. Penyebab gagalnya bisa dilihat di tab Log pengiriman pada menu Notifikasi. Setelah diperbaiki, kirim ulang emailnya dengan tombol Kirim ulang.

### Barang tidak muncul saat mencatat peminjaman

Hanya barang yang aktif dan berstatus Tersedia yang bisa dipinjam. Cek status barang di menu Inventaris.

### Barang sudah selesai diperbaiki tetapi belum bisa dipinjam

Buka detail barang di menu Inventaris, lalu ubah statusnya menjadi Tersedia.

### Transaksi sudah terlambat tetapi email pengingat belum terkirim

Pemeriksaan otomatis hanya berjalan sekali sehari. Klik Jalankan pemeriksaan di menu Monitoring untuk menjalankannya saat itu juga.

### Lupa kata sandi

Hubungi Administrator agar kata sandi Anda diatur ulang lewat menu Pengguna & Role.
