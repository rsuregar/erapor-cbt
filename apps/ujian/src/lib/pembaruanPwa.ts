import { isNative } from '@/lib/native'
import { useEffect, useState } from 'react'

/**
 * Pembaruan PWA lewat service worker (registerType "prompt", vite.config.ts): versi baru
 * terunduh di latar dan MENUNGGU sampai murid menyetujuinya, supaya app tidak memuat ulang
 * sendiri di tengah ujian. App native diperbarui lewat GitHub Releases (lib/pembaruan.ts).
 */

/** Jeda cek ulang selama halaman terbuka; lab bisa membiarkan Beranda terbuka berjam-jam. */
const JEDA_CEK_MS = 30 * 60 * 1000

/** Pembaruan PWA yang menunggu (service worker baru sudah terpasang). */
export async function registrasiMenunggu(): Promise<ServiceWorkerRegistration | null> {
    const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined)
    await reg?.update().catch(() => undefined)

    return reg?.waiting ? reg : null
}

/** Pasang versi baru lalu muat ulang — hanya dari layar di luar ujian, tidak pernah saat mengerjakan. */
export async function terapkanPembaruan(batasTungguMs = 3500): Promise<void> {
    const reg = await registrasiMenunggu()
    if (!reg?.waiting) {
        location.reload()

        return
    }
    let selesai = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const muatUlang = () => {
        if (selesai) return
        selesai = true
        if (timer) clearTimeout(timer)
        location.reload()
    }
    // iOS standalone PWA terkadang tidak memicu `controllerchange` setelah SKIP_WAITING;
    // muat ulang paksa setelah batas tunggu agar UI tidak macet di "Memperbarui…".
    timer = setTimeout(muatUlang, batasTungguMs)
    navigator.serviceWorker.addEventListener('controllerchange', muatUlang, { once: true })
    reg.waiting.postMessage({ type: 'SKIP_WAITING' })
}

/**
 * Hapus sisa Service Worker & cache PWA di app native (Android/Tauri/iOS) agar build
 * native baru tidak pernah tertahan oleh `index.html` atau bundle versi lama dari SW.
 * Mengembalikan true bila halaman saat ini sedang dikontrol SW (perlu muat ulang sekali).
 */
export async function bersihkanServiceWorkerNative(): Promise<boolean> {
    if (!isNative() || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false

    const dikontrol = Boolean(navigator.serviceWorker.controller)
    const regs = (await navigator.serviceWorker.getRegistrations().catch(() => undefined)) ?? []

    if (regs.length === 0) {
        const kunci = (await globalThis.caches?.keys().catch(() => undefined)) ?? []
        const workbox = kunci.filter((k) => k.startsWith('workbox-'))
        if (workbox.length > 0) {
            await Promise.all(workbox.map((k) => caches.delete(k).catch(() => false)))
        }

        return false
    }

    await Promise.all(regs.map((r) => r.unregister().catch(() => false)))
    const kunci = (await globalThis.caches?.keys().catch(() => undefined)) ?? []
    await Promise.all(kunci.filter((k) => k !== 'cbt-media').map((k) => caches.delete(k).catch(() => false)))

    return dikontrol
}

/**
 * true bila versi PWA baru sudah terunduh dan menunggu dipasang. Dicek saat dibuka, saat
 * tab kembali terlihat, dan tiap 30 menit. Selalu false di app native.
 */
export function usePembaruanPwa(): boolean {
    const [tersedia, setTersedia] = useState(false)

    useEffect(() => {
        if (isNative() || !('serviceWorker' in navigator)) return
        let reg: ServiceWorkerRegistration | undefined
        let aktif = true
        let terpasangUpdateFound = false
        // Pemasangan pertama (belum ada controller) bukan "pembaruan".
        const tandai = () => aktif && !!navigator.serviceWorker.controller && setTersedia(true)
        const pantauSw = (sw: ServiceWorker | null | undefined) => {
            sw?.addEventListener('statechange', () => sw.state === 'installed' && tandai())
        }
        const pantauPemasangan = () => {
            pantauSw(reg?.installing)
        }
        const cek = async () => {
            reg ??= await navigator.serviceWorker.getRegistration().catch(() => undefined)
            if (!reg || !aktif) return
            if (!terpasangUpdateFound) {
                terpasangUpdateFound = true
                reg.addEventListener('updatefound', pantauPemasangan)
                pantauSw(reg.installing)
            }
            await reg.update().catch(() => undefined)
            if (reg.waiting) tandai()
        }
        const saatTerlihat = () => document.visibilityState === 'visible' && void cek()

        void cek()
        document.addEventListener('visibilitychange', saatTerlihat)
        const t = setInterval(() => void cek(), JEDA_CEK_MS)

        return () => {
            aktif = false
            clearInterval(t)
            document.removeEventListener('visibilitychange', saatTerlihat)
            reg?.removeEventListener('updatefound', pantauPemasangan)
        }
    }, [])

    return tersedia
}
