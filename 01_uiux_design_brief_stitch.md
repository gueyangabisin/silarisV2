# UI/UX DESIGN BRIEF — Sistem Informasi RFID Produsen Linen
*(Untuk digunakan sebagai prompt/brief di Google Stitch)*

## 1. Konteks Produk

Aplikasi web internal untuk operator gudang produsen linen. Dipakai di lingkungan gudang/produksi (bukan aplikasi konsumen), dibuka di **Chrome browser** pada komputer/tablet yang terhubung ke jaringan lokal yang sama dengan server. Tidak ada layar login (sistem tanpa autentikasi — lihat Bagian 8).

**Karakter pengguna:** operator gudang, bekerja cepat, sering multitasking sambil memegang barang fisik (linen) dan alat scan. UI harus **mengutamakan kejelasan status dan kecepatan aksi**, bukan estetika dekoratif.

## 2. Prinsip Desain

* **Status selalu terlihat.** Tiga indikator koneksi (Sensor RFID, WebSocket, Cloud/Internet) harus selalu tampak di area header di semua halaman — lihat Bagian 4.
* **Feedback instan.** Setiap scan/aksi harus memberi respons visual jelas dalam <1 detik (highlight baris, badge warna, toast).
* **Warna sebagai bahasa status**, konsisten di seluruh aplikasi:
  * Hijau = terhubung / sukses / tersedia
  * Merah = terputus / error / gagal
  * Kuning/Oranye = peringatan / perlu perhatian / pending
  * Abu-abu = idle / netral
* **Kepadatan tinggi tapi terbaca.** Banyak data tabular (daftar EPC, daftar linen) — gunakan tabel yang rapat namun tetap nyaman dibaca, bukan card besar yang boros ruang.
* **Layout desktop-first.** Target utama adalah layar komputer/monitor gudang (bukan mobile-first), meski tetap harus tetap wajar dilihat di tablet.

## 3. Arsitektur Informasi (Struktur Navigasi)

Navigasi utama berupa sidebar atau top-nav dengan 5 menu utama:

1. **Dashboard / Beranda**
2. **Pendaftaran Item**
3. **Pengecekan Item**
4. **Manajemen Data Lokal** (sub-menu: Linen, Kategori Linen, Nama Linen)
5. **Pengiriman** (sub-menu: Kirim Barang, Antrean Bermasalah)
6. **Admin Cloud** (sub-menu: Rumah Sakit, Histori Pengiriman)

## 4. Elemen Global (Muncul di Semua Halaman)

### 4.1 Header Status Bar
Tiga indikator kecil (ikon + label singkat), selalu terlihat:
* **Sensor RFID:** Terhubung (hijau) / Terputus (merah)
* **Realtime (WebSocket):** Aktif (hijau) / Reconnecting (kuning, animasi) / Terputus (merah)
* **Cloud/Internet:** Online (ikon awan hijau) / Offline (ikon awan merah bersilang)

### 4.2 Tombol Kontrol Scan Global
Tombol besar "Mulai Scan" / "Hentikan Scan" (toggle, warna berubah sesuai state) — biasanya ditempatkan di header atau area yang mudah dijangkau, karena dipakai di banyak halaman (Pendaftaran, Pengecekan, Pengiriman).

### 4.3 Komponen Notifikasi (desain visualnya saja — logika sudah ada di dokumen error handling)
* **Banner sticky merah** (full-width, di bawah header) — untuk error kritis seperti sensor terputus.
* **Toast** (pojok layar, auto-dismiss) — untuk notifikasi ringan (tag terbaca, mode offline aktif, dsb). Perlu varian warna: hijau (sukses), kuning (peringatan), merah (error).
* **Modal dialog** (tengah layar, dengan overlay gelap) — untuk konfirmasi/error yang butuh perhatian penuh (misal gagal hapus data karena relasi).
* **Overlay reconnect** — layar meredup dengan spinner + teks, dipakai saat WebSocket terputus.

## 5. Rincian per Halaman

### 5.1 Dashboard / Beranda
* Ringkasan angka: total linen terdaftar, jumlah per status (tersedia/dikirim), jumlah baris di Antrean Bermasalah (badge merah jika >0).
* Tidak perlu grafik kompleks — cukup kartu ringkasan (summary cards).

### 5.2 Pendaftaran Item (Usecase 1)
* Panel scan aktif menampilkan daftar EPC yang baru terbaca secara real-time (list yang terus bertambah ke atas).
* Setiap baris EPC baru: dropdown/select untuk pilih Kategori & Nama Linen, tombol "Daftarkan".
* Baris yang EPC-nya sudah pernah terdaftar (duplikat) tampil dengan highlight merah + teks "Tag sudah terdaftar" (nonaktif, tidak bisa didaftarkan ulang).
* Baris yang berhasil didaftarkan berubah warna hijau sesaat lalu tetap di list dengan badge "Terdaftar".

### 5.3 Pengecekan Item (Usecase 2)
* Mode scan tunggal: begitu satu tag terbaca, langsung tampilkan panel detail item (nama, kategori, status, riwayat RS tujuan jika sudah dikirim) — format kartu/detail panel di sisi kanan atau modal.
* Jika EPC tidak ditemukan (404) → tampilkan pesan jelas: "Item belum terdaftar".

### 5.4 Manajemen Data Lokal (Usecase 3)
Tiga tab/sub-halaman dengan pola UI yang sama (tabel data + CRUD):
* **Linen:** tabel dengan kolom EPC, Kategori, Nama, Status, aksi Edit/Hapus. **Wajib ada search bar + kontrol pagination** (mengikuti keputusan paginasi ~50 baris/halaman).
* **Kategori Linen** & **Nama Linen:** tabel CRUD sederhana (nama, keterangan).
* Tombol "Tambah Data" (buka form/modal) di setiap tab.
* Aksi hapus yang gagal (karena data masih dipakai) memicu modal error (lihat 4.3).

### 5.5 Pengiriman (Usecase 5)

**5.5.1 Kirim Barang**
* Langkah 1: pilih Rumah Sakit tujuan (dropdown/search dari data `rumah_sakit` lokal).
* Langkah 2: aktifkan scan, daftar EPC yang terbaca terkumpul jadi daftar "Item Akan Dikirim" (dengan opsi hapus per-item dari daftar sebelum submit).
* Tombol "Proses Pengiriman" — setelah ditekan, tampilkan kode verifikasi yang dihasilkan dan konfirmasi bahwa data disimpan (dengan catatan status upload: langsung sukses / masuk antrean karena offline).

**5.5.2 Antrean Bermasalah**
* Tabel baris `pengiriman_temp` berstatus `gagal_permanen`: kode verifikasi, RS tujuan, jumlah item, waktu.
* Dua tombol aksi per baris: "Coba Lagi" dan "Batalkan Pengiriman" (dengan konfirmasi modal sebelum eksekusi, karena Batalkan mengubah status item kembali ke tersedia).

### 5.6 Admin Cloud

**5.6.1 Manajemen Rumah Sakit**
* Tabel CRUD standar (Kode RS, Nama RS, Alamat, Kontak, Email) — kolom `password` **tidak ditampilkan** di UI manapun (write-only/hidden, hanya relevan untuk sistem lain).
* Form tambah/edit RS.

**5.6.2 Histori Pengiriman**
* Tabel riwayat pengiriman dari cloud: kode verifikasi, RS tujuan, tanggal, jumlah linen, status.
* Filter tanggal (start/end date) di atas tabel + pagination.
* Klik baris → buka halaman/modal detail berisi daftar linen yang dikirim pada transaksi tersebut.

## 6. States yang Wajib Didesain per Komponen Scan-Related

Untuk setiap panel yang melibatkan scanning (Pendaftaran, Pengecekan, Kirim Barang), siapkan state visual berikut:
* **Idle** (scan belum dimulai)
* **Scanning aktif** (indikator animasi/pulsing menunjukkan sedang mendengarkan)
* **Sensor terputus** (banner merah + panel scan nonaktif)
* **Kosong/belum ada hasil** (empty state yang jelas, bukan halaman kosong tanpa keterangan)

## 7. Non-Goals (Sengaja Tidak Didesain)

* Tidak ada halaman/flow **login** (sistem tanpa autentikasi).
* Tidak ada status atau flow **"rusak"** pada item linen.
* Tidak ada flow **retur/pengembalian** barang.
* Tidak perlu desain versi mobile-native — cukup wajar dilihat di tablet/browser, prioritas tetap desktop.

## 8. Referensi Data untuk Mock Content di Stitch

Gunakan data contoh berikut saat mengisi mock content agar realistis:
* Kategori: Sprei, Selimut, Handuk, Sarung Bantal
* Nama linen: "Sprei Standard A", "Selimut Fleece B", dst.
* Status: `Tersedia`, `Dikirim`
* Contoh EPC: format 24 karakter hex, misal `300833B2DDD9014000000001`
* Nama RS contoh: "RS Sentra Medika", "RS Harapan Bunda"
