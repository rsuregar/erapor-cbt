import { KlienApi } from '@erapor-cbt/exam-core'
import { Capacitor } from '@capacitor/core'
import { sesi } from './sesi'

export const api = new KlienApi({
    baseUrl: import.meta.env.VITE_API_URL ?? '/api',
    ambilToken: () => sesi.token(),
    saatTidakSah: () => {
        void sesi.keluar().then(() => window.location.assign('/masuk'))
    },
})

/** `perangkat.platform` di kontrak: app Capacitor atau PWA. */
export function platform(): 'android' | 'ios' | 'pwa' {
    const p = Capacitor.getPlatform()

    return p === 'android' || p === 'ios' ? p : 'pwa'
}
