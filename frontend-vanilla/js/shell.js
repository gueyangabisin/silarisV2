/**
 * RFID Linen Pro — Shell Entry Point
 *
 * Initialises the application:
 * 1. Defines Alpine.store('connection') for reactive badge state
 * 2. Opens the singleton WebSocket connection
 * 3. Registers global WS handlers to update the store
 * 4. Boots the History API router
 * 5. Exports UI helper functions (toast, error modal)
 */

import { wsConnection } from './ws-connection.js';
import { router } from './router.js';

// ─── 1. Alpine Store (defined before or after Alpine.start()) ─────

export function registerConnectionStore() {
    if (window.Alpine && typeof Alpine.store === 'function') {
        if (!Alpine.store('connection')) {
            Alpine.store('connection', {
                serialConnected: false,
                cloudOnline: false,
                isScanningActive: false,
            });
        }
    }
}

if (window.Alpine) {
    registerConnectionStore();
} else {
    document.addEventListener('alpine:init', registerConnectionStore);
}


// ─── 2 & 3. WebSocket + Global Handlers ──────────────────

/**
 * Global handler: update Alpine.store on connection-related WS events.
 * Uses wildcard '*' subscription so it receives ALL event types.
 */
function handleGlobalWSMessage(data) {
    registerConnectionStore();
    const store = (window.Alpine && typeof Alpine.store === 'function') ? Alpine.store('connection') : null;
    if (!store) return;

    switch (data.type) {
        case 'init_state':
            store.serialConnected = data.serial_connected;
            store.cloudOnline = data.cloud_online;
            store.isScanningActive = data.is_scanning_active;
            break;

        case 'connection_state':
            store.serialConnected = data.serial_connected;
            store.cloudOnline = data.cloud_online;
            break;

        case 'scan_state_changed':
            store.isScanningActive = data.is_scanning_active;
            break;

        case 'serial_connected_info':
            showSuccessToast(data.message || `Sensor berhasil terhubung di ${data.port}`);
            store.serialConnected = true;
            break;

        case 'error':
            _showStickyErrorBanner(data.message);
            store.serialConnected = false;
            break;

        case '_ws_disconnected':
            // Internal event from ws-connection.js on disconnect
            store.serialConnected = false;
            store.cloudOnline = false;
            store.isScanningActive = false;
            break;
    }
}

// ─── 4. Boot Sequence ────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
    // Connect WebSocket (once)
    wsConnection.connect();

    // Subscribe global handler
    wsConnection.subscribe('*', handleGlobalWSMessage);

    // Boot router
    router.init();
});

// ─── 5. UI Helpers (exported for use by page modules) ────

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'info'|'success'|'error'|'warning'} [type='info']
 */
export function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.className = 'fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bgMap = {
        info:    'bg-primary text-white',
        success: 'bg-status-success text-white',
        error:   'bg-status-error text-white',
        warning: 'bg-status-warning text-black',
    };
    const bg = bgMap[type] || bgMap.info;

    toast.className = `${bg} px-4 py-3 rounded-xl shadow-lg font-label-md flex items-center gap-2 pointer-events-auto transition-all transform translate-y-2 opacity-0`;
    toast.innerHTML = `<span>${message}</span>`;
    container.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.remove('translate-y-2', 'opacity-0');
    });

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

export function showSuccessToast(msg) {
    showToast(msg, 'success');
}

export function showErrorToast(msg) {
    showToast(msg, 'error');
}

/**
 * Show a global error modal dialog.
 * @param {string} title
 * @param {string} detailMessage
 */
export function showErrorModal(title, detailMessage) {
    let modal = document.getElementById('global-error-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'global-error-modal';
        modal.className = 'fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4';
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
 * Show sticky error banner at top of page.
 */
function _showStickyErrorBanner(message) {
    let banner = document.getElementById('sticky-error-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'sticky-error-banner';
        banner.className = 'fixed top-0 left-0 right-0 z-[100] bg-status-error text-white text-center py-2 px-4 font-label-md shadow-md flex items-center justify-center gap-2';
        document.body.prepend(banner);
    }
    banner.innerHTML = `
        <span class="material-symbols-outlined text-[18px]">warning</span>
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" class="ml-4 text-white/80 hover:text-white">&times;</button>
    `;
}
