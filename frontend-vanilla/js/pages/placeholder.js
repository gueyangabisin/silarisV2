/**
 * RFID Linen Pro — Placeholder Page
 *
 * Rendered for routes whose pages haven't been ported yet.
 * Shows a glass panel with a migration message and a link
 * back to the legacy multi-page frontend.
 */

/** @type {Object<string, string>} Map route path → legacy HTML filename */
const legacyFileMap = {
    '/v2/':                     'index.html',
    '/v2/pendaftaran':          'pendaftaran.html',
    '/v2/cek-info':             'cek_info.html',
    '/v2/kirim-barang':         'kirim_barang.html',
    '/v2/antrean-bermasalah':   'antrean_bermasalah.html',
    '/v2/manajemen-linen':      'manajemen_linen.html',
    '/v2/manajemen-nama':       'manajemen_nama.html',
};

/**
 * Create a placeholder page instance for a given route.
 * @param {string} title   Display name of the page
 * @param {string} route   Current route path
 */
export function createPlaceholderPage(title, route) {
    const legacyFile = legacyFileMap[route] || 'index.html';
    const legacyUrl = `/${legacyFile}`;

    return {
        render() {
            return `
                <div class="flex items-center justify-center min-h-[60vh]">
                    <div class="glass-panel rounded-2xl border border-glass-border shadow-sm p-8 max-w-lg w-full text-center flex flex-col items-center gap-6">
                        <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                            <span class="material-symbols-outlined text-[32px] text-primary" style="font-variation-settings: 'FILL' 1;">construction</span>
                        </div>
                        <div>
                            <h2 class="font-headline-md font-bold text-primary text-xl mb-2">${title}</h2>
                            <p class="font-body-md text-on-surface-variant">
                                Halaman ini sedang dalam proses migrasi ke versi SPA baru.
                            </p>
                        </div>
                        <a href="${legacyUrl}" class="inline-flex items-center gap-2 bg-primary hover:bg-primary/90 text-on-primary font-label-lg px-6 py-2.5 rounded-full shadow-md transition-all">
                            <span class="material-symbols-outlined text-[18px]">open_in_new</span>
                            Buka Versi Lama
                        </a>
                    </div>
                </div>
            `;
        },
        mount() { /* nothing to do */ },
        unmount() { /* nothing to clean up */ },
    };
}
