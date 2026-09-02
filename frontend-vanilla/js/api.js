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

async function getNamaLinenList() {
    return _fetch('/api/nama-linen');
}

// ─── Linen ────────────────────────────────────────────────

async function getLinenList(page = 1, limit = 50, search = '') {
    const params = new URLSearchParams({ page, limit, search });
    return _fetch(`/api/linen?${params}`);
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
    // Linen
    getLinenList,
    // Ports
    getSerialPorts,
    openSerialPort,
};
