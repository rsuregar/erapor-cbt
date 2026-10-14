import { KlienApi } from '@erapor-cbt/exam-core'
import { Capacitor } from '@capacitor/core'
import { fetchDemo, TOKEN_DEMO } from './demo'
import { sesi } from './sesi'

let demo = false

/** Mode demo hanya ada di `npm run dev` (import.meta.env.DEV dibuang saat build). */
export function aturDemo(aktif: boolean): void {
    demo = import.meta.env.DEV && aktif
}

export const api = new KlienApi({
    baseUrl: import.meta.env.VITE_API_URL || '/api',
    ambilToken: () => sesi.token(),
    saatTidakSah: () => {
        void sesi.keluar().then(() => window.location.assign('/masuk'))
    },
    fetch: (url, init) => (import.meta.env.DEV && (demo || sesi.token() === TOKEN_DEMO) ? fetchDemo(url) : globalThis.fetch(url, init)),
})

/** `perangkat.platform` di kontrak: app Capacitor atau PWA. */
export function platform(): 'android' | 'ios' | 'pwa' {
    const p = Capacitor.getPlatform()

    return p === 'android' || p === 'ios' ? p : 'pwa'
}
