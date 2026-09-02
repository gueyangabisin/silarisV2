# API & DATA CONTRACT
*(Rujukan bersama — dipakai baik saat mendesain UI di Stitch maupun saat membangun backend di Antigravity, agar nama field & format data konsisten di kedua sisi)*

> **Cara pakai:** saat prompting Antigravity untuk membangun endpoint, tempel bagian relevan dari dokumen ini. Saat prompting Stitch untuk membuat komponen yang menampilkan/mengirim data, tempel juga bagian relevan ini supaya nama field yang dipakai di form/tabel cocok dengan yang backend harapkan.

## 1. Format Umum

* Semua response sukses: JSON, root object langsung berisi data (list endpoint pakai key `data` + metadata pagination).
* Semua response error: `{ "detail": "pesan error dalam Bahasa Indonesia yang ramah pengguna" }` (mengikuti konvensi FastAPI `HTTPException`).
* Semua timestamp: ISO 8601 string (`"2026-08-15T10:30:00"`).
* Status linen: string lowercase di database/API (`"tersedia"`, `"dikirim"`), **di-Title-Case hanya saat ditampilkan ke UI** (frontend yang melakukan formatting ini, atau backend mengirim keduanya — pilih salah satu dan konsisten; rekomendasi: backend kirim lowercase, frontend format sendiri).

## 2. Objek Data Utama

### 2.1 `Linen`
```json
{
  "linen_id": 101,
  "epc": "300833B2DDD9014000000001",
  "kategori_id": 1,
  "kategori": "Sprei",
  "nama_id": 5,
  "nama_linen": "Sprei Standard A",
  "status": "tersedia",
  "timestamp": "2026-08-15T09:00:00"
}
```

### 2.2 `RumahSakit`
```json
{
  "rs_id": "b3f1c2a0-....",
  "kode_rs": "RS001",
  "nama_rs": "RS Sentra Medika",
  "alamat": "Jl. Contoh No. 1",
  "kontak": "021-1234567",
  "email": "admin@rssentramedika.co.id"
}
```
*(Field `password` sengaja tidak disertakan dalam response API manapun ke frontend.)*

### 2.3 `PengirimanTemp` (antrean/draf)
```json
{
  "temp_id": 12,
  "kode_verifikasi": "VRF-8X92KQ",
  "rs_id": "b3f1c2a0-....",
  "nama_rs": "RS Sentra Medika",
  "daftar_epc": [
    { "epc": "300833B2DDD9014000000001", "nama_linen": "Sprei Standard A", "kategori": "Sprei" }
  ],
  "status_upload": "pending",
  "timestamp": "2026-08-15T09:00:00"
}
```

## 3. Endpoint — Detail Request/Response

### `GET /api/linen?page=1&limit=50&search=sprei`
Response:
```json
{
  "data": [ /* array of Linen */ ],
  "total_data": 320,
  "total_page": 7,
  "current_page": 1
}
```

### `GET /api/linen/{epc}`
Response 200 (sesuai contoh objek `Linen`, ditambah field opsional histori):
```json
{
  "epc": "300833B2DDD9014000000001",
  "nama_linen": "Sprei Standard A",
  "kategori": "Sprei",
  "status": "dikirim",
  "nama_rs": "RS Sentra Medika"
}
```
Response 404: `{ "detail": "Item belum terdaftar." }`

### `POST /api/pengiriman`
Request:
```json
{
  "rs_id": "b3f1c2a0-....",
  "daftar_epc": ["300833B2DDD9014000000001", "300833B2DDD9014000000002"]
}
```
Response 201:
```json
{
  "temp_id": 12,
  "kode_verifikasi": "VRF-8X92KQ",
  "status_upload": "pending"
}
```

### `GET /api/pengiriman/antrean-bermasalah`
Response: array `PengirimanTemp` dengan `status_upload = "gagal_permanen"`.

## 4. Format Pesan WebSocket (`/ws`)

**Server → Client, saat klien baru connect (state awal):**
```json
{
  "type": "init_state",
  "is_scanning_active": false,
  "serial_connected": true,
  "cloud_online": true
}
```

**Server → Client, saat EPC baru terbaca:**
```json
{ "type": "epc_detected", "epc": "300833B2DDD9014000000001", "rssi": "C9" }
```

**Server → Client, error sensor:**
```json
{ "type": "error", "message": "Gagal membuka port serial." }
```

**Client → Server, kontrol scan:**
```json
{ "type": "start_inventory" }
```
```json
{ "type": "stop_inventory" }
```

**Server → Client, broadcast perubahan state (dipicu klien manapun):**
```json
{ "type": "scan_state_changed", "is_scanning_active": true }
```

## 5. Aturan Penamaan (Konsistensi Wajib)

* Semua field pakai `snake_case`, bukan `camelCase` (menyesuaikan konvensi Python/FastAPI).
* ID selalu bernama `{entity}_id` (`linen_id`, `rs_id`, `temp_id`), bukan generik `id`.
* Status selalu string lowercase Bahasa Indonesia (`tersedia`, `dikirim`, `pending`, `gagal_permanen`) — Stitch **tidak perlu** membuat versi Inggris/enum lain untuk internal state, cukup format tampilan (Title Case) di lapisan UI.
