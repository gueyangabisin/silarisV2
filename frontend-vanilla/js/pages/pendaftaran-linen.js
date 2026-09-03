/**
 * RFID Linen Pro — Pendaftaran Linen Page (Real-Time RFID Scan)
 *
 * Scans RFID tags via hardware sensor, checks registration status, and
 * registers new linen tags with kategori_id and nama_id.
 *
 * CRITICAL FIX: status updates use splice(idx, 1, {...}) NOT item.status = x
 * because Alpine.js cannot observe direct property mutation on array items
 * that were added after the reactive array was initialised.
 */

import { api } from '../api.js';
import { wsConnection } from '../ws-connection.js';
import { showSuccessToast, showErrorModal } from '../shell.js';
import { portSelectorComponent } from '../components/port-selector.js';

let epcHandlerRef = null;

export const pendaftaranLinenPage = {
    render() {
        return `
<div x-data="pendaftaranLinenData()" x-init="initPage()" class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Left Column: Controls & Configuration -->
    <div class="glass-panel rounded-2xl p-6 border border-glass-border shadow-sm flex flex-col gap-5 h-fit">
        <div>
            <h1 class="font-headline-lg font-bold text-primary text-2xl">Pendaftaran Linen</h1>
            <p class="font-body-md text-on-surface-variant text-sm mt-1">Scan tag RFID baru dan hubungkan ke kategori &amp; nama linen.</p>
        </div>

        <!-- Port Sensor Selector -->
        ${portSelectorComponent.renderHTML('pendaftaran-port-select')}

        <!-- Category & Name Selection -->
        <div class="flex flex-col gap-4">
            <div class="flex flex-col gap-1">
                <label class="font-label-md text-on-surface">1. Kategori Linen <span class="text-status-error">*</span></label>
                <select x-model="selectedKategoriId" @change="onKategoriChange()"
                        class="bg-white/70 border border-glass-border rounded-xl px-4 py-2.5 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface">
                    <option value="" disabled>-- Pilih Kategori --</option>
                    <template x-for="kat in kategoriList" :key="kat.kategori_id">
                        <option :value="kat.kategori_id" x-text="kat.nama"></option>
                    </template>
                </select>
            </div>

            <div class="flex flex-col gap-1">
                <label class="font-label-md text-on-surface">2. Nama Linen <span class="text-status-error">*</span></label>
                <select x-model="selectedNamaId" :disabled="loadingNamaLinen || namaLinenOptions.length === 0"
                        class="bg-white/70 border border-glass-border rounded-xl px-4 py-2.5 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface disabled:opacity-50">
                    <option value="" disabled>-- Pilih Nama Linen --</option>
                    <template x-for="nl in namaLinenOptions" :key="nl.nama_id">
                        <option :value="nl.nama_id" x-text="nl.nama_linen"></option>
                    </template>
                </select>
            </div>
        </div>

        <!-- Scan Toggle Button -->
        <button type="button" @click="toggleScan()"
                :disabled="!selectedKategoriId || !selectedNamaId"
                :class="$store.connection?.isScanningActive
                    ? 'bg-status-warning hover:bg-status-warning/90 text-black'
                    : 'bg-primary hover:bg-primary/90 text-on-primary'"
                class="w-full font-label-lg py-3 rounded-full shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none font-bold">
            <span class="material-symbols-outlined text-[22px]"
                  :class="$store.connection?.isScanningActive ? 'animate-spin' : ''"
                  x-text="$store.connection?.isScanningActive ? 'sync' : 'sensors'"></span>
            <span x-text="$store.connection?.isScanningActive ? 'Hentikan Scanning' : 'Mulai Scanning'"></span>
        </button>

        <!-- Session Statistics -->
        <div class="border-t border-glass-border pt-4 flex flex-col gap-2 font-label-md text-on-surface-variant">
            <h3 class="font-headline-md font-bold text-on-surface text-sm">Statistik Sesi Scan</h3>
            <div class="grid grid-cols-3 gap-2 text-center mt-1">
                <div class="bg-white/40 p-2.5 rounded-xl border border-glass-border">
                    <span class="text-xs text-on-surface-variant block">Total</span>
                    <span class="font-data-mono font-bold text-lg text-on-surface" x-text="scannedItems.length"></span>
                </div>
                <div class="bg-status-success/10 p-2.5 rounded-xl border border-status-success/20">
                    <span class="text-xs text-status-success block font-semibold">Terdaftar</span>
                    <span class="font-data-mono font-bold text-lg text-status-success" x-text="countRegistered"></span>
                </div>
                <div class="bg-status-error/10 p-2.5 rounded-xl border border-status-error/20">
                    <span class="text-xs text-status-error block font-semibold">Duplikat</span>
                    <span class="font-data-mono font-bold text-lg text-status-error" x-text="countDuplicate"></span>
                </div>
            </div>
        </div>
    </div>

    <!-- Right Column: Scanned Items List -->
    <div class="lg:col-span-2 glass-panel rounded-2xl border border-glass-border shadow-sm overflow-hidden flex flex-col justify-between">
        <div>
            <div class="p-6 border-b border-glass-border flex justify-between items-center">
                <div>
                    <h2 class="font-headline-md font-bold text-primary text-xl">Daftar Tag Terdeteksi</h2>
                    <p class="font-body-md text-on-surface-variant text-sm">Tag RFID yang terdeteksi otomatis masuk ke daftar bawah ini.</p>
                </div>
                <button @click="clearList()" x-show="scannedItems.length > 0"
                        class="text-xs text-status-error hover:underline font-semibold">Bersihkan Sesi</button>
            </div>

            <!-- Table -->
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead>
                        <tr class="bg-white/40 text-on-surface-variant font-label-md border-b border-glass-border">
                            <th class="py-3 px-6">Tag EPC</th>
                            <th class="py-3 px-6">Status Pengecekan</th>
                            <th class="py-3 px-6 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody>
                        <!-- Empty State -->
                        <template x-if="scannedItems.length === 0">
                            <tr>
                                <td colspan="3" class="py-16 text-center text-on-surface-variant">
                                    <div class="flex flex-col items-center gap-3">
                                        <span class="material-symbols-outlined text-[48px]">sensors</span>
                                        <p class="font-headline-md font-semibold text-lg text-on-surface">Belum Ada Tag Terdeteksi</p>
                                        <p class="font-body-md text-sm max-w-sm">Pilih Kategori &amp; Nama Linen lalu klik 'Mulai Scanning'.</p>
                                    </div>
                                </td>
                            </tr>
                        </template>

                        <!-- Data rows -->
                        <template x-for="item in scannedItems" :key="item.epc">
                            <tr class="border-b border-glass-border/50 hover:bg-white/20 transition-colors"
                                :class="item.status === 'Tag sudah terdaftar' ? 'bg-status-error/5' : ''">
                                <td class="py-3.5 px-6 font-data-mono font-bold text-primary" x-text="item.epc"></td>
                                <td class="py-3.5 px-6">
                                    <!-- Terdaftar -->
                                    <template x-if="item.status === 'Terdaftar'">
                                        <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-status-success/10 text-status-success font-bold rounded-full text-xs">
                                            <span class="w-2 h-2 rounded-full bg-status-success"></span>
                                            Terdaftar
                                        </span>
                                    </template>
                                    <!-- Menunggu -->
                                    <template x-if="item.status === 'Menunggu'">
                                        <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-status-warning/10 text-status-warning font-bold rounded-full text-xs">
                                            <span class="w-2 h-2 rounded-full bg-status-warning animate-ping"></span>
                                            Menunggu Pendaftaran
                                        </span>
                                    </template>
                                    <!-- Checking -->
                                    <template x-if="item.status === 'Checking...'">
                                        <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-200 text-gray-700 font-bold rounded-full text-xs animate-pulse">
                                            Memeriksa...
                                        </span>
                                    </template>
                                    <!-- Duplikat -->
                                    <template x-if="item.status === 'Tag sudah terdaftar'">
                                        <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-status-error/10 text-status-error font-bold rounded-full text-xs">
                                            <span class="w-2 h-2 rounded-full bg-status-error"></span>
                                            Tag Sudah Terdaftar (Duplikat)
                                        </span>
                                    </template>
                                </td>
                                <td class="py-3.5 px-6 text-right">
                                    <button @click="registerSingle(item.epc)"
                                            :disabled="item.status !== 'Menunggu' || registeringEpc === item.epc"
                                            class="bg-primary hover:bg-primary/90 text-on-primary font-label-md px-4 py-1.5 rounded-full shadow-sm disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1 ml-auto">
                                        <span x-show="registeringEpc !== item.epc">Daftarkan</span>
                                        <span x-show="registeringEpc === item.epc" class="flex items-center gap-1">
                                            <span class="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                            Proses...
                                        </span>
                                    </button>
                                </td>
                            </tr>
                        </template>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Footer Action -->
        <div class="p-4 bg-white/20 border-t border-glass-border flex justify-between items-center"
             x-show="scannedItems.length > 0">
            <span class="font-body-md text-sm text-on-surface-variant"
                  x-text="countPending + ' tag menunggu pendaftaran'"></span>
            <button @click="registerAllPending()" :disabled="countPending === 0 || submittingBulk"
                    class="bg-primary hover:bg-primary/90 text-on-primary font-label-lg px-6 py-2.5 rounded-full shadow-md disabled:opacity-50 disabled:pointer-events-none transition-all font-bold">
                <span x-show="!submittingBulk" x-text="'Daftarkan Semua (' + countPending + ')'"></span>
                <span x-show="submittingBulk" class="flex items-center gap-2">
                    <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    Mendaftarkan...
                </span>
            </button>
        </div>
    </div>
</div>
        `;
    },

    mount() {
        // portSelectorData is registered in router.init() before Alpine.initTree()
        epcHandlerRef = (data) => {
            const pageData = window._pendaftaranInstance;
            if (pageData && data.epc) {
                pageData.handleEpcDetected(data.epc);
            }
        };
        wsConnection.subscribe('epc_detected', epcHandlerRef);
    },

    unmount() {
        if (epcHandlerRef) {
            wsConnection.unsubscribe('epc_detected', epcHandlerRef);
            epcHandlerRef = null;
        }
        window._pendaftaranInstance = null;
    },
};

export function registerPendaftaranLinenComponent() {
    if (window.Alpine && !window._pendaftaranRegistered) {
        window.Alpine.data('pendaftaranLinenData', () => ({
            kategoriList: [],
            namaLinenOptions: [],
            selectedKategoriId: '',
            selectedNamaId: '',
            loadingNamaLinen: false,
            scannedItems: [],
            registeringEpc: null,
            submittingBulk: false,

            get countRegistered() { return this.scannedItems.filter(i => i.status === 'Terdaftar').length; },
            get countPending() { return this.scannedItems.filter(i => i.status === 'Menunggu').length; },
            get countDuplicate() { return this.scannedItems.filter(i => i.status === 'Tag sudah terdaftar').length; },

            async initPage() {
                window._pendaftaranInstance = this;
                try {
                    const resp = await api.getKategoriList();
                    if (resp.ok) this.kategoriList = resp.data || [];
                } catch (e) { console.error('fetchKategoriList:', e); }
            },

            async onKategoriChange() {
                this.namaLinenOptions = [];
                this.selectedNamaId = '';
                if (!this.selectedKategoriId) return;
                this.loadingNamaLinen = true;
                try {
                    const resp = await api.getNamaLinenList(parseInt(this.selectedKategoriId, 10));
                    if (resp.ok) this.namaLinenOptions = resp.data || [];
                } catch (e) { console.error('fetchNamaLinen:', e); }
                finally { this.loadingNamaLinen = false; }
            },

            toggleScan() {
                const isScanning = Alpine.store('connection')?.isScanningActive ?? false;
                const port = document.getElementById('pendaftaran-port-select')?.value || '';
                wsConnection.send(isScanning ? { type: 'stop_inventory' } : { type: 'start_inventory', port });
            },

            /** CRITICAL: use splice(idx,1,newObj) so Alpine detects the change */
            async handleEpcDetected(rawEpc) {
                const epc = (rawEpc || '').trim().toUpperCase();
                if (!epc || this.scannedItems.some(i => i.epc === epc)) return;

                // 1. Insert immediately with Checking status
                this.scannedItems.unshift({ epc, status: 'Checking...' });

                // 2. Check backend
                let newStatus = 'Menunggu';
                try {
                    const resp = await api.getLinenByEpc(epc);
                    if (resp.ok) newStatus = 'Tag sudah terdaftar';
                } catch { /* default Menunggu */ }

                // 3. Replace by index — triggers Alpine reactive update
                const idx = this.scannedItems.findIndex(i => i.epc === epc);
                if (idx !== -1) {
                    this.scannedItems.splice(idx, 1, { epc, status: newStatus });
                }
            },

            /** registerSingle receives EPC string, not item ref, to avoid stale closure */
            async registerSingle(epc) {
                if (!this.selectedKategoriId || !this.selectedNamaId) {
                    showErrorModal('Form Belum Lengkap', 'Pilih Kategori dan Nama Linen terlebih dahulu.');
                    return;
                }
                this.registeringEpc = epc;
                try {
                    const resp = await api.createLinen({
                        epc,
                        kategori_id: parseInt(this.selectedKategoriId, 10),
                        nama_id: parseInt(this.selectedNamaId, 10),
                    });
                    if (!resp.ok) {
                        showErrorModal('Gagal Mendaftarkan', resp.data?.detail || 'Gagal menyimpan data linen.');
                        return;
                    }
                    // Replace status → Terdaftar
                    const idx = this.scannedItems.findIndex(i => i.epc === epc);
                    if (idx !== -1) this.scannedItems.splice(idx, 1, { epc, status: 'Terdaftar' });
                    showSuccessToast(`Tag ${epc} berhasil didaftarkan!`);
                } catch {
                    showErrorModal('Error', 'Gagal menghubungi server.');
                } finally {
                    this.registeringEpc = null;
                }
            },

            async registerAllPending() {
                if (!this.selectedKategoriId || !this.selectedNamaId) {
                    showErrorModal('Form Belum Lengkap', 'Pilih Kategori dan Nama Linen terlebih dahulu.');
                    return;
                }
                const pending = this.scannedItems.filter(i => i.status === 'Menunggu').map(i => i.epc);
                if (!pending.length) return;

                this.submittingBulk = true;
                let ok = 0;
                for (const epc of pending) {
                    try {
                        const resp = await api.createLinen({
                            epc,
                            kategori_id: parseInt(this.selectedKategoriId, 10),
                            nama_id: parseInt(this.selectedNamaId, 10),
                        });
                        if (resp.ok) {
                            const idx = this.scannedItems.findIndex(i => i.epc === epc);
                            if (idx !== -1) this.scannedItems.splice(idx, 1, { epc, status: 'Terdaftar' });
                            ok++;
                        }
                    } catch { /* continue */ }
                }
                this.submittingBulk = false;
                showSuccessToast(`${ok} dari ${pending.length} tag berhasil didaftarkan!`);
            },

            clearList() { this.scannedItems = []; },
        }));
        window._pendaftaranRegistered = true;
    }
}
