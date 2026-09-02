# BACKEND FOUNDATION SPEC — Sistem Informasi RFID Produsen Linen
*(Untuk digunakan sebagai spesifikasi awal implementasi di Antigravity)*

> Dokumen ini menerjemahkan `masterplan_sistem_rfid_linen_v2.md` menjadi spesifikasi teknis siap-implementasi. Jika ada detail yang kurang jelas saat coding, rujuk kembali dokumen masterplan sebagai sumber kebenaran utama.

## 1. Tech Stack & Struktur Proyek

* **Backend:** FastAPI (Python 3.11+)
* **DB Lokal:** SQLite + SQLAlchemy ORM + **Alembic** untuk migrasi
* **DB Cloud:** Supabase (diakses via REST API menggunakan `httpx`, bukan SDK Supabase-py, agar kontrol timeout eksplisit)
* **Hardware:** `pyserial` untuk komunikasi port COM
* **Realtime:** WebSocket native FastAPI (`fastapi.WebSocket`)

### 1.1 Struktur Folder yang Disarankan
```
backend/
├── app/
│   ├── main.py                 # entrypoint, lifespan hook (startup sync + sync_loop worker)
│   ├── config.py                # load .env (SUPABASE_URL, SUPABASE_ANON_KEY, ALLOWED_DRIVERS)
│   ├── database/
│   │   ├── models.py             # SQLAlchemy models (lihat Bagian 2)
│   │   ├── session.py            # DB session/engine setup
│   │   └── migrations/           # folder Alembic
│   ├── routers/
│   │   ├── linen.py               # CRUD + lookup + pagination (Usecase 1,2,3)
│   │   ├── pengiriman.py          # inisialisasi pengiriman, antrean bermasalah (Usecase 5)
│   │   ├── scan.py                # REST start/stop scan
│   │   ├── ports.py               # GET /api/ports
│   │   ├── sync.py                # POST /api/sync/rs
│   │   └── cloud_admin.py         # proxy CRUD rumah_sakit & histori pengiriman (Usecase 4)
│   ├── services/
│   │   ├── serial_service.py      # koneksi & parsing frame RFID (lihat Bagian 4)
│   │   ├── sync_service.py        # sync_down_rumah_sakit(), heartbeat, sync_loop worker
│   │   └── websocket_manager.py   # broadcast ke semua klien terhubung
│   ├── schemas/                    # Pydantic models request/response
│   └── websocket.py               # endpoint /ws, handle START_SCAN/STOP_SCAN
├── .env.example
├── alembic.ini
└── requirements.txt
```

## 2. Skema Database (DDL Referensi)

### 2.1 SQLite Lokal

```sql
CREATE TABLE kategori_linen (
    kategori_id INTEGER PRIMARY KEY AUTOINCREMENT,
    nama_kategori TEXT NOT NULL,
    keterangan TEXT
);

CREATE TABLE nama_linen (
    nama_id INTEGER PRIMARY KEY AUTOINCREMENT,
    kategori_id INTEGER NOT NULL REFERENCES kategori_linen(kategori_id),
    nama_linen TEXT NOT NULL,
    keterangan TEXT
);

CREATE TABLE linen (
    linen_id INTEGER PRIMARY KEY AUTOINCREMENT,
    epc TEXT NOT NULL UNIQUE,
    kategori_id INTEGER NOT NULL REFERENCES kategori_linen(kategori_id),
    nama_id INTEGER NOT NULL REFERENCES nama_linen(nama_id),
    status TEXT NOT NULL DEFAULT 'tersedia' CHECK (status IN ('tersedia', 'dikirim')),
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Read-only, hasil sync down dari cloud
CREATE TABLE rumah_sakit (
    rs_id TEXT PRIMARY KEY,          -- UUID dari cloud
    kode_rs TEXT,
    nama_rs TEXT,
    email TEXT,
    password TEXT,                    -- hash, sync down apa adanya, TIDAK ditampilkan di UI
    alamat TEXT,
    kontak TEXT,
    timestamp DATETIME
);

-- Buffer offline pengiriman (desain final)
CREATE TABLE pengiriman_temp (
    temp_id INTEGER PRIMARY KEY AUTOINCREMENT,
    kode_verifikasi TEXT NOT NULL UNIQUE,
    rs_id TEXT NOT NULL REFERENCES rumah_sakit(rs_id),
    daftar_epc TEXT NOT NULL,          -- JSON array, lihat format di Bagian 3 API Contract
    status_upload TEXT NOT NULL DEFAULT 'pending' CHECK (status_upload IN ('pending', 'gagal_permanen')),
    percobaan_ke INTEGER NOT NULL DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 2.2 Supabase Cloud (referensi, dikelola via Supabase dashboard/migration terpisah)

```sql
-- rumah_sakit, pengiriman, linen — lihat 02_skema_database.md untuk kolom lengkap
-- relasi: rumah_sakit (1) -> pengiriman (N) -> linen (N)
```

## 3. Kontrak Endpoint REST API (Ringkasan)

> Untuk kontrak lengkap request/response JSON dan format pesan WebSocket, rujuk dokumen terpisah `03_api_data_contract.md` — dokumen ini dipakai bersama oleh tim/AI yang mengerjakan frontend (Stitch) agar konsisten.

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | `/api/ports` | List port serial yang lolos whitelist driver |
| POST | `/api/scan/start` | Aktifkan mode scanning (alternatif WebSocket) |
| POST | `/api/scan/stop` | Nonaktifkan mode scanning |
| GET | `/api/linen` | List linen, dengan `page`, `limit`, `search` |
| GET | `/api/linen/{epc}` | Lookup detail 1 item by EPC |
| POST | `/api/linen` | Daftarkan item baru |
| PUT/DELETE | `/api/linen/{linen_id}` | Edit/hapus item |
| CRUD | `/api/kategori-linen`, `/api/nama-linen` | Manajemen master data lokal |
| POST | `/api/pengiriman` | Inisialisasi pengiriman baru (masuk ke `pengiriman_temp`) |
| GET | `/api/pengiriman/antrean-bermasalah` | List baris `status_upload = 'gagal_permanen'` |
| POST | `/api/pengiriman/{temp_id}/retry` | Coba upload ulang manual |
| POST | `/api/pengiriman/{temp_id}/batalkan` | Batalkan, kembalikan status item ke tersedia |
| POST | `/api/sync/rs` | Sync down manual data rumah_sakit dari cloud |
| CRUD | `/api/cloud/rs` | Proxy CRUD rumah sakit ke Supabase (Usecase 4b) |
| GET | `/api/cloud/pengiriman` | Histori pengiriman dari cloud (dengan filter tanggal + pagination) |
| GET | `/api/cloud/pengiriman/{id}/detail` | Detail linen dalam satu pengiriman |
| WS | `/ws` | Koneksi realtime: broadcast EPC scan, status koneksi, kontrol START/STOP |

## 4. Logika Inti yang Wajib Diimplementasikan Sesuai Urutan Prioritas

Urutan ini disusun agar fondasi (hardware + realtime) selesai duluan sebelum fitur bisnis dibangun di atasnya:

1. **Serial service dasar** — buka port, kirim Start/Stop Inventory command (`BB 00 27...` / `BB 00 28...`), baca & validasi frame (Header `BB`...End `7E` + **cek CRC**, lihat Bagian 4.1).
2. **Software gate `is_scanning_active`** (global) — abaikan frame saat idle, bersihkan buffer berkala.
3. **De-duplikasi EPC** — debounce ~1-2 detik per EPC sebelum broadcast.
4. **WebSocket manager** — broadcast ke semua klien, kirim state awal saat klien baru connect (lihat Bagian 5.2 masterplan).
5. **Whitelisting port serial** (`ALLOWED_DRIVERS`, dari `.env`).
6. **Model & CRUD dasar** — `Linen`, `Kategori_Linen`, `Nama_Linen`, dengan Unique Constraint EPC + endpoint pagination.
7. **Sync down `rumah_sakit`** — startup event + endpoint manual.
8. **Alur pengiriman + `pengiriman_temp`** — termasuk generate `kode_verifikasi` lokal, update status optimis.
9. **Sync worker (`sync_loop`)** — cek antrean tiap 30 detik, upload 2 langkah (header→detail) + rollback + retry counter + `gagal_permanen` setelah N percobaan.
10. **Admin cloud proxy** — CRUD rumah sakit & histori pengiriman, dengan FK-violation handling (409 → 400 pesan ramah).

### 4.1 Contoh Validasi CRC (referensi pseudocode)
```python
def validate_crc(frame_bytes: bytes) -> bool:
    # CRC = checksum dari Type..Parameter (byte index 1 sampai sebelum CRC), ambil LSB
    payload = frame_bytes[1:-2]  # exclude Header(BB) dan CRC+End
    calculated = sum(payload) & 0xFF
    received_crc = frame_bytes[-2]
    return calculated == received_crc
```
*(Sesuaikan dengan spesifikasi CRC persis dari datasheet EL-UHF-RMT01 saat implementasi — pseudocode ini hanya ilustrasi checksum sederhana.)*

## 5. Environment Variables (`.env.example`)

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
ALLOWED_DRIVERS=cp210
SYNC_LOOP_INTERVAL_SECONDS=30
SYNC_MAX_RETRY_BEFORE_PERMANENT_FAIL=10
HTTPX_TIMEOUT_SYNC_SECONDS=10
HTTPX_TIMEOUT_ADMIN_SECONDS=15
DATABASE_URL=sqlite:///./local.db
```

## 6. Migrasi Database

* Gunakan Alembic sejak commit pertama (`alembic init migrations`).
* Setiap perubahan model SQLAlchemy → generate revision (`alembic revision --autogenerate -m "..."`) → commit revision script bersama kode.
* **Jangan** pernah edit langsung file `local.db` di lingkungan produksi/gudang.

## 7. Deployment (Catatan untuk Setup, Bukan untuk Dikodekan)

* Server dijalankan via Task Scheduler ("At log on") atau Startup Folder Windows — bukan Windows Service.
* Pastikan auto-login user tertentu di komputer server jika ingin service aktif tanpa intervensi manual tiap pagi.
* Ini adalah bagian konfigurasi OS, bukan bagian dari codebase, tapi perlu dicatat sebagai SOP terpisah.

## 8. Checklist Kesiapan Sebelum Mulai di Antigravity

- [ ] Project Supabase sudah dibuat, tabel `rumah_sakit`, `pengiriman`, `linen` sudah ada di cloud
- [ ] `SUPABASE_URL` & `SUPABASE_ANON_KEY` sudah didapat
- [ ] Data dummy minimal 2-3 baris `rumah_sakit` sudah ada di cloud (untuk testing sync down)
- [ ] Sensor EL-UHF-RMT01 tersedia untuk testing, atau siapkan mock/simulator data serial jika belum ada hardware saat mulai coding (lihat Bagian "Hal Lain yang Perlu Disiapkan" di percakapan)
