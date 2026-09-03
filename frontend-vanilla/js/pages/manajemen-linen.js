/**
 * RFID Linen Pro — Manajemen Linen Page
 *
 * Search, filter, pagination, and CRUD for individual linen items with RFID EPC tags.
 * Uses Alpine.js x-data component for reactive state.
 */

import { api } from '../api.js';
import { showSuccessToast } from '../shell.js';

export const manajemenLinenPage = {
    render() {
        return `
<div x-data="manajemenLinenData()" x-init="initPage()">
    <!-- Glass Panel Container -->
    <div class="glass-panel rounded-2xl border border-glass-border shadow-sm w-full overflow-hidden flex flex-col">
        <!-- Header Controls -->
        <div class="p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-glass-border">
            <div>
                <h1 class="font-headline-lg font-bold text-primary text-2xl">Manajemen Linen</h1>
                <p class="font-body-md text-on-surface-variant">Daftar seluruh item linen terdaftar, status keberadaan, dan Tag EPC RFID.</p>
            </div>
            <button @click="openAddModal()" class="bg-primary hover:bg-primary/90 text-on-primary font-label-lg px-5 py-2.5 rounded-full shadow-md transition-all flex items-center gap-2 shrink-0">
                <span class="material-symbols-outlined text-[20px]">add</span>
                Tambah Linen Baru
            </button>
        </div>

        <!-- Filter & Search Bar -->
        <div class="px-6 py-4 bg-white/30 border-b border-glass-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <!-- Search Input -->
            <div class="relative flex-1 max-w-md">
                <span class="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
                <input type="text" x-model="search" @input="onSearchInput()" placeholder="Cari berdasarkan EPC, nama linen, atau ID..."
                       class="w-full bg-white/70 border border-glass-border rounded-xl pl-10 pr-4 py-2 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface" />
            </div>

            <!-- Filter Status -->
            <div class="flex items-center gap-3">
                <label class="font-label-md text-on-surface shrink-0">Status:</label>
                <select x-model="filterStatus" @change="onStatusChange()"
                        class="bg-white/70 border border-glass-border rounded-xl px-4 py-2 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface">
                    <option value="">Semua Status</option>
                    <option value="Tersedia">Tersedia</option>
                    <option value="Dikirim">Dikirim</option>
                </select>
            </div>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="bg-white/40 text-on-surface-variant font-label-md border-b border-glass-border">
                        <th class="py-3 px-6">Tag EPC (RFID)</th>
                        <th class="py-3 px-6">Nama Linen</th>
                        <th class="py-3 px-6">Kategori</th>
                        <th class="py-3 px-6">Status</th>
                        <th class="py-3 px-6">Tanggal Terdaftar</th>
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
                                    Memuat data linen...
                                </div>
                            </td>
                        </tr>
                    </template>

                    <!-- Empty State -->
                    <template x-if="!loading && items.length === 0">
                        <tr>
                            <td colspan="6" class="py-8 text-center text-on-surface-variant">
                                Tidak ada data linen yang sesuai pencarian/filter.
                            </td>
                        </tr>
                    </template>

                    <!-- Data Rows -->
                    <template x-for="item in items" :key="item.epc">
                        <tr class="border-b border-glass-border/50 hover:bg-white/20 transition-colors">
                            <td class="py-3.5 px-6 font-data-mono font-bold text-primary" x-text="item.epc"></td>
                            <td class="py-3.5 px-6 font-body-md font-semibold" x-text="item.nama_linen || item.nama || '-'"></td>
                            <td class="py-3.5 px-6 font-body-md">
                                <span class="inline-block px-3 py-1 bg-primary/10 text-primary font-bold rounded-full text-label-sm"
                                      x-text="item.kategori || item.nama_kategori || '-'"></span>
                            </td>
                            <td class="py-3.5 px-6 font-body-md">
                                <template x-if="item.status === 'Tersedia'">
                                    <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-status-success/10 text-status-success font-bold rounded-full text-label-sm">
                                        <span class="w-2 h-2 rounded-full bg-status-success"></span>
                                        Tersedia
                                    </span>
                                </template>
                                <template x-if="item.status === 'Dikirim'">
                                    <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-primary-container/10 text-primary-container font-bold rounded-full text-label-sm">
                                        <span class="w-2 h-2 rounded-full bg-primary-container"></span>
                                        Dikirim
                                    </span>
                                </template>
                                <template x-if="item.status !== 'Tersedia' && item.status !== 'Dikirim'">
                                    <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-200 text-gray-700 font-bold rounded-full text-label-sm" x-text="item.status"></span>
                                </template>
                            </td>
                            <td class="py-3.5 px-6 font-body-md text-on-surface-variant" x-text="formatDate(item.created_at || item.created_at_str)"></td>
                            <td class="py-3.5 px-6 text-right">
                                <button @click="openEditModal(item)" class="text-primary hover:underline font-label-md mr-3">Edit</button>
                                <button @click="confirmDelete(item)" class="text-status-error hover:underline font-label-md">Hapus</button>
                            </td>
                        </tr>
                    </template>
                </tbody>
            </table>
        </div>

        <!-- Pagination Controls -->
        <div class="p-4 bg-white/20 border-t border-glass-border flex flex-col sm:flex-row items-center justify-between gap-4 font-label-md text-on-surface-variant">
            <div>
                Menampilkan <span class="font-bold text-on-surface" x-text="items.length"></span> dari <span class="font-bold text-on-surface" x-text="total_data"></span> item linen
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

    <!-- ═══ Modal Form (Tambah / Edit) ═══ -->
    <div x-show="showModal"
         x-transition:enter="transition ease-out duration-200"
         x-transition:enter-start="opacity-0"
         x-transition:enter-end="opacity-100"
         x-transition:leave="transition ease-in duration-150"
         x-transition:leave-start="opacity-100"
         x-transition:leave-end="opacity-0"
         class="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
         style="display: none;"
         @keydown.escape.window="closeModal()">
        <div @click.outside="closeModal()"
             x-transition:enter="transition ease-out duration-200"
             x-transition:enter-start="opacity-0 scale-95"
             x-transition:enter-end="opacity-100 scale-100"
             class="bg-surface/90 backdrop-blur-2xl border border-glass-border rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4">
            <h2 class="font-headline-md font-bold text-primary" x-text="editMode ? 'Edit Linen' : 'Tambah Linen Baru'"></h2>
            <form @submit.prevent="handleSubmit()" class="flex flex-col gap-4">
                <!-- Tag EPC (RFID) -->
                <div class="flex flex-col gap-1">
                    <label class="font-label-md text-on-surface">Tag EPC (RFID) <span class="text-status-error">*</span></label>
                    <input x-model="form.epc" type="text" required :readonly="editMode" placeholder="e.g. E2801191A0000001"
                           :class="editMode ? 'bg-black/10 cursor-not-allowed text-on-surface-variant' : 'bg-white/60 focus:ring-2 focus:ring-primary/50'"
                           class="border border-glass-border rounded-xl px-4 py-2 font-data-mono font-bold focus:outline-none" />
                </div>

                <!-- Dependent Dropdown: Kategori Linen -->
                <div class="flex flex-col gap-1">
                    <label class="font-label-md text-on-surface">Kategori Linen <span class="text-status-error">*</span></label>
                    <select x-model="form.kategori_id" @change="onFormKategoriChange()" required
                            class="bg-white/60 border border-glass-border rounded-xl px-4 py-2 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface">
                        <option value="" disabled>-- Pilih Kategori --</option>
                        <template x-for="kat in kategoriList" :key="kat.kategori_id">
                            <option :value="kat.kategori_id" x-text="kat.nama"></option>
                        </template>
                    </select>
                </div>

                <!-- Dependent Dropdown: Nama Linen -->
                <div class="flex flex-col gap-1">
                    <label class="font-label-md text-on-surface">Nama Linen <span class="text-status-error">*</span></label>
                    <select x-model="form.nama_linen_id" required :disabled="loadingNamaLinen || namaLinenOptions.length === 0"
                            class="bg-white/60 border border-glass-border rounded-xl px-4 py-2 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface disabled:opacity-50">
                        <option value="" disabled>-- Pilih Nama Linen --</option>
                        <template x-for="nl in namaLinenOptions" :key="nl.nama_linen_id">
                            <option :value="nl.nama_linen_id" x-text="nl.nama"></option>
                        </template>
                    </select>
                </div>

                <!-- Status Linen -->
                <div class="flex flex-col gap-1">
                    <label class="font-label-md text-on-surface">Status Status</label>
                    <select x-model="form.status" required
                            class="bg-white/60 border border-glass-border rounded-xl px-4 py-2 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface">
                        <option value="Tersedia">Tersedia</option>
                        <option value="Dikirim">Dikirim</option>
                    </select>
                </div>

                <div class="flex justify-end gap-3 mt-4">
                    <button type="button" @click="closeModal()" class="px-5 py-2 rounded-full border border-glass-border text-label-lg hover:bg-white/50 transition-colors">Batal</button>
                    <button type="submit" class="bg-primary text-on-primary px-6 py-2 rounded-full font-label-lg shadow-md hover:bg-primary/90 transition-colors"
                            :disabled="submitting">
                        <span x-show="!submitting">Simpan</span>
                        <span x-show="submitting" class="flex items-center gap-2">
                            <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            Menyimpan...
                        </span>
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- ═══ Modal Konfirmasi Hapus ═══ -->
    <div x-show="showDeleteConfirm"
         x-transition:enter="transition ease-out duration-200"
         x-transition:enter-start="opacity-0"
         x-transition:enter-end="opacity-100"
         x-transition:leave="transition ease-in duration-150"
         x-transition:leave-start="opacity-100"
         x-transition:leave-end="opacity-0"
         class="fixed inset-0 z-[150] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
         style="display: none;"
         @keydown.escape.window="showDeleteConfirm = false">
        <div @click.outside="showDeleteConfirm = false"
             class="bg-surface/90 backdrop-blur-2xl border border-glass-border rounded-2xl p-6 max-w-md w-full shadow-2xl flex flex-col gap-4">
            <div class="flex items-center gap-3 text-status-error">
                <span class="material-symbols-outlined text-[28px]">warning</span>
                <h3 class="font-headline-md font-bold">Hapus Item Linen?</h3>
            </div>
            <p class="font-body-md text-on-surface-variant">
                Apakah Anda yakin ingin menghapus item linen dengan EPC
                <strong class="text-on-surface font-data-mono" x-text="deleteTarget?.epc"></strong>?
                Tindakan ini tidak dapat dibatalkan.
            </p>
            <div class="flex justify-end gap-3 mt-2">
                <button @click="showDeleteConfirm = false" class="px-5 py-2 rounded-full border border-glass-border text-label-lg hover:bg-white/50 transition-colors">Batal</button>
                <button @click="executeDelete()" class="bg-status-error text-white px-6 py-2 rounded-full font-label-lg shadow-md hover:bg-status-error/90 transition-colors"
                        :disabled="submitting">
                    Hapus
                </button>
            </div>
        </div>
    </div>

    <!-- ═══ Modal Error (e.g. 409 conflict) ═══ -->
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

    mount() { },
    unmount() { },
};

export function registerManajemenLinenComponent() {
    if (window.Alpine && !window._manajemenLinenRegistered) {
        window.Alpine.data('manajemenLinenData', () => ({
            items: [],
            total_data: 0,
            total_page: 1,
            page: 1,
            limit: 50,
            search: '',
            filterStatus: '',
            kategoriList: [],
            namaLinenOptions: [],
            loadingNamaLinen: false,
            loading: true,
            fetchError: null,
            searchTimer: null,

            showModal: false,
            showDeleteConfirm: false,
            editMode: false,
            submitting: false,
            form: { epc: '', kategori_id: '', nama_linen_id: '', status: 'Tersedia' },
            editEpc: null,
            deleteTarget: null,
            errorModal: { show: false, title: '', message: '' },

            async initPage() {
                this.fetchKategoriList();
                await this.fetchList();
            },

            async fetchKategoriList() {
                try {
                    const resp = await api.getKategoriList();
                    if (resp.ok) this.kategoriList = resp.data || [];
                } catch (e) {
                    console.error('Error fetching kategori list:', e);
                }
            },

            async fetchList() {
                this.loading = true;
                this.fetchError = null;
                try {
                    const resp = await api.getLinenList(this.page, this.limit, this.search.trim(), this.filterStatus);
                    if (!resp.ok) throw new Error(resp.data?.detail || 'Gagal mengambil data linen');

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

            onSearchInput() {
                if (this.searchTimer) clearTimeout(this.searchTimer);
                this.searchTimer = setTimeout(() => {
                    this.page = 1;
                    this.fetchList();
                }, 350);
            },

            onStatusChange() {
                this.page = 1;
                this.fetchList();
            },

            goToPage(p) {
                if (p < 1 || p > this.total_page) return;
                this.page = p;
                this.fetchList();
            },

            async onFormKategoriChange() {
                if (!this.form.kategori_id) {
                    this.namaLinenOptions = [];
                    this.form.nama_linen_id = '';
                    return;
                }

                this.loadingNamaLinen = true;
                try {
                    const katId = parseInt(this.form.kategori_id, 10);
                    const resp = await api.getNamaLinenList(katId);
                    if (resp.ok) {
                        this.namaLinenOptions = resp.data || [];
                        // Check if current nama_linen_id is still in options
                        const exists = this.namaLinenOptions.some(nl => nl.nama_linen_id === parseInt(this.form.nama_linen_id, 10));
                        if (!exists) {
                            this.form.nama_linen_id = '';
                        }
                    }
                } catch (e) {
                    console.error('Error fetching dependent nama linen:', e);
                } finally {
                    this.loadingNamaLinen = false;
                }
            },

            async openAddModal() {
                this.editMode = false;
                this.editEpc = null;
                this.form = { epc: '', kategori_id: '', nama_linen_id: '', status: 'Tersedia' };
                this.namaLinenOptions = [];
                this.showModal = true;
            },

            async openEditModal(item) {
                this.editMode = true;
                this.editEpc = item.epc;
                this.form = {
                    epc: item.epc,
                    kategori_id: item.kategori_id || '',
                    nama_linen_id: item.nama_linen_id || '',
                    status: item.status || 'Tersedia',
                };

                this.showModal = true;

                // Load dependent nama linen options if kategori_id is set
                if (item.kategori_id) {
                    await this.onFormKategoriChange();
                    this.form.nama_linen_id = item.nama_linen_id || '';
                }
            },

            closeModal() {
                this.showModal = false;
            },

            async handleSubmit() {
                this.submitting = true;
                const payload = {
                    nama_linen_id: parseInt(this.form.nama_linen_id, 10),
                    status: this.form.status,
                };

                try {
                    let resp;
                    if (this.editMode) {
                        resp = await api.updateLinen(this.editEpc, payload);
                    } else {
                        resp = await api.createLinen({
                            epc: this.form.epc.trim(),
                            ...payload,
                        });
                    }

                    if (!resp.ok) {
                        this.errorModal = {
                            show: true,
                            title: 'Gagal Menyimpan Linen',
                            message: resp.data?.detail || 'Terjadi kesalahan.',
                        };
                        return;
                    }

                    showSuccessToast(this.editMode ? 'Data Linen berhasil diperbarui!' : 'Linen baru berhasil didaftarkan!');
                    this.closeModal();
                    await this.fetchList();
                } catch (e) {
                    this.errorModal = {
                        show: true,
                        title: 'Error',
                        message: 'Gagal menghubungi server.',
                    };
                } finally {
                    this.submitting = false;
                }
            },

            confirmDelete(item) {
                this.deleteTarget = item;
                this.showDeleteConfirm = true;
            },

            async executeDelete() {
                if (!this.deleteTarget) return;
                this.submitting = true;

                try {
                    const resp = await api.deleteLinen(this.deleteTarget.epc);
                    if (!resp.ok) {
                        this.showDeleteConfirm = false;
                        this.errorModal = {
                            show: true,
                            title: 'Gagal Menghapus Linen',
                            message: resp.data?.detail || 'Item linen tidak dapat dihapus.',
                        };
                        return;
                    }

                    showSuccessToast('Linen berhasil dihapus.');
                    this.showDeleteConfirm = false;
                    this.deleteTarget = null;
                    await this.fetchList();
                } catch (e) {
                    this.showDeleteConfirm = false;
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
        window._manajemenLinenRegistered = true;
    }
}
