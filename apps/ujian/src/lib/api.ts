import { KlienApi } from '@erapor-cbt/exam-core'
import { Capacitor } from '@capacitor/core'
import { fetch as tauriFetch } from '@tauri-apps/plugin-http'
import { fetchDemo, TOKEN_DEMO } from './demo'
import { sesi } from './sesi'

let demo = false

/** Deteksi apakah aplikasi berjalan di dalam Tauri Desktop (Windows / macOS) */
const isTauri = typeof window !== 'undefined' && Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)

/**
 * Mode demo hanya di `npm run dev` dan `npm run pratinjau:demo` (VITE_DEMO=1).
 * Build produksi: kondisinya konstan false, data demo dibuang.
 */
export function aturDemo(aktif: boolean): void {
    demo = (import.meta.env.DEV || import.meta.env.VITE_DEMO === '1') && aktif
}

export const api = new KlienApi({
    baseUrl: import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://erapor.alakhyar.sch.id/api' : '/api'),
    ambilToken: () => sesi.token(),
    ambilPerangkatId: () => sesi.perangkatId(),
    saatTidakSah: () => {
        void sesi.keluar().then(() => window.location.assign('/masuk'))
    },
    fetch: (url, init) => {
        if ((import.meta.env.DEV || import.meta.env.VITE_DEMO === '1') && (demo || sesi.token() === TOKEN_DEMO)) {
            return fetchDemo(url, init)
        }
        // Di aplikasi desktop Tauri, gunakan native fetch Rust (bebas blokir CORS)
        if (isTauri) {
            return tauriFetch(url, init)
        }
        return globalThis.fetch(url, init)
    },
})

/** `perangkat.platform` di kontrak: app Capacitor atau PWA. */
export function platform(): 'android' | 'ios' | 'pwa' {
    const p = Capacitor.getPlatform()

    return p === 'android' || p === 'ios' ? p : 'pwa'
}
