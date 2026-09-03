/**
 * RFID Linen Pro — Admin Cloud: Rumah Sakit Page
 *
 * CRUD management for target hospitals (Rumah Sakit).
 * Displays seeded local cache if Supabase is offline.
 * Handles 503/409 errors gracefully with detail message.
 */

import { api } from '../api.js';
import { showSuccessToast } from '../shell.js';

export const rumahSakitPage = {
    render() {
        return `
<div x-data="rumahSakitData()" x-init="fetchList()">
    <!-- Glass Panel Container -->
    <div class="glass-panel rounded-2xl border border-glass-border shadow-sm w-full overflow-hidden flex flex-col">
        <!-- Header Controls -->
        <div class="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-glass-border">
            <div>
                <div class="flex items-center gap-2">
                    <h1 class="font-headline-lg font-bold text-primary text-2xl">Manajemen Rumah Sakit</h1>
                    <span class="px-2.5 py-0.5 bg-primary/10 text-primary font-bold rounded-full text-label-sm">Admin Cloud</span>
                </div>
                <p class="font-body-md text-on-surface-variant">Kelola akun dan data Rumah Sakit tujuan pengiriman linen.</p>
            </div>
            <button @click="openAddModal()" class="bg-primary hover:bg-primary/90 text-on-primary font-label-lg px-5 py-2.5 rounded-full shadow-md transition-all flex items-center gap-2">
                <span class="material-symbols-outlined text-[20px]">add</span>
                Tambah Rumah Sakit
            </button>
        </div>

        <!-- Table -->
        <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
                <thead>
                    <tr class="bg-white/40 text-on-surface-variant font-label-md border-b border-glass-border">
                        <th class="py-3 px-6">Kode RS</th>
                        <th class="py-3 px-6">Nama Rumah Sakit</th>
                        <th class="py-3 px-6">Alamat</th>
                        <th class="py-3 px-6">Kontak</th>
                        <th class="py-3 px-6">Email</th>
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
                                    Memuat data rumah sakit...
                                </div>
                            </td>
                        </tr>
                    </template>

                    <!-- Empty State -->
                    <template x-if="!loading && items.length === 0">
                        <tr>
                            <td colspan="6" class="py-8 text-center text-on-surface-variant">
                                Belum ada data rumah sakit terdaftar. Klik 'Tambah Rumah Sakit' untuk membuat baru.
                            </td>
                        </tr>
                    </template>

                    <!-- Data Rows -->
                    <template x-for="item in items" :key="item.rs_id || item.kode_rs">
                        <tr class="border-b border-glass-border/50 hover:bg-white/20 transition-colors">
                            <td class="py-3.5 px-6 font-data-mono font-bold text-primary" x-text="item.kode_rs"></td>
                            <td class="py-3.5 px-6 font-body-md font-semibold" x-text="item.nama_rs"></td>
                            <td class="py-3.5 px-6 font-body-md text-on-surface-variant" x-text="item.alamat || '-'"></td>
                            <td class="py-3.5 px-6 font-body-md text-on-surface-variant" x-text="item.kontak || '-'"></td>
                            <td class="py-3.5 px-6 font-body-md text-on-surface-variant" x-text="item.email || '-'"></td>
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
            <h2 class="font-headline-md font-bold text-primary" x-text="editMode ? 'Edit Rumah Sakit' : 'Tambah Rumah Sakit Baru'"></h2>
            <form @submit.prevent="handleSubmit()" class="flex flex-col gap-4">
                <div class="flex flex-col gap-1">
                    <label class="font-label-md text-on-surface">Kode RS <span class="text-status-error">*</span></label>
                    <input x-model="form.kode_rs" type="text" required placeholder="e.g. RS-001"
                           class="bg-white/60 border border-glass-border rounded-xl px-4 py-2 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/50 font-data-mono font-bold" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="font-label-md text-on-surface">Nama Rumah Sakit <span class="text-status-error">*</span></label>
                    <input x-model="form.nama_rs" type="text" required placeholder="misal: RSUD dr. Soetomo"
                           class="bg-white/60 border border-glass-border rounded-xl px-4 py-2 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="font-label-md text-on-surface">Alamat</label>
                    <input x-model="form.alamat" type="text" placeholder="Alamat lengkap..."
                           class="bg-white/60 border border-glass-border rounded-xl px-4 py-2 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="font-label-md text-on-surface">Kontak / Telepon</label>
                    <input x-model="form.kontak" type="text" placeholder="08123456789"
                           class="bg-white/60 border border-glass-border rounded-xl px-4 py-2 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="font-label-md text-on-surface">Email</label>
                    <input x-model="form.email" type="email" placeholder="admin@rs.com"
                           class="bg-white/60 border border-glass-border rounded-xl px-4 py-2 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/50" />
                </div>
                <div class="flex flex-col gap-1">
                    <label class="font-label-md text-on-surface">Password <span x-show="!editMode" class="text-status-error">*</span></label>
                    <input x-model="form.password" type="password" :required="!editMode"
                           :placeholder="editMode ? 'Kosongkan jika tidak ingin mengubah password' : 'Masukkan password akun RS'"
                           class="bg-white/60 border border-glass-border rounded-xl px-4 py-2 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/50" />
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
                <h3 class="font-headline-md font-bold">Hapus Rumah Sakit?</h3>
            </div>
            <p class="font-body-md text-on-surface-variant">
                Apakah Anda yakin ingin menghapus data Rumah Sakit
                <strong class="text-on-surface" x-text="deleteTarget?.nama_rs"></strong>?
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

    <!-- ═══ Modal Error (e.g. 503 Supabase Offline / 409 conflict) ═══ -->
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

export function registerRumahSakitComponent() {
    if (window.Alpine && !window._rumahSakitRegistered) {
        window.Alpine.data('rumahSakitData', () => ({
            items: [],
            loading: true,
            fetchError: null,

            showModal: false,
            showDeleteConfirm: false,
            editMode: false,
            submitting: false,
            form: { kode_rs: '', nama_rs: '', alamat: '', kontak: '', email: '', password: '' },
            editId: null,
            deleteTarget: null,
            errorModal: { show: false, title: '', message: '' },

            async fetchList() {
                this.loading = true;
                this.fetchError = null;
                try {
                    const resp = await api.getRumahSakitList();
                    if (!resp.ok) throw new Error(resp.data?.detail || 'Gagal mengambil data rumah sakit');
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
                this.form = { kode_rs: '', nama_rs: '', alamat: '', kontak: '', email: '', password: '' };
                this.showModal = true;
            },

            openEditModal(item) {
                this.editMode = true;
                this.editId = item.rs_id || item.kode_rs;
                this.form = {
                    kode_rs: item.kode_rs,
                    nama_rs: item.nama_rs,
                    alamat: item.alamat || '',
                    kontak: item.kontak || '',
                    email: item.email || '',
                    password: '', // Blank by default for edit
                };
                this.showModal = true;
            },

            closeModal() {
                this.showModal = false;
            },

            async handleSubmit() {
                this.submitting = true;
                const payload = {
                    kode_rs: this.form.kode_rs.trim(),
                    nama_rs: this.form.nama_rs.trim(),
                    alamat: this.form.alamat.trim() || null,
                    kontak: this.form.kontak.trim() || null,
                    email: this.form.email.trim() || null,
                };

                if (this.form.password.trim()) {
                    payload.password = this.form.password.trim();
                }

                try {
                    let resp;
                    if (this.editMode) {
                        resp = await api.updateRumahSakit(this.editId, payload);
                    } else {
                        resp = await api.createRumahSakit(payload);
                    }

                    if (!resp.ok) {
                        const detailMsg = typeof resp.data?.detail === 'string'
                            ? resp.data.detail
                            : (Array.isArray(resp.data?.detail) ? resp.data.detail[0]?.msg : 'Terjadi kesalahan pada server.');

                        this.errorModal = {
                            show: true,
                            title: resp.status === 503 ? 'Cloud Supabase Offline' : 'Gagal Menyimpan Rumah Sakit',
                            message: detailMsg,
                        };
                        return;
                    }

                    showSuccessToast(this.editMode ? 'Data Rumah Sakit berhasil diperbarui!' : 'Rumah Sakit baru berhasil didaftarkan!');
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
                const targetId = this.deleteTarget.rs_id || this.deleteTarget.kode_rs;

                try {
                    const resp = await api.deleteRumahSakit(targetId);
                    if (!resp.ok) {
                        this.showDeleteConfirm = false;
                        this.errorModal = {
                            show: true,
                            title: resp.status === 503 ? 'Cloud Supabase Offline' : 'Gagal Menghapus Rumah Sakit',
                            message: resp.data?.detail || 'Data rumah sakit tidak dapat dihapus.',
                        };
                        return;
                    }

                    showSuccessToast('Data Rumah Sakit berhasil dihapus.');
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
        window._rumahSakitRegistered = true;
    }
}
