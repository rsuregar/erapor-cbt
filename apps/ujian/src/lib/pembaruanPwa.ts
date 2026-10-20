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
export async function terapkanPembaruan(): Promise<void> {
    const reg = await registrasiMenunggu()
    if (!reg?.waiting) {
        location.reload()

        return
    }
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true })
    reg.waiting.postMessage({ type: 'SKIP_WAITING' })
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
        // Pemasangan pertama (belum ada controller) bukan "pembaruan".
        const tandai = () => aktif && !!navigator.serviceWorker.controller && setTersedia(true)
        const pantauPemasangan = () => {
            const sw = reg?.installing
            sw?.addEventListener('statechange', () => sw.state === 'installed' && tandai())
        }
        const cek = async () => {
            reg ??= await navigator.serviceWorker.getRegistration().catch(() => undefined)
            if (!reg) return
            await reg.update().catch(() => undefined)
            if (reg.waiting) tandai()
        }
        const saatTerlihat = () => document.visibilityState === 'visible' && void cek()

        void (async () => {
            await cek()
            reg?.addEventListener('updatefound', pantauPemasangan)
        })()
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
