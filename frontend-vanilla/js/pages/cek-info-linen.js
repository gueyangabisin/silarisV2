/**
 * RFID Linen Pro — Cek Info Linen Page (Real-Time Single Scan)
 *
 * Each new tag replaces the primary detail card. Session history appended below.
 */

import { api } from '../api.js';
import { wsConnection } from '../ws-connection.js';
import { portSelectorComponent } from '../components/port-selector.js';

let cekInfoEpcHandlerRef = null;

export const cekInfoLinenPage = {
    render() {
        return `
<div x-data="cekInfoLinenData()" x-init="initPage()" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Left Column -->
    <div class="glass-panel rounded-2xl p-6 border border-glass-border shadow-sm flex flex-col gap-5 h-fit">
        <div>
            <h1 class="font-headline-lg font-bold text-primary text-2xl">Cek Info Linen</h1>
            <p class="font-body-md text-on-surface-variant text-sm mt-1">Scan tag RFID untuk melihat informasi detail linen.</p>
        </div>

        ${portSelectorComponent.renderHTML('cekinfo-port-select')}

        <button type="button" @click="toggleScan()"
                :class="$store.connection?.isScanningActive
                    ? 'bg-status-warning hover:bg-status-warning/90 text-black'
                    : 'bg-primary hover:bg-primary/90 text-on-primary'"
                class="w-full font-label-lg py-3 rounded-full shadow-md transition-all flex items-center justify-center gap-2 font-bold">
            <span class="material-symbols-outlined text-[22px]"
                  :class="$store.connection?.isScanningActive ? 'animate-spin' : ''"
                  x-text="$store.connection?.isScanningActive ? 'sync' : 'search_check'"></span>
            <span x-text="$store.connection?.isScanningActive ? 'Hentikan Scanning' : 'Mulai Scan Pengecekan'"></span>
        </button>

        <div class="bg-white/40 border border-glass-border rounded-xl p-4 flex items-start gap-3 text-on-surface-variant text-xs">
            <span class="material-symbols-outlined text-primary text-[20px]">info</span>
            <p>Dekatkan tag RFID ke sensor reader. Sistem akan langsung menampilkan rincian barang linen.</p>
        </div>
    </div>

    <!-- Right Column -->
    <div class="lg:col-span-2 flex flex-col gap-6">
        <!-- STATE A: waiting -->
        <template x-if="!currentScan">
            <div class="glass-panel rounded-2xl p-12 border border-glass-border shadow-sm flex flex-col items-center justify-center text-center gap-4 min-h-[300px]">
                <div class="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <span class="material-symbols-outlined text-[36px]">contactless</span>
                </div>
                <h2 class="font-headline-md font-bold text-on-surface text-xl">Menunggu Pembacaan RFID</h2>
                <p class="font-body-md text-on-surface-variant text-sm max-w-md">Aktifkan scanning dan dekatkan barang linen ke sensor.</p>
            </div>
        </template>

        <!-- STATE B: found -->
        <template x-if="currentScan && currentScan.found">
            <div class="glass-panel rounded-2xl p-6 border border-glass-border shadow-md flex flex-col gap-6 bg-white/40">
                <div class="flex justify-between items-start border-b border-glass-border pb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-full bg-status-success/20 text-status-success flex items-center justify-center">
                            <span class="material-symbols-outlined text-[28px]">check_circle</span>
                        </div>
                        <div>
                            <span class="text-xs font-bold text-status-success uppercase tracking-wider block">Tag Terdaftar</span>
                            <h2 class="font-headline-md font-bold text-on-surface text-2xl" x-text="currentScan.data?.nama_linen || '-'"></h2>
                        </div>
                    </div>
                    <span class="font-data-mono font-bold text-primary bg-primary/10 px-3.5 py-1.5 rounded-full text-sm" x-text="currentScan.epc"></span>
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div class="bg-white/60 p-4 rounded-xl border border-glass-border">
                        <span class="text-xs font-semibold text-on-surface-variant block">Kategori</span>
                        <span class="font-body-md font-bold text-on-surface text-base" x-text="currentScan.data?.kategori || '-'"></span>
                    </div>
                    <div class="bg-white/60 p-4 rounded-xl border border-glass-border">
                        <span class="text-xs font-semibold text-on-surface-variant block">Status</span>
                        <span class="font-body-md font-bold text-on-surface text-base" x-text="currentScan.data?.status || '-'"></span>
                    </div>
                    <div class="bg-white/60 p-4 rounded-xl border border-glass-border">
                        <span class="text-xs font-semibold text-on-surface-variant block">Rumah Sakit Tujuan</span>
                        <span class="font-body-md font-bold text-on-surface text-base" x-text="currentScan.data?.nama_rs || '-'"></span>
                    </div>
                </div>
            </div>
        </template>

        <!-- STATE C: not found -->
        <template x-if="currentScan && !currentScan.found">
            <div class="glass-panel rounded-2xl p-6 border border-status-error/30 shadow-md flex flex-col gap-4 bg-status-error/5">
                <div class="flex items-center justify-between border-b border-status-error/20 pb-4">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-full bg-status-error/20 text-status-error flex items-center justify-center">
                            <span class="material-symbols-outlined text-[28px]">warning</span>
                        </div>
                        <div>
                            <h2 class="font-headline-md font-bold text-status-error text-xl">Tag Belum Terdaftar</h2>
                            <p class="font-body-md text-on-surface-variant text-sm" x-text="currentScan.message"></p>
                        </div>
                    </div>
                    <span class="font-data-mono font-bold text-status-error bg-status-error/10 px-3.5 py-1.5 rounded-full text-sm" x-text="currentScan.epc"></span>
                </div>
                <div class="flex justify-end">
                    <a data-route href="/v2/pendaftaran" class="bg-primary text-on-primary font-label-md px-5 py-2 rounded-full shadow-sm hover:bg-primary/90 transition-all flex items-center gap-1 text-sm font-semibold">
                        <span class="material-symbols-outlined text-[18px]">add</span>
                        Daftarkan Tag Ini Sekarang
                    </a>
                </div>
            </div>
        </template>

        <!-- Session History -->
        <div class="glass-panel rounded-2xl border border-glass-border shadow-sm p-6 flex flex-col gap-4" x-show="historyItems.length > 0">
            <h3 class="font-headline-md font-bold text-primary text-lg">Riwayat Pengecekan Sesi Ini</h3>
            <div class="overflow-x-auto rounded-xl border border-glass-border">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-white/40 text-on-surface-variant font-label-md border-b border-glass-border text-xs">
                            <th class="py-2.5 px-4">Waktu</th>
                            <th class="py-2.5 px-4">Tag EPC</th>
                            <th class="py-2.5 px-4">Nama Linen</th>
                            <th class="py-2.5 px-4">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        <template x-for="item in historyItems" :key="item.epc + item.time">
                            <tr class="border-b border-glass-border/30 hover:bg-white/20 text-sm">
                                <td class="py-2.5 px-4 text-on-surface-variant text-xs" x-text="item.time"></td>
                                <td class="py-2.5 px-4 font-data-mono font-bold text-primary" x-text="item.epc"></td>
                                <td class="py-2.5 px-4 font-semibold" x-text="item.found ? (item.data?.nama_linen || '-') : 'Belum Terdaftar'"></td>
                                <td class="py-2.5 px-4">
                                    <span :class="item.found ? 'bg-status-success/10 text-status-success' : 'bg-status-error/10 text-status-error'"
                                          class="inline-block px-2.5 py-0.5 font-bold rounded-full text-xs"
                                          x-text="item.found ? (item.data?.status || 'Tersedia') : 'Tidak Ada'"></span>
                                </td>
                            </tr>
                        </template>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>
        `;
    },

    mount() {
        cekInfoEpcHandlerRef = (data) => {
            const inst = window._cekInfoInstance;
            if (inst && data.epc) inst.handleEpcDetected(data.epc);
        };
        wsConnection.subscribe('epc_detected', cekInfoEpcHandlerRef);
    },

    unmount() {
        if (cekInfoEpcHandlerRef) {
            wsConnection.unsubscribe('epc_detected', cekInfoEpcHandlerRef);
            cekInfoEpcHandlerRef = null;
        }
        window._cekInfoInstance = null;
    },
};

export function registerCekInfoLinenComponent() {
    if (window.Alpine && !window._cekInfoRegistered) {
        window.Alpine.data('cekInfoLinenData', () => ({
            currentScan: null,
            historyItems: [],

            async initPage() { window._cekInfoInstance = this; },

            toggleScan() {
                const isScanning = Alpine.store('connection')?.isScanningActive ?? false;
                const port = document.getElementById('cekinfo-port-select')?.value || '';
                wsConnection.send(isScanning ? { type: 'stop_inventory' } : { type: 'start_inventory', port });
            },

            async handleEpcDetected(rawEpc) {
                const epc = (rawEpc || '').trim().toUpperCase();
                if (!epc) return;
                const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                try {
                    const resp = await api.getLinenByEpc(epc);
                    const result = {
                        epc, time,
                        found: resp.ok,
                        data: resp.ok ? resp.data : null,
                        message: !resp.ok ? (resp.data?.detail || 'Tag belum terdaftar di sistem.') : null,
                    };
                    this.currentScan = result;
                    this.historyItems.unshift(result);
                } catch (e) {
                    console.error('cekInfo handleEpcDetected:', e);
                }
            },
        }));
        window._cekInfoRegistered = true;
    }
}
