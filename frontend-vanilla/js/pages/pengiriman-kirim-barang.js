/**
 * RFID Linen Pro — Pengiriman / Kirim Barang Page (Real-Time Scan)
 *
 * Scans RFID tags, validates they are "tersedia", adds them to shipment cart,
 * then creates a pengiriman record for the chosen rumah sakit.
 *
 * CRITICAL: EPC status updates use splice(idx,1,{...}) not direct mutation.
 */

import { api } from '../api.js';
import { wsConnection } from '../ws-connection.js';
import { showSuccessToast, showErrorModal } from '../shell.js';
import { portSelectorComponent } from '../components/port-selector.js';

let kirimEpcHandlerRef = null;

export const pengirimanKirimBarangPage = {
    render() {
        return `
<div x-data="pengirimanKirimBarangData()" x-init="initPage()" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Left: Controls -->
    <div class="glass-panel rounded-2xl p-6 border border-glass-border shadow-sm flex flex-col gap-5 h-fit">
        <div>
            <h1 class="font-headline-lg font-bold text-primary text-2xl">Kirim Barang</h1>
            <p class="font-body-md text-on-surface-variant text-sm mt-1">Scan tag RFID dan kirimkan ke Rumah Sakit tujuan.</p>
        </div>

        ${portSelectorComponent.renderHTML('kirim-port-select')}

        <!-- Rumah Sakit Selector -->
        <div class="flex flex-col gap-1">
            <label class="font-label-md text-on-surface">Rumah Sakit Tujuan <span class="text-status-error">*</span></label>
            <select x-model="selectedRsId"
                    class="bg-white/70 border border-glass-border rounded-xl px-4 py-2.5 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface">
                <option value="" disabled>-- Pilih Rumah Sakit --</option>
                <template x-for="rs in rumahSakitList" :key="rs.rs_id">
                    <option :value="rs.rs_id" x-text="rs.nama_rs"></option>
                </template>
            </select>
        </div>

        <!-- Scan Toggle -->
        <button type="button" @click="toggleScan()"
                :class="$store.connection?.isScanningActive
                    ? 'bg-status-warning hover:bg-status-warning/90 text-black'
                    : 'bg-primary hover:bg-primary/90 text-on-primary'"
                class="w-full font-label-lg py-3 rounded-full shadow-md transition-all flex items-center justify-center gap-2 font-bold">
            <span class="material-symbols-outlined text-[22px]"
                  :class="$store.connection?.isScanningActive ? 'animate-spin' : ''"
                  x-text="$store.connection?.isScanningActive ? 'sync' : 'local_shipping'"></span>
            <span x-text="$store.connection?.isScanningActive ? 'Hentikan Scanning' : 'Mulai Scan Pengiriman'"></span>
        </button>

        <!-- Session Stats -->
        <div class="border-t border-glass-border pt-4 flex flex-col gap-2">
            <h3 class="font-headline-md font-bold text-on-surface text-sm">Ringkasan Keranjang</h3>
            <div class="grid grid-cols-2 gap-2 text-center mt-1">
                <div class="bg-status-success/10 p-2.5 rounded-xl border border-status-success/20">
                    <span class="text-xs text-status-success block font-semibold">Siap Kirim</span>
                    <span class="font-data-mono font-bold text-lg text-status-success" x-text="countReady"></span>
                </div>
                <div class="bg-status-error/10 p-2.5 rounded-xl border border-status-error/20">
                    <span class="text-xs text-status-error block font-semibold">Ditolak</span>
                    <span class="font-data-mono font-bold text-lg text-status-error" x-text="countRejected"></span>
                </div>
            </div>
        </div>
    </div>

    <!-- Right: Scanned Table + Submit -->
    <div class="lg:col-span-2 glass-panel rounded-2xl border border-glass-border shadow-sm overflow-hidden flex flex-col justify-between">
        <div>
            <div class="p-6 border-b border-glass-border flex justify-between items-center">
                <div>
                    <h2 class="font-headline-md font-bold text-primary text-xl">Keranjang Pengiriman</h2>
                    <p class="font-body-md text-on-surface-variant text-sm">Tag tersedia otomatis masuk keranjang saat scan.</p>
                </div>
                <button @click="clearCart()" x-show="cartItems.length > 0"
                        class="text-xs text-status-error hover:underline font-semibold">Kosongkan</button>
            </div>

            <!-- Table -->
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-white/40 text-on-surface-variant font-label-md border-b border-glass-border text-xs">
                            <th class="py-3 px-6">Tag EPC</th>
                            <th class="py-3 px-6">Nama Linen</th>
                            <th class="py-3 px-6">Kategori</th>
                            <th class="py-3 px-6">Validasi</th>
                            <th class="py-3 px-6 text-right">Hapus</th>
                        </tr>
                    </thead>
                    <tbody>
                        <!-- Empty State -->
                        <template x-if="cartItems.length === 0">
                            <tr>
                                <td colspan="5" class="py-16 text-center text-on-surface-variant">
                                    <div class="flex flex-col items-center gap-3">
                                        <span class="material-symbols-outlined text-[48px]">inventory_2</span>
                                        <p class="font-headline-md font-semibold text-lg text-on-surface">Keranjang Kosong</p>
                                        <p class="font-body-md text-sm">Aktifkan scanning untuk mulai menambahkan tag.</p>
                                    </div>
                                </td>
                            </tr>
                        </template>

                        <template x-for="item in cartItems" :key="item.epc">
                            <tr class="border-b border-glass-border/50 hover:bg-white/20 transition-colors"
                                :class="item.valid === false ? 'bg-status-error/5' : ''">
                                <td class="py-3.5 px-6 font-data-mono font-bold text-primary" x-text="item.epc"></td>
                                <td class="py-3.5 px-6 font-semibold text-on-surface" x-text="item.nama_linen || '-'"></td>
                                <td class="py-3.5 px-6 text-on-surface-variant" x-text="item.kategori || '-'"></td>
                                <td class="py-3.5 px-6">
                                    <template x-if="item.validating">
                                        <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-200 text-gray-700 font-bold rounded-full text-xs animate-pulse">Memvalidasi...</span>
                                    </template>
                                    <template x-if="!item.validating && item.valid === true">
                                        <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-status-success/10 text-status-success font-bold rounded-full text-xs">
                                            <span class="w-2 h-2 rounded-full bg-status-success"></span> Siap Kirim
                                        </span>
                                    </template>
                                    <template x-if="!item.validating && item.valid === false">
                                        <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-status-error/10 text-status-error font-bold rounded-full text-xs"
                                              :title="item.error">
                                            <span class="w-2 h-2 rounded-full bg-status-error"></span>
                                            Ditolak
                                        </span>
                                    </template>
                                </td>
                                <td class="py-3.5 px-6 text-right">
                                    <button @click="removeItem(item.epc)"
                                            class="text-status-error hover:bg-status-error/10 p-1.5 rounded-lg transition-colors">
                                        <span class="material-symbols-outlined text-[18px]">delete_outline</span>
                                    </button>
                                </td>
                            </tr>
                        </template>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Footer Submit -->
        <div class="p-4 bg-white/20 border-t border-glass-border flex justify-between items-center"
             x-show="cartItems.length > 0">
            <span class="font-body-md text-sm text-on-surface-variant"
                  x-text="countReady + ' item siap dikirim'"></span>
            <button @click="submitPengiriman()"
                    :disabled="countReady === 0 || !selectedRsId || submitting"
                    class="bg-primary hover:bg-primary/90 text-on-primary font-label-lg px-6 py-2.5 rounded-full shadow-md disabled:opacity-50 disabled:pointer-events-none transition-all font-bold flex items-center gap-2">
                <span x-show="!submitting">Kirimkan Sekarang</span>
                <span x-show="submitting" class="flex items-center gap-2">
                    <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Memproses...
                </span>
            </button>
        </div>
    </div>

    <!-- Success Dialog -->
    <div x-show="lastResult" x-transition
         class="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div class="glass-panel bg-white/95 rounded-2xl border border-glass-border shadow-2xl p-8 max-w-md w-full flex flex-col gap-5 text-center">
            <div class="w-16 h-16 rounded-full bg-status-success/20 text-status-success flex items-center justify-center mx-auto">
                <span class="material-symbols-outlined text-[40px]">check_circle</span>
            </div>
            <div>
                <h3 class="font-headline-md font-bold text-on-surface text-xl">Pengiriman Berhasil!</h3>
                <p class="font-body-md text-on-surface-variant text-sm mt-1" x-text="lastResult?.message || ''"></p>
            </div>
            <div class="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <span class="text-xs text-on-surface-variant block">Kode Verifikasi</span>
                <span class="font-data-mono font-bold text-primary text-2xl" x-text="lastResult?.kode_verifikasi || ''"></span>
            </div>
            <div class="flex gap-3 justify-center">
                <button @click="lastResult = null; clearCart()"
                        class="bg-primary text-on-primary font-label-lg px-6 py-2.5 rounded-full shadow-md hover:bg-primary/90 transition-all font-bold">
                    Mulai Pengiriman Baru
                </button>
            </div>
        </div>
    </div>
</div>
        `;
    },

    mount() {
        kirimEpcHandlerRef = (data) => {
            const inst = window._kirimBarangInstance;
            if (inst && data.epc) inst.handleEpcDetected(data.epc);
        };
        wsConnection.subscribe('epc_detected', kirimEpcHandlerRef);
    },

    unmount() {
        if (kirimEpcHandlerRef) {
            wsConnection.unsubscribe('epc_detected', kirimEpcHandlerRef);
            kirimEpcHandlerRef = null;
        }
        window._kirimBarangInstance = null;
    },
};

export function registerPengirimanKirimBarangComponent() {
    if (window.Alpine && !window._kirimBarangRegistered) {
        window.Alpine.data('pengirimanKirimBarangData', () => ({
            rumahSakitList: [],
            selectedRsId: '',
            cartItems: [],
            submitting: false,
            lastResult: null,

            get countReady() { return this.cartItems.filter(i => i.valid === true).length; },
            get countRejected() { return this.cartItems.filter(i => i.valid === false).length; },

            async initPage() {
                window._kirimBarangInstance = this;
                try {
                    const resp = await api.getRumahSakitList();
                    if (resp.ok) this.rumahSakitList = Array.isArray(resp.data) ? resp.data : [];
                } catch (e) { console.error('fetchRumahSakit:', e); }
            },

            toggleScan() {
                const isScanning = Alpine.store('connection')?.isScanningActive ?? false;
                const port = document.getElementById('kirim-port-select')?.value || '';
                wsConnection.send(isScanning ? { type: 'stop_inventory' } : { type: 'start_inventory', port });
            },

            /** CRITICAL: use splice for Alpine reactivity */
            async handleEpcDetected(rawEpc) {
                const epc = (rawEpc || '').trim().toUpperCase();
                if (!epc || this.cartItems.some(i => i.epc === epc)) return;

                // 1. Insert with validating flag
                this.cartItems.unshift({ epc, validating: true, valid: null, nama_linen: '', kategori: '', error: '' });

                // 2. Check backend
                let patch;
                try {
                    const resp = await api.getLinenByEpc(epc);
                    if (resp.ok) {
                        const d = resp.data;
                        if (d.status === 'tersedia') {
                            patch = { validating: false, valid: true, nama_linen: d.nama_linen || d.nama || '-', kategori: d.kategori || '-', error: '' };
                        } else {
                            patch = { validating: false, valid: false, nama_linen: d.nama_linen || d.nama || '-', kategori: d.kategori || '-', error: `Status: ${d.status}` };
                        }
                    } else {
                        patch = { validating: false, valid: false, nama_linen: '', kategori: '', error: 'Linen belum terdaftar' };
                    }
                } catch {
                    patch = { validating: false, valid: false, nama_linen: '', kategori: '', error: 'Server error' };
                }

                // 3. splice replace for Alpine reactivity
                const idx = this.cartItems.findIndex(i => i.epc === epc);
                if (idx !== -1) {
                    this.cartItems.splice(idx, 1, { epc, ...patch });
                }
            },

            removeItem(epc) {
                const idx = this.cartItems.findIndex(i => i.epc === epc);
                if (idx !== -1) this.cartItems.splice(idx, 1);
            },

            clearCart() { this.cartItems = []; },

            async submitPengiriman() {
                if (!this.selectedRsId) {
                    showErrorModal('Pilih Tujuan', 'Pilih Rumah Sakit tujuan terlebih dahulu.');
                    return;
                }
                const readyEpcs = this.cartItems.filter(i => i.valid === true).map(i => i.epc);
                if (!readyEpcs.length) {
                    showErrorModal('Keranjang Kosong', 'Tidak ada item yang siap dikirim.');
                    return;
                }
                this.submitting = true;
                try {
                    const resp = await api.createPengiriman({
                        rs_id: parseInt(this.selectedRsId, 10),
                        daftar_epc: readyEpcs,
                    });
                    if (!resp.ok) {
                        showErrorModal('Pengiriman Gagal', resp.data?.detail || 'Terjadi kesalahan saat membuat pengiriman.');
                        return;
                    }
                    const rs = this.rumahSakitList.find(r => r.rs_id === parseInt(this.selectedRsId, 10));
                    this.lastResult = {
                        kode_verifikasi: resp.data.kode_verifikasi,
                        message: `${readyEpcs.length} item berhasil dikirim ke ${rs?.nama_rs || 'Rumah Sakit'}.`,
                    };
                } catch {
                    showErrorModal('Error', 'Gagal menghubungi server.');
                } finally {
                    this.submitting = false;
                }
            },
        }));
        window._kirimBarangRegistered = true;
    }
}
