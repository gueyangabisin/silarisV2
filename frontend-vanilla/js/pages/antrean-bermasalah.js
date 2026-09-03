/**
 * RFID Linen Pro — Pengiriman: Antrean Bermasalah Page
 *
 * Queue management for failed/pending offline shipment sync transactions.
 * Provides retry and cancel actions.
 */

import { api } from '../api.js';
import { showSuccessToast } from '../shell.js';

export const antreanBermasalahPage = {
    render() {
        return `
<div x-data="antreanBermasalahData()" x-init="fetchList()">
    <!-- Glass Panel Container -->
    <div class="glass-panel rounded-2xl border border-glass-border shadow-sm w-full overflow-hidden flex flex-col">
        <!-- Header Controls -->
        <div class="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-glass-border">
            <div>
                <div class="flex items-center gap-2">
                    <h1 class="font-headline-lg font-bold text-status-error text-2xl">Antrean Pengiriman Bermasalah</h1>
                    <span class="px-2.5 py-0.5 bg-status-error/10 text-status-error font-bold rounded-full text-label-sm">Perlu Tindakan</span>
                </div>
                <p class="font-body-md text-on-surface-variant">Daftar transaksi pengiriman yang gagal sinkronisasi ke cloud database (Supabase).</p>
            </div>
            <button @click="fetchList()" class="border border-glass-border bg-white/50 hover:bg-white text-on-surface font-label-md px-4 py-2 rounded-full transition-all flex items-center gap-2">
                <span class="material-symbols-outlined text-[18px]">refresh</span>
                Refresh Data
            </button>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="bg-white/40 text-on-surface-variant font-label-md border-b border-glass-border">
                        <th class="py-3 px-6">Temp ID Transaksi</th>
                        <th class="py-3 px-6">Rumah Sakit Tujuan</th>
                        <th class="py-3 px-6">Waktu Dibuat</th>
                        <th class="py-3 px-6 text-center">Jumlah Linen</th>
                        <th class="py-3 px-6">Pesan Error / Status</th>
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
                                    Memuat antrean bermasalah...
                                </div>
                            </td>
                        </tr>
                    </template>

                    <!-- Empty State -->
                    <template x-if="!loading && items.length === 0">
                        <tr>
                            <td colspan="6" class="py-12 text-center text-on-surface-variant">
                                <div class="flex flex-col items-center gap-3">
                                    <span class="material-symbols-outlined text-[48px] text-status-success" style="font-variation-settings: 'FILL' 1;">check_circle</span>
                                    <p class="font-headline-md font-semibold text-lg text-on-surface">Tidak Ada Antrean Bermasalah</p>
                                    <p class="font-body-md text-sm max-w-sm">Seluruh transaksi pengiriman berhasil tersinkronisasi atau antrean kosong.</p>
                                </div>
                            </td>
                        </tr>
                    </template>

                    <!-- Data Rows -->
                    <template x-for="item in items" :key="item.temp_id">
                        <tr class="border-b border-glass-border/50 hover:bg-white/20 transition-colors">
                            <td class="py-3.5 px-6 font-data-mono font-bold text-status-error" x-text="item.temp_id"></td>
                            <td class="py-3.5 px-6 font-body-md font-semibold" x-text="item.nama_rs || item.kode_rs || '-'"></td>
                            <td class="py-3.5 px-6 font-body-md text-on-surface-variant" x-text="formatDate(item.created_at || item.waktu)"></td>
                            <td class="py-3.5 px-6 text-center">
                                <span class="inline-block px-3 py-1 bg-status-error/10 text-status-error font-bold rounded-full text-label-sm"
                                      x-text="(item.total_linen || item.items?.length || 0) + ' Item'"></span>
                            </td>
                            <td class="py-3.5 px-6 font-body-md text-status-error text-xs max-w-xs truncate" x-text="item.last_error || item.error_msg || 'Gagal sinkron Supabase'"></td>
                            <td class="py-3.5 px-6 text-right">
                                <div class="flex items-center justify-end gap-2">
                                    <button @click="retryItem(item)" :disabled="actionId === item.temp_id"
                                            class="bg-primary hover:bg-primary/90 text-on-primary font-label-md px-3.5 py-1.5 rounded-full shadow-sm transition-all flex items-center gap-1">
                                        <span class="material-symbols-outlined text-[16px]">sync</span>
                                        Coba Lagi
                                    </button>
                                    <button @click="confirmCancel(item)" :disabled="actionId === item.temp_id"
                                            class="bg-status-error/10 hover:bg-status-error text-status-error hover:text-white font-label-md px-3.5 py-1.5 rounded-full transition-all">
                                        Batalkan
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </template>
                </tbody>
            </table>
        </div>

        <!-- Error State -->
        <template x-if="fetchError">
            <div class="p-6 text-center text-status-error font-body-md" x-text="'Error: ' + fetchError"></div>
        </template>
    </div>

    <!-- ═══ Modal Konfirmasi Pembatalan ═══ -->
    <div x-show="showCancelConfirm"
         x-transition:enter="transition ease-out duration-200"
         x-transition:enter-start="opacity-0"
         x-transition:enter-end="opacity-100"
         x-transition:leave="transition ease-in duration-150"
         x-transition:leave-start="opacity-100"
         x-transition:leave-end="opacity-0"
         class="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
         style="display: none;"
         @keydown.escape.window="showCancelConfirm = false">
        <div @click.outside="showCancelConfirm = false"
             class="bg-surface/90 backdrop-blur-2xl border border-glass-border rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4">
            <div class="flex items-center gap-3 text-status-error">
                <span class="material-symbols-outlined text-[28px]">warning</span>
                <h3 class="font-headline-md font-bold">Batalkan Pengiriman?</h3>
            </div>
            <p class="font-body-md text-on-surface-variant">
                Apakah Anda yakin ingin membatalkan transaksi pengiriman
                <strong class="text-on-surface font-data-mono" x-text="targetCancel?.temp_id"></strong>?
                Status seluruh linen dalam transaksi ini akan dikembalikan menjadi <strong>Tersedia</strong>.
            </p>
            <div class="flex justify-end gap-3 mt-2">
                <button @click="showCancelConfirm = false" class="px-5 py-2 rounded-full border border-glass-border text-label-lg hover:bg-white/50 transition-colors">Tidak, Batal</button>
                <button @click="executeCancel()" class="bg-status-error text-white px-6 py-2 rounded-full font-label-lg shadow-md hover:bg-status-error/90 transition-colors"
                        :disabled="submitting">
                    Ya, Batalkan Transaksi
                </button>
            </div>
        </div>
    </div>

    <!-- ═══ Modal Error ═══ -->
    <div x-show="errorModal.show"
         x-transition:enter="transition ease-out duration-200"
         x-transition:enter-start="opacity-0"
         x-transition:enter-end="opacity-100"
         x-transition:leave="transition ease-in duration-150"
         x-transition:leave-start="opacity-100"
         x-transition:leave-end="opacity-0"
         class="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
         style="display: none;">
        <div class="bg-surface/90 backdrop-blur-2xl border border-glass-border rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4 text-on-surface">
            <div class="flex items-center gap-3 text-status-error">
                <span class="material-symbols-outlined text-[28px]">error</span>
                <h3 class="font-headline-md font-bold" x-text="errorModal.title"></h3>
            </div>
            <p class="font-body-md text-on-surface-variant" x-text="errorModal.message"></p>
            <div class="flex justify-end mt-2">
                <button @click="errorModal.show = false" class="bg-primary text-on-primary font-label-lg px-6 py-2 rounded-full hover:bg-primary/90 transition-colors">Tutup</button>
            </div>
        </div>
    </div>
</div>
        `;
    },

    mount() {},
    unmount() {},
};

export function registerAntreanBermasalahComponent() {
    if (window.Alpine && !window._antreanBermasalahRegistered) {
        window.Alpine.data('antreanBermasalahData', () => ({
            items: [],
            loading: true,
            fetchError: null,
            actionId: null,
            showCancelConfirm: false,
            targetCancel: null,
            submitting: false,
            errorModal: { show: false, title: '', message: '' },

            async fetchList() {
                this.loading = true;
                this.fetchError = null;
                try {
                    const resp = await api.getAntreanBermasalah();
                    if (!resp.ok) throw new Error(resp.data?.detail || 'Gagal mengambil antrean bermasalah');
                    this.items = resp.data || [];
                } catch (err) {
                    console.error(err);
                    this.fetchError = err.message;
                } finally {
                    this.loading = false;
                }
            },

            async retryItem(item) {
                this.actionId = item.temp_id;
                try {
                    const resp = await api.retryPengiriman(item.temp_id);
                    if (!resp.ok) {
                        this.errorModal = {
                            show: true,
                            title: 'Gagal Coba Lagi',
                            message: resp.data?.detail || 'Gagal melakukan sinkronisasi ulang.',
                        };
                        return;
                    }

                    showSuccessToast('Proses pengiriman berhasil dicoba ulang!');
                    await this.fetchList();
                } catch (e) {
                    this.errorModal = {
                        show: true,
                        title: 'Error',
                        message: 'Gagal menghubungi server.',
                    };
                } finally {
                    this.actionId = null;
                }
            },

            confirmCancel(item) {
                this.targetCancel = item;
                this.showCancelConfirm = true;
            },

            async executeCancel() {
                if (!this.targetCancel) return;
                this.submitting = true;
                const tempId = this.targetCancel.temp_id;

                try {
                    const resp = await api.cancelPengiriman(tempId);
                    if (!resp.ok) {
                        this.showCancelConfirm = false;
                        this.errorModal = {
                            show: true,
                            title: 'Gagal Membatalkan Pengiriman',
                            message: resp.data?.detail || 'Pengiriman gagal dibatalkan.',
                        };
                        return;
                    }

                    showSuccessToast('Pengiriman berhasil dibatalkan. Status linen dikembalikan.');
                    this.showCancelConfirm = false;
                    this.targetCancel = null;
                    await this.fetchList();
                } catch (e) {
                    this.showCancelConfirm = false;
                    this.errorModal = {
                        show: true,
                        title: 'Error',
                        message: 'Gagal menghubungi server.',
                    };
                } finally {
                    this.submitting = false;
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
        window._antreanBermasalahRegistered = true;
    }
}
