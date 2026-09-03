/**
 * RFID Linen Pro — Dashboard Page
 *
 * Overview summary cards for linen inventory, status counts, and error queue.
 * Uses Alpine.js x-data component for reactive state and router for navigation.
 */

import { api } from '../api.js';
import { router } from '../router.js';

export const dashboardPage = {
    render() {
        return `
<div x-data="dashboardData()" x-init="fetchSummary()" class="flex flex-col gap-6">
    <!-- Header Section -->
    <div>
        <h1 class="font-headline-lg text-3xl font-bold text-primary">Selamat Datang, Operator Gudang</h1>
        <p class="font-body-md text-on-surface-variant mt-1">Ringkasan kondisi gudang dan inventaris linen hari ini.</p>
    </div>

    <!-- Dashboard Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <!-- Card 1: Total Linen -->
        <div class="glass-panel rounded-2xl p-6 flex flex-col justify-between min-h-[140px] shadow-sm hover:shadow-md transition-all">
            <div class="flex items-center gap-3 text-primary">
                <span class="material-symbols-outlined text-[28px]" style="font-variation-settings: 'FILL' 1;">inventory_2</span>
                <span class="font-label-md font-semibold text-on-surface-variant">Total Linen Terdaftar</span>
            </div>
            <div class="mt-4">
                <template x-if="loading">
                    <div class="w-16 h-8 bg-black/10 animate-pulse rounded"></div>
                </template>
                <template x-if="!loading">
                    <span class="font-data-mono text-[36px] font-bold text-on-surface leading-none block"
                          x-text="summary.total_linen ? summary.total_linen.toLocaleString('id-ID') : '0'"></span>
                </template>
            </div>
        </div>

        <!-- Card 2: Tersedia -->
        <div class="glass-panel rounded-2xl p-6 flex flex-col justify-between min-h-[140px] shadow-sm hover:shadow-md transition-all">
            <div class="flex items-center gap-3 text-status-success">
                <span class="material-symbols-outlined text-[28px]" style="font-variation-settings: 'FILL' 1;">check_circle</span>
                <span class="font-label-md font-semibold text-on-surface-variant">Tersedia di Gudang</span>
            </div>
            <div class="mt-4">
                <template x-if="loading">
                    <div class="w-16 h-8 bg-black/10 animate-pulse rounded"></div>
                </template>
                <template x-if="!loading">
                    <span class="font-data-mono text-[36px] font-bold text-status-success leading-none block"
                          x-text="summary.total_tersedia ? summary.total_tersedia.toLocaleString('id-ID') : '0'"></span>
                </template>
            </div>
        </div>

        <!-- Card 3: Dikirim -->
        <div class="glass-panel rounded-2xl p-6 flex flex-col justify-between min-h-[140px] shadow-sm hover:shadow-md transition-all">
            <div class="flex items-center gap-3 text-primary-container">
                <span class="material-symbols-outlined text-[28px]" style="font-variation-settings: 'FILL' 1;">local_shipping</span>
                <span class="font-label-md font-semibold text-on-surface-variant">Dikirim ke Rumah Sakit</span>
            </div>
            <div class="mt-4">
                <template x-if="loading">
                    <div class="w-16 h-8 bg-black/10 animate-pulse rounded"></div>
                </template>
                <template x-if="!loading">
                    <span class="font-data-mono text-[36px] font-bold text-primary-container leading-none block"
                          x-text="summary.total_dikirim ? summary.total_dikirim.toLocaleString('id-ID') : '0'"></span>
                </template>
            </div>
        </div>

        <!-- Card 4: Antrean Bermasalah (Clickable router navigation) -->
        <div @click="navigateToAntrean()"
             class="glass-panel rounded-2xl p-6 flex flex-col justify-between min-h-[140px] relative cursor-pointer transition-all group border border-glass-border hover:scale-[1.02]"
             :class="summary.total_antrean_bermasalah > 0 ? 'hover:border-status-error/60 bg-status-error/5' : 'hover:border-primary/40'">
            <!-- Error Badge -->
            <div x-show="summary.total_antrean_bermasalah > 0"
                 class="absolute -top-2 -right-2 w-7 h-7 bg-status-error text-white rounded-full flex items-center justify-center font-label-sm font-bold shadow-lg shadow-status-error/30 group-hover:scale-110 transition-transform"
                 x-text="summary.total_antrean_bermasalah > 99 ? '99+' : summary.total_antrean_bermasalah">
            </div>

            <div class="flex items-center gap-3"
                 :class="summary.total_antrean_bermasalah > 0 ? 'text-status-error' : 'text-status-idle'">
                <span class="material-symbols-outlined text-[28px]" style="font-variation-settings: 'FILL' 1;">warning</span>
                <span class="font-label-md font-semibold">Perlu Tindakan (Antrean)</span>
            </div>

            <div class="mt-4">
                <template x-if="loading">
                    <div class="w-16 h-8 bg-black/10 animate-pulse rounded"></div>
                </template>
                <template x-if="!loading">
                    <span class="font-data-mono text-[36px] font-bold leading-none block"
                          :class="summary.total_antrean_bermasalah > 0 ? 'text-status-error' : 'text-status-idle'"
                          x-text="summary.total_antrean_bermasalah ? summary.total_antrean_bermasalah.toLocaleString('id-ID') : '0'"></span>
                </template>
            </div>
        </div>
    </div>

    <!-- Quick Navigation Shortcuts -->
    <div class="glass-panel rounded-2xl p-6 border border-glass-border flex flex-col gap-4">
        <h2 class="font-headline-md font-bold text-primary text-xl">Akses Cepat</h2>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <a data-route href="/v2/pendaftaran" class="p-4 bg-white/40 hover:bg-white/70 rounded-xl border border-glass-border transition-all flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <span class="material-symbols-outlined text-[24px]">add_circle</span>
                </div>
                <div>
                    <h3 class="font-headline-md font-bold text-on-surface text-base">Pendaftaran Linen</h3>
                    <p class="font-body-md text-xs text-on-surface-variant">Daftarkan tag RFID baru</p>
                </div>
            </a>

            <a data-route href="/v2/kirim-barang" class="p-4 bg-white/40 hover:bg-white/70 rounded-xl border border-glass-border transition-all flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <span class="material-symbols-outlined text-[24px]">local_shipping</span>
                </div>
                <div>
                    <h3 class="font-headline-md font-bold text-on-surface text-base">Kirim Barang</h3>
                    <p class="font-body-md text-xs text-on-surface-variant">Scan & kirim linen ke RS</p>
                </div>
            </a>

            <a data-route href="/v2/manajemen-linen" class="p-4 bg-white/40 hover:bg-white/70 rounded-xl border border-glass-border transition-all flex items-center gap-3">
                <div class="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <span class="material-symbols-outlined text-[24px]">inventory</span>
                </div>
                <div>
                    <h3 class="font-headline-md font-bold text-on-surface text-base">Manajemen Linen</h3>
                    <p class="font-body-md text-xs text-on-surface-variant">Kelola seluruh stok & status</p>
                </div>
            </a>
        </div>
    </div>
</div>
        `;
    },

    mount() {},
    unmount() {},
};

export function registerDashboardComponent() {
    if (window.Alpine && !window._dashboardRegistered) {
        window.Alpine.data('dashboardData', () => ({
            summary: {
                total_linen: 0,
                total_tersedia: 0,
                total_dikirim: 0,
                total_antrean_bermasalah: 0,
            },
            loading: true,
            fetchError: null,

            async fetchSummary() {
                this.loading = true;
                this.fetchError = null;
                try {
                    const resp = await api.getDashboardSummary();
                    if (!resp.ok) throw new Error(resp.data?.detail || 'Gagal mengambil data dashboard');
                    this.summary = resp.data || {};
                } catch (err) {
                    console.error(err);
                    this.fetchError = err.message;
                } finally {
                    this.loading = false;
                }
            },

            navigateToAntrean() {
                router.navigate('/v2/antrean-bermasalah');
            }
        }));
        window._dashboardRegistered = true;
    }
}
