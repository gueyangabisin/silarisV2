/**
 * RFID Linen Pro — Manajemen Nama Linen Page
 *
 * Full CRUD management for linen item names (e.g. Sprei Standar, Handuk Mandi, etc.)
 * Uses Alpine.js x-data component for reactive state.
 */

import { api } from '../api.js';
import { showSuccessToast } from '../shell.js';

export const namaLinenPage = {
    render() {
        return `
<div x-data="namaLinenData()" x-init="initPage()">
    <!-- Glass Panel Container -->
    <div class="glass-panel rounded-2xl border border-glass-border shadow-sm w-full overflow-hidden flex flex-col">
        <!-- Header Controls -->
        <div class="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-glass-border">
            <div>
                <h1 class="font-headline-lg font-bold text-primary text-2xl">Manajemen Nama Linen</h1>
                <p class="font-body-md text-on-surface-variant">Kelola jenis & nama spesifik barang linen per kategori.</p>
            </div>
            <div class="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                <!-- Dropdown Filter Kategori -->
                <select x-model="filterKategoriId" @change="fetchList()"
                        class="bg-white/60 border border-glass-border rounded-xl px-4 py-2 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface">
                    <option value="">Semua Kategori</option>
                    <template x-for="kat in kategoriList" :key="kat.kategori_id">
                        <option :value="kat.kategori_id" x-text="kat.nama"></option>
                    </template>
                </select>

                <button @click="openAddModal()" class="bg-primary hover:bg-primary/90 text-on-primary font-label-lg px-5 py-2.5 rounded-full shadow-md transition-all flex items-center gap-2">
                    <span class="material-symbols-outlined text-[20px]">add</span>
                    Tambah Nama Linen
                </button>
            </div>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="bg-white/40 text-on-surface-variant font-label-md border-b border-glass-border">
                        <th class="py-3 px-6">ID</th>
                        <th class="py-3 px-6">Kategori</th>
                        <th class="py-3 px-6">Nama Linen</th>
                        <th class="py-3 px-6">Keterangan</th>
                        <th class="py-3 px-6 text-center">Linen Terdaftar</th>
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
                                    Memuat data nama linen...
                                </div>
                            </td>
                        </tr>
                    </template>

                    <!-- Empty State -->
                    <template x-if="!loading && items.length === 0">
                        <tr>
                            <td colspan="6" class="py-8 text-center text-on-surface-variant">
                                Belum ada data nama linen. Klik 'Tambah Nama Linen' untuk membuat baru.
                            </td>
                        </tr>
                    </template>

                    <!-- Data Rows -->
                    <template x-for="item in items" :key="item.nama_linen_id">
                        <tr class="border-b border-glass-border/50 hover:bg-white/20 transition-colors">
                            <td class="py-3.5 px-6 font-data-mono font-bold text-primary" x-text="'#' + item.nama_linen_id"></td>
                            <td class="py-3.5 px-6 font-body-md font-medium">
                                <span class="inline-block px-3 py-1 bg-primary/10 text-primary font-bold rounded-full text-label-sm"
                                      x-text="item.nama_kategori || item.kategori?.nama || ('Kategori #' + item.kategori_id)"></span>
                            </td>
                            <td class="py-3.5 px-6 font-body-md font-semibold" x-text="item.nama"></td>
                            <td class="py-3.5 px-6 font-body-md text-on-surface-variant" x-text="item.keterangan || '-'"></td>
                            <td class="py-3.5 px-6 text-center font-data-mono font-semibold" x-text="(item.jumlah_linen || 0) + ' Unit'"></td>
                            <td class="py-3.5 px-6 text-right">
                                <button @click="openEditModal(item)" class="text-primary hover:underline font-label-md mr-3">Edit</button>
                                <button @click="confirmDelete(item)" class="text-status-error hover:underline font-label-md">Hapus</button>
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
            <h2 class="font-headline-md font-bold text-primary" x-text="editMode ? 'Edit Nama Linen' : 'Tambah Nama Linen Baru'"></h2>
            <form @submit.prevent="handleSubmit()" class="flex flex-col gap-4">
                <div class="flex flex-col gap-1">
                    <label class="font-label-md text-on-surface">Kategori Linen <span class="text-status-error">*</span></label>
                    <select x-model="form.kategori_id" required
                            class="bg-white/60 border border-glass-border rounded-xl px-4 py-2 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface">
                        <option value="" disabled>-- Pilih Kategori --</option>
                        <template x-for="kat in kategoriList" :key="kat.kategori_id">
                            <option :value="kat.kategori_id" x-text="kat.nama"></option>
                        </template>
                    </select>
                </div>
                <div class="flex flex-col gap-1">
                    <label class="font-label-md text-on-surface">Nama Linen <span class="text-status-error">*</span></label>
                    <input x-model="form.nama" type="text" required placeholder="misal: Sprei Super King, Handuk Wajah"
                           class="bg-white/60 border border-glass-border rounded-xl px-4 py-2 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="font-label-md text-on-surface">Keterangan (Opsional)</label>
                    <textarea x-model="form.keterangan" rows="3" placeholder="Spesifikasi atau catatan tambahan..."
                              class="bg-white/60 border border-glass-border rounded-xl px-4 py-2 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/50"></textarea>
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
                <h3 class="font-headline-md font-bold">Hapus Nama Linen?</h3>
            </div>
            <p class="font-body-md text-on-surface-variant">
                Apakah Anda yakin ingin menghapus nama linen
                <strong class="text-on-surface" x-text="deleteTarget?.nama"></strong>?
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

    mount() {},
    unmount() {},
};

export function registerNamaLinenComponent() {
    if (window.Alpine && !window._namaLinenRegistered) {
        window.Alpine.data('namaLinenData', () => ({
            items: [],
            kategoriList: [],
            filterKategoriId: '',
            loading: true,
            fetchError: null,
            showModal: false,
            showDeleteConfirm: false,
            editMode: false,
            submitting: false,
            form: { kategori_id: '', nama: '', keterangan: '' },
            editId: null,
            deleteTarget: null,
            errorModal: { show: false, title: '', message: '' },

            async initPage() {
                this.loading = true;
                this.fetchError = null;
                try {
                    const [katResp, namaResp] = await Promise.all([
                        api.getKategoriList(),
                        api.getNamaLinenList(),
                    ]);
                    if (katResp.ok) this.kategoriList = katResp.data || [];
                    if (!namaResp.ok) throw new Error(namaResp.data?.detail || 'Gagal mengambil data nama linen');
                    this.items = namaResp.data || [];
                } catch (err) {
                    console.error(err);
                    this.fetchError = err.message;
                } finally {
                    this.loading = false;
                }
            },

            async fetchList() {
                this.loading = true;
                this.fetchError = null;
                try {
                    const katId = this.filterKategoriId ? parseInt(this.filterKategoriId, 10) : null;
                    const resp = await api.getNamaLinenList(katId);
                    if (!resp.ok) throw new Error(resp.data?.detail || 'Gagal mengambil data nama linen');
                    this.items = resp.data || [];
                } catch (err) {
                    console.error(err);
                    this.fetchError = err.message;
                } finally {
                    this.loading = false;
                }
            },

            openAddModal() {
                this.editMode = false;
                this.editId = null;
                this.form = {
                    kategori_id: this.filterKategoriId ? parseInt(this.filterKategoriId, 10) : '',
                    nama: '',
                    keterangan: '',
                };
                this.showModal = true;
            },

            openEditModal(item) {
                this.editMode = true;
                this.editId = item.nama_linen_id;
                this.form = {
                    kategori_id: item.kategori_id,
                    nama: item.nama,
                    keterangan: item.keterangan || '',
                };
                this.showModal = true;
            },

            closeModal() {
                this.showModal = false;
            },

            async handleSubmit() {
                this.submitting = true;
                const payload = {
                    kategori_id: parseInt(this.form.kategori_id, 10),
                    nama: this.form.nama.trim(),
                    keterangan: this.form.keterangan.trim() || null,
                };

                try {
                    let resp;
                    if (this.editMode) {
                        resp = await api.updateNamaLinen(this.editId, payload);
                    } else {
                        resp = await api.createNamaLinen(payload);
                    }

                    if (!resp.ok) {
                        this.errorModal = {
                            show: true,
                            title: 'Gagal Menyimpan Nama Linen',
                            message: resp.data?.detail || 'Terjadi kesalahan.',
                        };
                        return;
                    }

                    showSuccessToast(this.editMode ? 'Nama Linen berhasil diperbarui!' : 'Nama Linen baru berhasil dibuat!');
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
                    const resp = await api.deleteNamaLinen(this.deleteTarget.nama_linen_id);
                    if (!resp.ok) {
                        this.showDeleteConfirm = false;
                        this.errorModal = {
                            show: true,
                            title: 'Gagal Menghapus Nama Linen',
                            message: resp.data?.detail || 'Nama linen masih dipakai oleh item linen.',
                        };
                        return;
                    }

                    showSuccessToast('Nama Linen berhasil dihapus.');
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
        }));
        window._namaLinenRegistered = true;
    }
}
