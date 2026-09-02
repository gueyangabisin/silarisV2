/**
 * RFID Linen Pro — Singleton WebSocket Connection (pub-sub pattern)
 *
 * Single persistent WS connection shared across the entire SPA.
 * Pages subscribe/unsubscribe to specific event types without
 * opening or closing the underlying connection.
 */

const WS_BASE = `ws://${location.hostname}:8000/ws`;

/** @type {WebSocket|null} */
let ws = null;
let reconnectAttempts = 0;
/** @type {ReturnType<typeof setTimeout>|null} */
let reconnectTimer = null;

/** @type {Map<string, Set<Function>>} */
const subscribers = new Map();

// ─── Public API ───────────────────────────────────────────

/**
 * Open the WebSocket connection (call once from shell.js).
 */
function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
    }

    try {
        ws = new WebSocket(WS_BASE);

        ws.onopen = () => {
            console.log('[WS] Connected to', WS_BASE);
            reconnectAttempts = 0;
            _hideReconnectOverlay();
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                _dispatch(data);
            } catch (e) {
                console.error('[WS] Error parsing message:', e);
            }
        };

        ws.onclose = () => {
            console.log('[WS] Disconnected from server.');
            _handleDisconnect();
        };

        ws.onerror = (err) => {
            console.error('[WS] Connection Error:', err);
            // onclose will fire after onerror, so reconnect is handled there
        };
    } catch (e) {
        console.error('[WS] Connection setup failed:', e);
        _handleDisconnect();
    }
}

/**
 * Send a JSON message to the server.
 * @param {object} message
 */
function send(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    } else {
        console.warn('[WS] Cannot send — not connected.');
    }
}

/**
 * Subscribe a callback to a specific WS event type.
 * @param {string} eventType  e.g. 'epc_detected', 'init_state'
 * @param {Function} callback  receives the full parsed message object
 */
function subscribe(eventType, callback) {
    if (!subscribers.has(eventType)) {
        subscribers.set(eventType, new Set());
    }
    subscribers.get(eventType).add(callback);
}

/**
 * Unsubscribe a previously registered callback.
 * @param {string} eventType
 * @param {Function} callback
 */
function unsubscribe(eventType, callback) {
    const subs = subscribers.get(eventType);
    if (subs) {
        subs.delete(callback);
        if (subs.size === 0) subscribers.delete(eventType);
    }
}

// ─── Internal Helpers ─────────────────────────────────────

/**
 * Dispatch incoming WS message to all matching subscribers.
 */
function _dispatch(data) {
    const eventType = data.type;
    if (!eventType) return;

    const subs = subscribers.get(eventType);
    if (subs) {
        subs.forEach(cb => {
            try { cb(data); } catch (e) { console.error('[WS] Subscriber error:', e); }
        });
    }

    // Also dispatch to wildcard '*' subscribers (for shell.js global handler)
    const wildcardSubs = subscribers.get('*');
    if (wildcardSubs) {
        wildcardSubs.forEach(cb => {
            try { cb(data); } catch (e) { console.error('[WS] Wildcard subscriber error:', e); }
        });
    }
}

/**
 * Handle disconnect — show overlay, schedule reconnect.
 * Logic ported 1:1 from common.js handleWSDisconnect().
 */
function _handleDisconnect() {
    reconnectAttempts++;
    _showReconnectOverlay(reconnectAttempts > 10);

    // Notify subscribers about disconnect so shell can reset store
    _dispatch({ type: '_ws_disconnected' });

    if (!reconnectTimer) {
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect();
        }, 3000);
    }
}

/**
 * Show reconnect overlay — ported from common.js showReconnectOverlay().
 */
function _showReconnectOverlay(isPersistentFail = false) {
    let overlay = document.getElementById('ws-reconnect-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'ws-reconnect-overlay';
        overlay.className = 'fixed inset-0 z-[180] bg-black/60 backdrop-blur-md flex items-center justify-center p-4 transition-all';
        document.body.appendChild(overlay);
    }

    const messageText = isPersistentFail
        ? 'Tidak dapat terhubung ke server. Periksa koneksi backend.'
        : 'Menghubungkan kembali ke server...';

    overlay.innerHTML = `
        <div class="bg-surface/90 backdrop-blur-2xl border border-glass-border rounded-2xl p-8 max-w-sm w-full shadow-2xl flex flex-col items-center gap-4 text-center">
            <div class="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <h3 class="font-headline-md text-headline-md font-bold text-primary">Koneksi Server Terputus</h3>
            <p class="font-body-md text-on-surface-variant">${messageText}</p>
        </div>
    `;
}

/**
 * Hide reconnect overlay.
 */
function _hideReconnectOverlay() {
    const overlay = document.getElementById('ws-reconnect-overlay');
    if (overlay) overlay.remove();
}

// ─── Export ───────────────────────────────────────────────

export const wsConnection = {
    connect,
    send,
    subscribe,
    unsubscribe,
};
