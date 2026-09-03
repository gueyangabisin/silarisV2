/**
 * RFID Linen Pro — Port Selector Component
 *
 * Reusable Alpine.js component + HTML renderer for sensor port selection.
 * Registered ONCE in router.init() before Alpine.initTree() so that
 * x-data="portSelectorData()" resolves correctly on first render.
 */

import { api } from '../api.js';
import { wsConnection } from '../ws-connection.js';

// ─── HTML Renderer ────────────────────────────────────────────────────────────

/**
 * Renders the Port Selector UI block.
 * @param {string} selectId - Unique HTML id for the <select> element.
 */
function renderHTML(selectId = 'port-select') {
    return `
<div x-data="portSelectorData()" x-init="initPortSelector('${selectId}')" class="flex flex-col gap-2">
    <label class="font-label-md text-on-surface flex items-center justify-between">
        <span>Port Sensor <span class="text-status-error">*</span></span>
        <button type="button" @click="refreshPorts()" :disabled="loadingPorts"
                class="text-xs text-primary hover:underline flex items-center gap-0.5 disabled:opacity-50 font-semibold">
            <span class="material-symbols-outlined text-[14px]"
                  :class="loadingPorts ? 'animate-spin' : ''">refresh</span>
            Refresh
        </button>
    </label>
    <select :id="selectId"
            :disabled="loadingPorts || availablePorts.length === 0"
            class="bg-white/70 border border-glass-border rounded-xl px-4 py-2.5 text-body-md focus:outline-none focus:ring-2 focus:ring-primary/50 text-on-surface disabled:opacity-50">
        <template x-if="loadingPorts">
            <option value="" disabled selected>Memuat daftar port...</option>
        </template>
        <template x-if="!loadingPorts && availablePorts.length === 0">
            <option value="" disabled selected>Tidak ada port tersedia</option>
        </template>
        <template x-if="!loadingPorts && availablePorts.length > 0">
            <option value="" disabled selected>-- Pilih Port --</option>
        </template>
        <template x-for="port in availablePorts" :key="port.device">
            <option :value="port.device" x-text="port.device + (port.description ? ' — ' + port.description : '')"></option>
        </template>
    </select>
    <p x-show="!loadingPorts && availablePorts.length === 0 && !portsError"
       class="text-xs text-on-surface-variant">Pastikan sensor sudah tersambung lalu klik Refresh.</p>
    <p x-show="portsError" class="text-xs text-status-error" x-text="portsError"></p>
</div>
    `;
}

// ─── Alpine Component Registration ────────────────────────────────────────────

export function registerPortSelectorComponent() {
    if (window.Alpine && !window._portSelectorRegistered) {
        window.Alpine.data('portSelectorData', () => ({
            selectId: 'port-select',
            availablePorts: [],
            loadingPorts: false,
            portsError: '',

            async initPortSelector(id) {
                this.selectId = id || 'port-select';
                await this.refreshPorts();

                // Auto-populate when backend reports serial connected
                wsConnection.subscribe('serial_connected_info', (data) => {
                    if (data.port) {
                        const el = document.getElementById(this.selectId);
                        if (el) {
                            // Try to select the connected port if it's in the list
                            if ([...el.options].some(o => o.value === data.port)) {
                                el.value = data.port;
                            }
                        }
                    }
                });
            },

            async refreshPorts() {
                this.loadingPorts = true;
                this.portsError = '';
                try {
                    const resp = await api.getSerialPorts();
                    if (resp.ok) {
                        this.availablePorts = Array.isArray(resp.data) ? resp.data : [];
                        if (this.availablePorts.length === 1) {
                            // Auto-select if only one port
                            await this.$nextTick();
                            const el = document.getElementById(this.selectId);
                            if (el) el.value = this.availablePorts[0].device;
                        }
                    } else {
                        this.portsError = resp.data?.detail || 'Gagal memuat daftar port.';
                    }
                } catch (e) {
                    this.portsError = 'Tidak dapat menghubungi server.';
                    console.error('portSelector refreshPorts:', e);
                } finally {
                    this.loadingPorts = false;
                }
            },
        }));
        window._portSelectorRegistered = true;
    }
}

// ─── Public Export ────────────────────────────────────────────────────────────

export const portSelectorComponent = { renderHTML, registerPortSelectorComponent };
