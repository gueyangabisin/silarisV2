/**
 * RFID Linen Pro — Admin Cloud: Histori Pengiriman Page
 *
 * Read-only log of shipment transactions to hospitals.
 * Includes date filter, pagination, and detail breakdown modal.
 */

import { api } from '../api.js';

export const historiPengirimanPage = {
    render() {
        return `
<div x-data="historiPengirimanData()" x-init="fetchList()">
    <!-- Glass Panel Container -->
    <div class="glass-panel rounded-2xl border border-glass-border shadow-sm w-full overflow-hidden flex flex-col">
        <!-- Header Controls -->
        <div class="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-glass-border">
            <div>
                <div class="flex items-center gap-2">
                    <h1 class="font-headline-lg font-bold text-primary text-2xl">Histori Pengiriman Linen</h1>
                    <span class="px-2.5 py-0.5 bg-primary/10 text-primary font-bold rounded-full text-label-sm">Admin Cloud</span>
                </div>
                <p class="font-body-md text-on-surface-variant">Arsip seluruh transaksi pengiriman linen ke Rumah Sakit tujuan.</p>
            </div>
        </div>

        <!-- Filter Date Bar -->
        <div class="px-6 py-4 bg-white/30 border-b border-glass-border flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
            <form @submit.prevent="applyFilter()" class="flex flex-wrap items-center gap-3">
                <div class="flex items-center gap-2">
                    <label class="font-label-md text-on-surface shrink-0">Dari:</label>
                    <input type="date" x-model="start_date"
                           class="bg-white/70 border border-glass-border rounded-xl px-3 py-1.5 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface" />
                </div>
                <div class="flex items-center gap-2">
                    <label class="font-label-md text-on-surface shrink-0">Sampai:</label>
                    <input type="date" x-model="end_date"
                           class="bg-white/70 border border-glass-border rounded-xl px-3 py-1.5 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface" />
                </div>
                <button type="submit" class="bg-primary hover:bg-primary/90 text-on-primary font-label-md px-4 py-1.5 rounded-full shadow-sm transition-all flex items-center gap-1">
                    <span class="material-symbols-outlined text-[18px]">filter_alt</span>
                    Terapkan Filter
                </button>
                <button type="button" @click="resetFilter()" class="border border-glass-border bg-white/50 hover:bg-white text-on-surface font-label-md px-4 py-1.5 rounded-full transition-all">
                    Reset
                </button>
            </form>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="bg-white/40 text-on-surface-variant font-label-md border-b border-glass-border">
                        <th class="py-3 px-6">ID Transaksi</th>
                        <th class="py-3 px-6">Tanggal & Waktu</th>
                        <th class="py-3 px-6">Rumah Sakit Tujuan</th>
                        <th class="py-3 px-6 text-center">Jumlah Item</th>
                        <th class="py-3 px-6">Status Sync</th>
                        <th class="py-3 px-6 text-right">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- Loading State -->
                    <template x-if="loading">
                        <tr>
                            <td colspan="6" class="py-8 text-center text-on-surface-variant">
                                <div class="flex items-center justify-center gap-3">
                                    <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                    Memuat histori pengiriman...
                                </div>
                            </td>
                        </tr>
                    </template>

                    <!-- Empty State -->
                    <template x-if="!loading && items.length === 0">
                        <tr>
                            <td colspan="6" class="py-12 text-center text-on-surface-variant">
                                <div class="flex flex-col items-center gap-3">
                                    <span class="material-symbols-outlined text-[48px] text-text-muted" style="font-variation-settings: 'FILL' 1;">history</span>
                                    <p class="font-headline-md font-semibold text-lg text-on-surface">Belum Ada Histori Pengiriman</p>
                                    <p class="font-body-md text-sm max-w-sm">Belum ada transaksi pengiriman yang tercatat di cloud database.</p>
                                </div>
                            </td>
                        </tr>
                    </template>

                    <!-- Data Rows -->
                    <template x-for="item in items" :key="item.pengiriman_id || item.temp_id">
                        <tr class="border-b border-glass-border/50 hover:bg-white/20 transition-colors">
                            <td class="py-3.5 px-6 font-data-mono font-bold text-primary" x-text="item.pengiriman_id || item.temp_id || '-'"></td>
                            <td class="py-3.5 px-6 font-body-md text-on-surface" x-text="formatDate(item.created_at || item.tanggal)"></td>
                            <td class="py-3.5 px-6 font-body-md font-semibold" x-text="item.nama_rs || item.kode_rs || '-'"></td>
                            <td class="py-3.5 px-6 text-center">
                                <span class="inline-block px-3 py-1 bg-primary/10 text-primary font-bold rounded-full text-label-sm"
                                      x-text="(item.total_linen || item.items?.length || 0) + ' Linen'"></span>
                            </td>
                            <td class="py-3.5 px-6 font-body-md">
                                <template x-if="item.status_sync === 'synced' || item.status === 'Selesai'">
                                    <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-status-success/10 text-status-success font-bold rounded-full text-label-sm">
                                        <span class="w-2 h-2 rounded-full bg-status-success"></span>
                                        Tersinkronisasi
                                    </span>
                                </template>
                                <template x-if="item.status_sync !== 'synced' && item.status !== 'Selesai'">
                                    <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-status-warning/10 text-status-warning font-bold rounded-full text-label-sm">
                                        <span class="w-2 h-2 rounded-full bg-status-warning"></span>
                                        Pending / Lokal
                                    </span>
                                </template>
                            </td>
                            <td class="py-3.5 px-6 text-right">
                                <button @click="openDetailModal(item)" class="bg-primary/10 hover:bg-primary text-primary hover:text-white px-4 py-1.5 rounded-full font-label-md transition-all flex items-center gap-1 ml-auto">
                                    <span class="material-symbols-outlined text-[16px]">visibility</span>
                                    Lihat Detail
                                </button>
                            </td>
                        </tr>
                    </template>
                </tbody>
            </table>
        </div>

        <!-- Pagination Controls -->
        <div class="p-4 bg-white/20 border-t border-glass-border flex flex-col sm:flex-row items-center justify-between gap-4 font-label-md text-on-surface-variant">
            <div>
                Menampilkan <span class="font-bold text-on-surface" x-text="items.length"></span> dari <span class="font-bold text-on-surface" x-text="total_data"></span> transaksi
            </div>
            <div class="flex items-center gap-2">
                <button @click="goToPage(page - 1)" :disabled="page <= 1"
                        class="px-3.5 py-1.5 rounded-lg border border-glass-border bg-white/50 hover:bg-white disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1">
                    <span class="material-symbols-outlined text-[18px]">chevron_left</span>
                    Prev
                </button>

                <span class="px-3 py-1 bg-primary text-on-primary rounded-lg font-bold" x-text="page + ' / ' + total_page"></span>

                <button @click="goToPage(page + 1)" :disabled="page >= total_page"
                        class="px-3.5 py-1.5 rounded-lg border border-glass-border bg-white/50 hover:bg-white disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1">
                    Next
                    <span class="material-symbols-outlined text-[18px]">chevron_right</span>
                </button>
            </div>
        </div>

        <!-- Error State -->
        <template x-if="fetchError">
            <div class="p-6 text-center text-status-error font-body-md" x-text="'Error: ' + fetchError"></div>
        </template>
    </div>

    <!-- ═══ Modal Detail Transaksi ═══ -->
    <div x-show="showDetailModal"
         x-transition:enter="transition ease-out duration-200"
         x-transition:enter-start="opacity-0"
         x-transition:enter-end="opacity-100"
         x-transition:leave="transition ease-in duration-150"
         x-transition:leave-start="opacity-100"
         x-transition:leave-end="opacity-0"
         class="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
         style="display: none;"
         @keydown.escape.window="showDetailModal = false">
        <div @click.outside="showDetailModal = false"
             x-transition:enter="transition ease-out duration-200"
             x-transition:enter-start="opacity-0 scale-95"
             x-transition:enter-end="opacity-100 scale-100"
             class="bg-surface/90 backdrop-blur-2xl border border-glass-border rounded-2xl p-6 max-w-2xl w-full shadow-2xl flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center border-b border-glass-border pb-4">
                <div>
                    <h2 class="font-headline-md font-bold text-primary text-xl">Detail Transaksi Pengiriman</h2>
                    <p class="font-body-md text-on-surface-variant" x-text="'ID: ' + (detailData?.pengiriman_id || detailData?.temp_id || '-')"></p>
                </div>
                <button @click="showDetailModal = false" class="text-on-surface-variant hover:text-on-surface text-2xl font-bold">&times;</button>
            </div>

            <template x-if="loadingDetail">
                <div class="py-8 text-center text-on-surface-variant flex items-center justify-center gap-3">
                    <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    Memuat rincian item linen...
                </div>
            </template>

            <template x-if="!loadingDetail && detailData">
                <div class="flex flex-col gap-4">
                    <!-- Info Summary Grid -->
                    <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 bg-white/40 p-4 rounded-xl border border-glass-border">
                        <div>
                            <span class="text-label-sm font-semibold text-on-surface-variant block">Rumah Sakit:</span>
                            <span class="font-body-md font-bold text-on-surface" x-text="detailData.nama_rs || detailData.kode_rs || '-'"></span>
                        </div>
                        <div>
                            <span class="text-label-sm font-semibold text-on-surface-variant block">Tanggal:</span>
                            <span class="font-body-md font-bold text-on-surface" x-text="formatDate(detailData.created_at || detailData.tanggal)"></span>
                        </div>
                        <div>
                            <span class="text-label-sm font-semibold text-on-surface-variant block">Total Linen:</span>
                            <span class="font-body-md font-bold text-primary font-data-mono" x-text="(detailData.items?.length || detailData.total_linen || 0) + ' Item'"></span>
                        </div>
                    </div>

                    <!-- Items Table -->
                    <h3 class="font-headline-md font-bold text-on-surface text-base">Daftar Linen dalam Transaksi</h3>
                    <div class="overflow-x-auto rounded-xl border border-glass-border">
                        <table class="w-full text-left border-collapse">
                            <thead>
                                <tr class="bg-white/60 text-on-surface-variant font-label-md border-b border-glass-border">
                                    <th class="py-2.5 px-4">Tag EPC</th>
                                    <th class="py-2.5 px-4">Nama Linen</th>
                                    <th class="py-2.5 px-4">Kategori</th>
                                </tr>
                            </thead>
                            <tbody>
                                <template x-for="line in (detailData.items || [])" :key="line.epc">
                                    <tr class="border-b border-glass-border/30 hover:bg-white/20">
                                        <td class="py-2.5 px-4 font-data-mono font-bold text-primary" x-text="line.epc"></td>
                                        <td class="py-2.5 px-4 font-body-md" x-text="line.nama_linen || line.nama || '-'"></td>
                                        <td class="py-2.5 px-4 font-body-md text-on-surface-variant" x-text="line.kategori || line.nama_kategori || '-'"></td>
                                    </tr>
                                </template>
                            </tbody>
                        </table>
                    </div>
                </div>
            </template>

            <div class="flex justify-end mt-2">
                <button @click="showDetailModal = false" class="bg-primary text-on-primary font-label-lg px-6 py-2 rounded-full hover:bg-primary/90 transition-colors">Tutup</button>
            </div>
        </div>
    </div>
</div>
        `;
    },

    mount() {},
    unmount() {},
};

export function registerHistoriPengirimanComponent() {
    if (window.Alpine && !window._historiPengirimanRegistered) {
        window.Alpine.data('historiPengirimanData', () => ({
            items: [],
            total_data: 0,
            total_page: 1,
            page: 1,
            limit: 50,
            start_date: '',
            end_date: '',
            loading: true,
            fetchError: null,

            showDetailModal: false,
            detailData: null,
            loadingDetail: false,

            async fetchList() {
                this.loading = true;
                this.fetchError = null;
                try {
                    const resp = await api.getHistoriPengiriman({
                        start_date: this.start_date,
                        end_date: this.end_date,
                        page: this.page,
                        limit: this.limit,
                    });
                    if (!resp.ok) throw new Error(resp.data?.detail || 'Gagal mengambil histori pengiriman');
                    
                    const resData = resp.data || {};
                    this.items = resData.data || [];
                    this.total_data = resData.total_data || 0;
                    this.total_page = resData.total_page || 1;
                } catch (err) {
                    console.error(err);
                    this.fetchError = err.message;
                } finally {
                    this.loading = false;
                }
            },

            applyFilter() {
                this.page = 1;
                this.fetchList();
            },

            resetFilter() {
                this.start_date = '';
                this.end_date = '';
                this.page = 1;
                this.fetchList();
            },

            goToPage(p) {
                if (p < 1 || p > this.total_page) return;
                this.page = p;
                this.fetchList();
            },

            async openDetailModal(item) {
                const targetId = item.pengiriman_id || item.temp_id;
                this.detailData = item;
                this.showDetailModal = true;
                this.loadingDetail = true;

                try {
                    const resp = await api.getDetailPengiriman(targetId);
                    if (resp.ok && resp.data) {
                        this.detailData = resp.data;
                    }
                } catch (e) {
                    console.error('Error fetching detail pengiriman:', e);
                } finally {
                    this.loadingDetail = false;
                }
            },

            formatDate(isoStr) {
                if (!isoStr) return '-';
                try {
                    const d = new Date(isoStr);
                    return d.toLocaleDateString('id-ID', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    });
                } catch {
                    return isoStr;
                }
            }
        }));
        window._historiPengirimanRegistered = true;
    }
}
