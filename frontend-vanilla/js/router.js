/**
 * RFID Linen Pro — History API Router
 *
 * Client-side routing using pushState/popstate.
 * Intercepts clicks on <a data-route> links, loads the matching
 * page module, swaps #app-content innerHTML, and calls
 * Alpine.initTree() to activate directives in the new content.
 *
 * Each page module must export: { render(), mount(), unmount() }
 */

import { kategoriLinenPage, registerKategoriLinenComponent } from './pages/kategori-linen.js';
import { createPlaceholderPage } from './pages/placeholder.js';

// ─── Route Definitions ───────────────────────────────────

const routes = {
    '/v2/':                     { page: createPlaceholderPage('Dashboard', '/v2/'),                       title: 'Dashboard' },
    '/v2/pendaftaran':          { page: createPlaceholderPage('Pendaftaran Linen', '/v2/pendaftaran'),     title: 'Pendaftaran Linen' },
    '/v2/cek-info':             { page: createPlaceholderPage('Cek Info Linen', '/v2/cek-info'),           title: 'Cek Info Linen' },
    '/v2/kirim-barang':         { page: createPlaceholderPage('Kirim Barang', '/v2/kirim-barang'),         title: 'Kirim Barang' },
    '/v2/antrean-bermasalah':   { page: createPlaceholderPage('Antrean Bermasalah', '/v2/antrean-bermasalah'), title: 'Antrean Bermasalah' },
    '/v2/manajemen-linen':      { page: createPlaceholderPage('Manajemen Linen', '/v2/manajemen-linen'),   title: 'Manajemen Linen' },
    '/v2/kategori-linen':       { page: kategoriLinenPage,                                                  title: 'Manajemen Kategori Linen' },
    '/v2/manajemen-nama':       { page: createPlaceholderPage('Manajemen Nama Linen', '/v2/manajemen-nama'), title: 'Manajemen Nama Linen' },
};

/** Currently mounted page (has unmount()) */
let currentPage = null;

/** The <main id="app-content"> container */
let contentEl = null;

// ─── Public API ───────────────────────────────────────────

function init() {
    contentEl = document.getElementById('app-content');
    if (!contentEl) {
        console.error('[Router] #app-content element not found!');
        return;
    }

    // Register Alpine components before first navigation
    registerKategoriLinenComponent();

    // Intercept clicks on nav links with data-route attribute
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[data-route]');
        if (!link) return;

        e.preventDefault();
        const path = link.getAttribute('href');
        if (path && path !== _currentPath()) {
            navigate(path);
        }
    });

    // Handle browser back/forward buttons
    window.addEventListener('popstate', () => {
        _renderRoute(_currentPath(), false);
    });

    // Render current route on first load
    _renderRoute(_currentPath(), false);
}

/**
 * Navigate to a new route programmatically.
 * @param {string} path  e.g. '/v2/kategori-linen'
 */
function navigate(path) {
    if (path === _currentPath()) return;
    history.pushState(null, '', path);
    _renderRoute(path, true);
}

// ─── Internal Helpers ─────────────────────────────────────

function _currentPath() {
    return location.pathname;
}

/**
 * Render a route: unmount old page → render new → mount.
 */
function _renderRoute(path, isPush) {
    // Normalise: strip trailing slash except for root
    let normalised = path;
    if (normalised !== '/v2/' && normalised.endsWith('/')) {
        normalised = normalised.slice(0, -1);
    }

    // Find matching route
    const routeEntry = routes[normalised];

    // Unmount current page
    if (currentPage && typeof currentPage.unmount === 'function') {
        try { currentPage.unmount(); } catch (e) { console.error('[Router] unmount error:', e); }
    }

    if (!routeEntry) {
        // 404 — show a not-found placeholder
        contentEl.innerHTML = `
            <div class="flex items-center justify-center min-h-[60vh]">
                <div class="glass-panel rounded-2xl border border-glass-border shadow-sm p-8 max-w-lg w-full text-center flex flex-col items-center gap-6">
                    <span class="material-symbols-outlined text-[48px] text-status-error" style="font-variation-settings: 'FILL' 1;">error</span>
                    <h2 class="font-headline-md font-bold text-on-surface text-xl">Halaman Tidak Ditemukan</h2>
                    <p class="font-body-md text-on-surface-variant">Route <code class="bg-black/10 px-2 py-0.5 rounded">${normalised}</code> tidak terdaftar.</p>
                    <a data-route href="/v2/" class="bg-primary text-on-primary px-6 py-2.5 rounded-full font-label-lg shadow-md hover:bg-primary/90 transition-all">Kembali ke Dashboard</a>
                </div>
            </div>
        `;
        currentPage = null;
        _updateActiveNav(normalised);
        document.title = 'Halaman Tidak Ditemukan - RFID Linen Pro';
        return;
    }

    const page = routeEntry.page;

    // Render new page content
    contentEl.innerHTML = page.render();

    // Activate Alpine directives on new content
    if (window.Alpine) {
        window.Alpine.initTree(contentEl);
    }

    // Mount page (subscribe to WS events, etc.)
    if (typeof page.mount === 'function') {
        try { page.mount(); } catch (e) { console.error('[Router] mount error:', e); }
    }

    currentPage = page;

    // Update nav active state
    _updateActiveNav(normalised);

    // Update document title
    document.title = `${routeEntry.title} - RFID Linen Pro`;
}

/**
 * Update nav link styling to reflect the active route.
 * Also highlights the parent dropdown group if a child route is active.
 */
function _updateActiveNav(activePath) {
    // Top-level nav links
    document.querySelectorAll('a[data-route]').forEach(link => {
        const href = link.getAttribute('href');
        const isActive = href === activePath;
        const isDropdownItem = link.closest('[data-dropdown]') !== null;

        if (isDropdownItem) {
            // Dropdown items: just bold the active one
            if (isActive) {
                link.classList.add('text-primary', 'font-bold');
                link.classList.remove('text-on-surface-variant');
            } else {
                link.classList.remove('text-primary', 'font-bold');
                link.classList.add('text-on-surface-variant');
            }
        }
    });

    // Dropdown trigger buttons — highlight if any child is active
    document.querySelectorAll('[data-dropdown]').forEach(dropdown => {
        const trigger = dropdown.querySelector('[data-dropdown-trigger]');
        const childLinks = dropdown.querySelectorAll('a[data-route]');
        const hasActiveChild = Array.from(childLinks).some(
            link => link.getAttribute('href') === activePath
        );

        if (trigger) {
            if (hasActiveChild) {
                trigger.classList.add('bg-primary', 'text-on-primary', 'font-semibold');
                trigger.classList.remove('text-on-surface-variant', 'hover:text-primary');
            } else {
                trigger.classList.remove('bg-primary', 'text-on-primary', 'font-semibold');
                trigger.classList.add('text-on-surface-variant', 'hover:text-primary');
            }
        }
    });

    // Single top-level nav links (not in dropdown)
    document.querySelectorAll('nav a[data-route]:not([data-dropdown] a)').forEach(link => {
        const href = link.getAttribute('href');
        const isActive = href === activePath;

        if (isActive) {
            link.classList.add('bg-primary', 'text-on-primary', 'font-semibold');
            link.classList.remove('text-on-surface-variant', 'hover:text-primary', 'hover:bg-glass-border');
        } else {
            link.classList.remove('bg-primary', 'text-on-primary', 'font-semibold');
            link.classList.add('text-on-surface-variant', 'hover:text-primary', 'hover:bg-glass-border');
        }
    });
}

// ─── Export ───────────────────────────────────────────────

export const router = {
    init,
    navigate,
};
