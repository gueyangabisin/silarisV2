/**
 * RFID Linen Pro — Common JavaScript Module
 * Handles API fetch wrappers, global WebSocket status bar, reconnect overlay, error modals, and formatting.
 */

const API_BASE = "http://localhost:8000";
const WS_BASE = "ws://localhost:8000/ws";

// State
let ws = null;
let isScanningActive = false;
let serialConnected = false;
let cloudOnline = false;
let wsSubscribers = [];
let reconnectAttempts = 0;
let reconnectTimer = null;

/**
 * Initialize global WebSocket for status header & live events
 */
function initGlobalWebSocket() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
    }

    try {
        ws = new WebSocket(WS_BASE);

        ws.onopen = () => {
            console.log("[WS] Connected to", WS_BASE);
            reconnectAttempts = 0;
            hideReconnectOverlay();
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                handleGlobalWSMessage(data);

                // Notify page-specific subscribers
                wsSubscribers.forEach(cb => cb(data));
            } catch (e) {
                console.error("[WS] Error parsing message:", e);
            }
        };

        ws.onclose = () => {
            console.log("[WS] Disconnected from server.");
            handleWSDisconnect();
        };

        ws.onerror = (err) => {
            console.error("[WS] Connection Error:", err);
            handleWSDisconnect();
        };
    } catch (e) {
        console.error("[WS] Connection setup failed:", e);
        handleWSDisconnect();
    }
}

/**
 * Handle WebSocket Disconnection & Reconnect Overlay (Issue D)
 */
function handleWSDisconnect() {
    // 1. Set badges to RED OFF
    updateHeaderBadges(false, false, false);

    // 2. Show Reconnect Overlay
    reconnectAttempts++;
    showReconnectOverlay(reconnectAttempts > 10);

    // 3. Schedule retry every 3 seconds
    if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            initGlobalWebSocket();
        }, 3000);
    }
}

/**
 * Show Reconnect Overlay (Issue D)
 */
function showReconnectOverlay(isPersistentFail = false) {
    let overlay = document.getElementById("ws-reconnect-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "ws-reconnect-overlay";
        overlay.className = "fixed inset-0 z-[180] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 transition-all";
        document.body.appendChild(overlay);
    }

    const messageText = isPersistentFail
        ? "Tidak dapat terhubung ke server. Periksa koneksi backend."
        : "Menghubungkan kembali ke server...";

    overlay.innerHTML = `
        <div class="bg-surface/90 backdrop-blur-2xl border border-glass-border rounded-2xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center gap-4 text-center">
            <div class="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <h3 class="font-headline-md text-headline-md font-bold text-primary">Koneksi Server Terputus</h3>
            <p class="font-body-md text-on-surface-variant">${messageText}</p>
        </div>
    `;
}

/**
 * Hide Reconnect Overlay
 */
function hideReconnectOverlay() {
    const overlay = document.getElementById("ws-reconnect-overlay");
    if (overlay) overlay.remove();
}

/**
 * Subscribe page-specific callbacks to WebSocket events
 */
function subscribeWS(callback) {
    wsSubscribers.push(callback);
}

/**
 * Send command to WebSocket server
 */
function sendWSCommand(commandObj) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(commandObj));
    } else {
        showErrorToast("Koneksi WebSocket belum terhubung.");
    }
}

/**
 * Global WS Message Handler for Header Badges & Connection Toasts
 */
function handleGlobalWSMessage(data) {
    if (data.type === "init_state") {
        isScanningActive = data.is_scanning_active;
        serialConnected = data.serial_connected;
        cloudOnline = data.cloud_online;
        updateHeaderBadges(serialConnected, cloudOnline, isScanningActive);
    } else if (data.type === "connection_state") {
        serialConnected = data.serial_connected;
        cloudOnline = data.cloud_online;
        updateHeaderBadges(serialConnected, cloudOnline, isScanningActive);
    } else if (data.type === "scan_state_changed") {
        isScanningActive = data.is_scanning_active;
        updateHeaderBadges(serialConnected, cloudOnline, isScanningActive);
    } else if (data.type === "serial_connected_info") {
        // Issue C: GREEN TOAST on port connection success
        showSuccessToast(data.message || `Sensor berhasil terhubung di ${data.port}`);
        serialConnected = true;
        updateHeaderBadges(true, cloudOnline, isScanningActive);
    } else if (data.type === "error") {
        showStickyErrorBanner(data.message);
        serialConnected = false;
        updateHeaderBadges(false, cloudOnline, isScanningActive);
    }
}

/**
 * Update Header Status Badges in DOM
 */
function updateHeaderBadges(readerConnected, isCloudOnline, isScanning) {
    const readerBadge = document.getElementById("header-reader-badge");
    const cloudBadge = document.getElementById("header-cloud-badge");

    if (readerBadge) {
        if (isScanning) {
            readerBadge.innerHTML = `
                <span class="w-2 h-2 rounded-full bg-status-warning animate-ping"></span>
                <span class="text-label-sm font-label-sm text-on-surface font-semibold">Scanning...</span>
            `;
        } else if (readerConnected) {
            readerBadge.innerHTML = `
                <span class="w-2 h-2 rounded-full bg-status-success"></span>
                <span class="text-label-sm font-label-sm text-on-surface font-semibold">Reader ON</span>
            `;
        } else {
            readerBadge.innerHTML = `
                <span class="w-2 h-2 rounded-full bg-status-error"></span>
                <span class="text-label-sm font-label-sm text-on-surface font-semibold">Reader OFF</span>
            `;
        }
    }

    if (cloudBadge) {
        if (isCloudOnline) {
            cloudBadge.innerHTML = `
                <span class="w-2 h-2 rounded-full bg-status-success"></span>
                <span class="text-label-sm font-label-sm text-on-surface font-semibold">Cloud DB ON</span>
            `;
        } else {
            cloudBadge.innerHTML = `
                <span class="w-2 h-2 rounded-full bg-status-error"></span>
                <span class="text-label-sm font-label-sm text-on-surface font-semibold">Cloud DB OFF</span>
            `;
        }
    }
}

/**
 * Helper to populate Sensor Port dropdown (Issue C)
 */
async function loadPortSelector(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;

    try {
        const resp = await fetch(`${API_BASE}/api/ports`);
        const ports = await resp.json();

        if (!ports || ports.length === 0) {
            select.innerHTML = `<option value="">Tidak ada sensor terdeteksi</option>`;
            select.disabled = true;
            return;
        }

        select.disabled = false;
        select.innerHTML = `<option value="">-- Pilih Port Sensor --</option>` +
            ports.map(p => `<option value="${p.port}">${p.port} - ${p.description}</option>`).join("");
    } catch (e) {
        console.error("Error loading serial ports:", e);
        select.innerHTML = `<option value="">Gagal memuat port</option>`;
    }
}

/**
 * Switch/open serial port manually via API (Issue C)
 */
async function switchPort(portName) {
    if (!portName) return;
    try {
        const resp = await fetch(`${API_BASE}/api/ports/open`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ port: portName })
        });
        const res = await resp.json();
        if (!resp.ok) {
            showErrorModal("Gagal Membuka Port", res.detail || `Gagal terhubung ke ${portName}`);
        }
    } catch (e) {
        showErrorModal("Error", "Gagal menghubungi server.");
    }
}

/**
 * Display Sticky Error Banner at top of page
 */
function showStickyErrorBanner(message) {
    let banner = document.getElementById("sticky-error-banner");
    if (!banner) {
        banner = document.createElement("div");
        banner.id = "sticky-error-banner";
        banner.className = "fixed top-0 left-0 right-0 z-[100] bg-status-error text-white text-center py-2 px-4 font-label-md shadow-md flex items-center justify-center gap-2";
        document.body.prepend(banner);
    }
    banner.innerHTML = `
        <span class="material-symbols-outlined text-[18px]">warning</span>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" class="ml-4 text-white/80 hover:text-white">&times;</button>
    `;
}

/**
 * Display Toast Notification
 */
function showToast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
        container = document.createElement("div");
        container.id = "toast-container";
        container.className = "fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none";
        document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    let bg = "bg-primary text-white";
    if (type === "success") bg = "bg-status-success text-white";
    if (type === "error") bg = "bg-status-error text-white";
    if (type === "warning") bg = "bg-status-warning text-black";

    toast.className = `${bg} px-4 py-3 rounded-xl shadow-lg font-label-md flex items-center gap-2 pointer-events-auto transition-all transform translate-y-2 opacity-0`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove("translate-y-2", "opacity-0");
    });

    setTimeout(() => {
        toast.classList.add("opacity-0", "translate-y-2");
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function showErrorToast(msg) {
    showToast(msg, "error");
}

function showSuccessToast(msg) {
    showToast(msg, "success");
}

/**
 * Display Error Modal dialog with detail message
 */
function showErrorModal(title, detailMessage) {
    let modal = document.getElementById("global-error-modal");
    if (!modal) {
        modal = document.createElement("div");
        modal.id = "global-error-modal";
        modal.className = "fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4";
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="bg-surface/90 backdrop-blur-2xl border border-glass-border rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 text-on-surface">
            <div class="flex items-center gap-3 text-status-error">
                <span class="material-symbols-outlined text-[28px]">error</span>
                <h3 class="font-headline-md text-headline-md font-bold">${title}</h3>
            </div>
            <p class="font-body-md text-body-md text-on-surface-variant">${detailMessage}</p>
            <div class="flex justify-end mt-2">
                <button onclick="document.getElementById('global-error-modal').remove()" class="bg-primary text-on-primary font-label-lg px-6 py-2 rounded-full hover:bg-primary/90 transition-colors">Tutup</button>
            </div>
        </div>
    `;
}

/**
 * Format status string to Title Case for UI display
 */
function formatTitleCase(str) {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Format ISO 8601 date string to human-readable format
 */
function formatDateTime(isoString) {
    if (!isoString) return "-";
    try {
        const d = new Date(isoString);
        return d.toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch (e) {
        return isoString;
    }
}

// Auto-initialize WS on script load
document.addEventListener("DOMContentLoaded", () => {
    initGlobalWebSocket();
});
