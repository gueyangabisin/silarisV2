/**
 * RFID Linen Pro — Kategori Linen Page (Fase 1 Proof-of-Concept)
 *
 * Full CRUD management for linen categories.
 * Uses Alpine.js x-data component for reactive state.
 * Visually identical to the legacy manajemen_kategori.html.
 *
 * Page lifecycle:
 *   render() → returns HTML template string with Alpine directives
 *   mount()  → nothing (pure REST, no WS subscriptions)
 *   unmount()→ nothing to clean up
 */

import { api } from '../api.js';
import { showSuccessToast, showErrorModal as showGlobalErrorModal } from '../shell.js';

export const kategoriLinenPage = {
    render() {
        return `
<div x-data="kategoriLinenData()" x-init="fetchList()">
    <!-- Glass Panel Container -->
    <div class="glass-panel rounded-2xl border border-glass-border shadow-sm w-full overflow-hidden flex flex-col">
        <!-- Header Controls -->
        <div class="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-glass-border">
            <div>
                <h1 class="font-headline-lg font-bold text-primary text-2xl">Manajemen Kategori Linen</h1>
                <p class="font-body-md text-on-surface-variant">Kelola daftar kelompok/kategori barang linen (Sprei, Handuk, Selimut, dll).</p>
            </div>
            <button @click="openAddModal()" class="bg-primary hover:bg-primary/90 text-on-primary font-label-lg px-5 py-2.5 rounded-full shadow-md transition-all flex items-center gap-2">
                <span class="material-symbols-outlined text-[20px]">add</span>
                Tambah Kategori
            </button>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="bg-white/40 text-on-surface-variant font-label-md border-b border-glass-border">
                        <th class="py-3 px-6">ID Kategori</th>
                        <th class="py-3 px-6">Nama Kategori</th>
                        <th class="py-3 px-6">Keterangan</th>
                        <th class="py-3 px-6 text-center">Jumlah Linen Terdaftar</th>
                        <th class="py-3 px-6 text-right">Aksi</th>
                    </tr>
                </thead>
                <tbody>
                    <!-- Loading State -->
                    <template x-if="loading">
                        <tr>
                            <td colspan="5" class="py-8 text-center text-on-surface-variant">
                                <div class="flex items-center justify-center gap-3">
                                    <div class="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                    Memuat data kategori...
                                </div>
                            </td>
                        </tr>
                    </template>

                    <!-- Empty State -->
                    <template x-if="!loading && items.length === 0">
                        <tr>
                            <td colspan="5" class="py-8 text-center text-on-surface-variant">
                                Belum ada kategori linen. Klik 'Tambah Kategori' untuk membuat baru.
                            </td>
                        </tr>
                    </template>

                    <!-- Data Rows -->
                    <template x-for="item in items" :key="item.kategori_id">
                        <tr class="border-b border-glass-border/50 hover:bg-white/20 transition-colors">
                            <td class="py-3.5 px-6 font-data-mono font-bold text-primary" x-text="'#' + item.kategori_id"></td>
                            <td class="py-3.5 px-6 font-body-md font-semibold" x-text="item.nama"></td>
                            <td class="py-3.5 px-6 font-body-md text-on-surface-variant" x-text="item.keterangan || '-'"></td>
                            <td class="py-3.5 px-6 text-center">
                                <span class="inline-block px-3 py-1 bg-primary/10 text-primary font-bold rounded-full text-label-sm"
                                      x-text="item.jumlah_linen + ' Linen'"></span>
                            </td>
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
            <h2 class="font-headline-md font-bold text-primary" x-text="editMode ? 'Edit Kategori Linen' : 'Tambah Kategori Baru'"></h2>
            <form @submit.prevent="handleSubmit()" class="flex flex-col gap-4">
                <div class="flex flex-col gap-1">
                    <label class="font-label-md text-on-surface">Nama Kategori</label>
                    <input x-model="form.nama" type="text" required placeholder="misal: Sprei, Handuk, Selimut"
                           class="bg-white/60 border border-glass-border rounded-xl px-4 py-2 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="font-label-md text-on-surface">Keterangan (Opsional)</label>
                    <textarea x-model="form.keterangan" rows="3" placeholder="Catatan tambahan..."
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
                <h3 class="font-headline-md font-bold">Hapus Kategori?</h3>
            </div>
            <p class="font-body-md text-on-surface-variant">
                Apakah Anda yakin ingin menghapus kategori
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

    mount() {
        // Pure REST page — no WS subscriptions needed
    },

    unmount() {
        // Nothing to clean up
    },
};

/**
 * Alpine.js data component for Kategori Linen page.
 * Registered globally so Alpine can find it via x-data="kategoriLinenData()".
 */
export function registerKategoriLinenComponent() {
    if (window.Alpine && !window._kategoriLinenRegistered) {
        window.Alpine.data('kategoriLinenData', () => ({
            items: [],
            loading: true,
            fetchError: null,
            showModal: false,
            showDeleteConfirm: false,
            editMode: false,
            submitting: false,
            form: { nama: '', keterangan: '' },
            editId: null,
            deleteTarget: null,
            errorModal: { show: false, title: '', message: '' },

            async fetchList() {
                this.loading = true;
                this.fetchError = null;
                try {
                    const resp = await api.getKategoriList();
                    if (!resp.ok) throw new Error(resp.data?.detail || 'Gagal mengambil data kategori');
                    this.items = resp.data;
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
                this.form = { nama: '', keterangan: '' };
                this.showModal = true;
            },

            openEditModal(item) {
                this.editMode = true;
                this.editId = item.kategori_id;
                this.form = { nama: item.nama, keterangan: item.keterangan || '' };
                this.showModal = true;
            },

            closeModal() {
                this.showModal = false;
            },

            async handleSubmit() {
                this.submitting = true;
                const payload = {
                    nama: this.form.nama.trim(),
                    keterangan: this.form.keterangan.trim() || null,
                };

                try {
                    let resp;
                    if (this.editMode) {
                        resp = await api.updateKategori(this.editId, payload);
                    } else {
                        resp = await api.createKategori(payload);
                    }

                    if (!resp.ok) {
                        this.errorModal = {
                            show: true,
                            title: 'Gagal Menyimpan Kategori',
                            message: resp.data?.detail || 'Terjadi kesalahan.',
                        };
                        return;
                    }

                    showSuccessToast(this.editMode ? 'Kategori berhasil diperbarui!' : 'Kategori baru berhasil dibuat!');
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
                    const resp = await api.deleteKategori(this.deleteTarget.kategori_id);
                    if (!resp.ok) {
                        this.showDeleteConfirm = false;
                        this.errorModal = {
                            show: true,
                            title: 'Gagal Menghapus Kategori',
                            message: resp.data?.detail || 'Kategori masih dipakai.',
                        };
                        return;
                    }

                    showSuccessToast('Kategori berhasil dihapus.');
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
        window._kategoriLinenRegistered = true;
    }
}
