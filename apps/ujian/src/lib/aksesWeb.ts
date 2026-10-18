import { isNative } from '@/lib/native'
import { jenisPerangkat } from '@/lib/perangkat'

/**
 * Mode deploy `web_ios_only` (docs/panduan-build-dan-cicd.md): web hanya untuk
 * iPhone/iPad yang membuka PWA terpasang. Laptop & Android wajib aplikasi resmi.
 * Ditentukan saat build (VITE_AKSES_WEB=ios_pwa); app native tidak pernah terkena.
 */
export const WEB_KHUSUS_IOS = import.meta.env.VITE_AKSES_WEB === 'ios_pwa'

/** Halaman blokir yang dibuat scripts/generate-maintenance-pwa.mjs --mode web_ios_only. */
export const HALAMAN_WEB_NONAKTIF = '/web-nonaktif.html'

/** Browser ini (bukan iPhone/iPad) tidak boleh membuka app web. */
export function webDitolak(): boolean {
    return WEB_KHUSUS_IOS && !isNative() && jenisPerangkat() !== 'ios'
}

/**
 * Dibuka dari ikon Layar Utama di iOS. `navigator.standalone` hanya ada di WebKit iOS,
 * jadi peniruan iPhone di browser laptop (ubah user agent) tidak lolos.
 */
export function pwaIosTerpasang(): boolean {
    return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/** Lepas service worker & cache lalu pindah ke halaman blokir (tidak bisa dibuka offline lagi). */
export async function alihkanKeHalamanNonaktif(): Promise<void> {
    const regs = (await navigator.serviceWorker?.getRegistrations().catch(() => undefined)) ?? []
    await Promise.all(regs.map((r) => r.unregister().catch(() => false)))
    const nama = (await globalThis.caches?.keys().catch(() => undefined)) ?? []
    await Promise.all(nama.map((n) => caches.delete(n).catch(() => false)))
    location.replace(HALAMAN_WEB_NONAKTIF)
}
