/**
 * RFID Linen Pro — REST API Wrapper
 *
 * Centralised fetch helpers for all backend endpoints.
 * Response parsing follows the API contract: plain arrays for
 * kategori/nama-linen, wrapped {data,...} for linen/pengiriman.
 */

const API_BASE = `http://${location.hostname}:8000`;

// ─── Generic Fetch Helper ─────────────────────────────────

/**
 * Internal fetch wrapper with standard error handling.
 * Returns parsed JSON on success, throws on HTTP error.
 *
 * @param {string} path   e.g. '/api/kategori'
 * @param {RequestInit} [options]
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
async function _fetch(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const defaultHeaders = { 'Content-Type': 'application/json' };

    const resp = await fetch(url, {
        ...options,
        headers: { ...defaultHeaders, ...options.headers },
    });

    let body;
    try {
        body = await resp.json();
    } catch {
        body = null;
    }

    return { ok: resp.ok, status: resp.status, data: body };
}

// ─── Kategori Linen ───────────────────────────────────────

/**
 * GET /api/kategori — returns plain array of kategori objects.
 */
async function getKategoriList() {
    return _fetch('/api/kategori');
}

/**
 * POST /api/kategori — create new kategori.
 * @param {{ nama: string, keterangan?: string|null }} payload
 */
async function createKategori(payload) {
    return _fetch('/api/kategori', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

/**
 * PUT /api/kategori/{id} — update kategori.
 * @param {number} id
 * @param {{ nama?: string, keterangan?: string|null }} payload
 */
async function updateKategori(id, payload) {
    return _fetch(`/api/kategori/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
}

/**
 * DELETE /api/kategori/{id} — delete kategori.
 * @param {number} id
 */
async function deleteKategori(id) {
    return _fetch(`/api/kategori/${id}`, {
        method: 'DELETE',
    });
}

// ─── Dashboard ────────────────────────────────────────────

async function getDashboardSummary() {
    return _fetch('/api/dashboard/summary');
}

// ─── Nama Linen ───────────────────────────────────────────

/**
 * GET /api/nama-linen — returns plain array of nama linen objects.
 * @param {number|null} [kategoriId]
 */
async function getNamaLinenList(kategoriId = null) {
    const url = kategoriId ? `/api/nama-linen?kategori_id=${kategoriId}` : '/api/nama-linen';
    return _fetch(url);
}

async function createNamaLinen(payload) {
    return _fetch('/api/nama-linen', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

async function updateNamaLinen(id, payload) {
    return _fetch(`/api/nama-linen/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
}

async function deleteNamaLinen(id) {
    return _fetch(`/api/nama-linen/${id}`, {
        method: 'DELETE',
    });
}

// ─── Linen ────────────────────────────────────────────────

/**
 * GET /api/linen — returns wrapped object { data, total_data, total_page, current_page }
 */
async function getLinenList(page = 1, limit = 50, search = '', status = '', kategoriId = null) {
    const params = new URLSearchParams({ page, limit });
    if (search) params.append('search', search);
    if (status) params.append('status', status);
    if (kategoriId) params.append('kategori_id', kategoriId);
    return _fetch(`/api/linen?${params}`);
}

async function createLinen(payload) {
    return _fetch('/api/linen', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

async function updateLinen(epc, payload) {
    return _fetch(`/api/linen/${epc}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
}

async function deleteLinen(epc) {
    return _fetch(`/api/linen/${epc}`, {
        method: 'DELETE',
    });
}

/**
 * GET /api/linen/{epc} — get single linen by EPC.
 * Returns 404 {detail} if not found.
 * @param {string} epc
 */
async function getLinenByEpc(epc) {
    return _fetch(`/api/linen/${encodeURIComponent(epc)}`);
}

// ─── Admin Cloud — Rumah Sakit ────────────────────────────

async function getRumahSakitList() {
    return _fetch('/api/rumah-sakit');
}

async function createRumahSakit(payload) {
    return _fetch('/api/rumah-sakit', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

async function updateRumahSakit(id, payload) {
    return _fetch(`/api/rumah-sakit/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
    });
}

async function deleteRumahSakit(id) {
    return _fetch(`/api/rumah-sakit/${id}`, {
        method: 'DELETE',
    });
}

// ─── Admin Cloud — Histori Pengiriman ─────────────────────

async function getHistoriPengiriman({ start_date = '', end_date = '', page = 1, limit = 50 } = {}) {
    const params = new URLSearchParams({ page, limit });
    if (start_date) params.append('start_date', start_date);
    if (end_date) params.append('end_date', end_date);
    return _fetch(`/api/pengiriman/histori?${params}`);
}

async function getDetailPengiriman(pengirimanId) {
    return _fetch(`/api/pengiriman/histori/${pengirimanId}`);
}

// ─── Pengiriman — Antrean Bermasalah ──────────────────────

async function getAntreanBermasalah() {
    return _fetch('/api/pengiriman/antrean-bermasalah');
}

async function retryPengiriman(tempId) {
    return _fetch(`/api/pengiriman/${tempId}/coba-lagi`, {
        method: 'POST',
    });
}

async function cancelPengiriman(tempId) {
    return _fetch(`/api/pengiriman/${tempId}/batalkan`, {
        method: 'POST',
    });
}

/**
 * POST /api/pengiriman — create a new shipment.
 * @param {{ rs_id: number, daftar_epc: string[] }} payload
 */
async function createPengiriman(payload) {
    return _fetch('/api/pengiriman', {
        method: 'POST',
        body: JSON.stringify(payload),
    });
}

// ─── Ports ────────────────────────────────────────────────

async function getSerialPorts() {
    return _fetch('/api/ports');
}

async function openSerialPort(port) {
    return _fetch('/api/ports/open', {
        method: 'POST',
        body: JSON.stringify({ port }),
    });
}

// ─── Export ───────────────────────────────────────────────

export const api = {
    API_BASE,
    // Kategori
    getKategoriList,
    createKategori,
    updateKategori,
    deleteKategori,
    // Dashboard
    getDashboardSummary,
    // Nama Linen
    getNamaLinenList,
    createNamaLinen,
    updateNamaLinen,
    deleteNamaLinen,
    // Linen
    getLinenList,
    createLinen,
    updateLinen,
    deleteLinen,
    getLinenByEpc,
    // Rumah Sakit
    getRumahSakitList,
    createRumahSakit,
    updateRumahSakit,
    deleteRumahSakit,
    // Histori Pengiriman
    getHistoriPengiriman,
    getDetailPengiriman,
    // Antrean Bermasalah
    getAntreanBermasalah,
    retryPengiriman,
    cancelPengiriman,
    // Pengiriman
    createPengiriman,
    // Ports
    getSerialPorts,
    openSerialPort,
};


