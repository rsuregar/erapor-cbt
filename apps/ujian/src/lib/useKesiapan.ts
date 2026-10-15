import { menghalangi, periksa, type KeadaanTambahan } from '@/lib/kesiapan'
import type { InfoAplikasi, UjianRingkas } from '@erapor-cbt/exam-core'
import { useEffect, useMemo, useState } from 'react'

type Baterai = EventTarget & { level: number; charging: boolean }

/** Pembaruan PWA yang menunggu (service worker baru sudah terpasang). */
async function registrasiMenunggu(): Promise<ServiceWorkerRegistration | null> {
    const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined)
    await reg?.update().catch(() => undefined)

    return reg?.waiting ? reg : null
}

/** Pasang versi baru lalu muat ulang — hanya dari halaman persiapan, tidak pernah saat mengerjakan. */
export async function terapkanPembaruan(): Promise<void> {
    const reg = await registrasiMenunggu()
    if (!reg?.waiting) {
        location.reload()

        return
    }
    navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true })
    reg.waiting.postMessage({ type: 'SKIP_WAITING' })
}

/** Cek kesiapan yang diperbarui saat layar, orientasi, layar penuh, pembaruan, atau baterai berubah. */
export function useKesiapan(level: UjianRingkas['level_keamanan'] | undefined, aplikasi?: InfoAplikasi) {
    const [detak, setDetak] = useState(0)
    const [tambahan, setTambahan] = useState<KeadaanTambahan>({ pembaruanTersedia: false, ruangBebas: null, baterai: null })

    useEffect(() => {
        const ubah = () => setDetak((n) => n + 1)
        const tampilan = ['(display-mode: standalone)', '(display-mode: fullscreen)'].map((q) => matchMedia(q))
        window.addEventListener('resize', ubah)
        window.addEventListener('orientationchange', ubah)
        document.addEventListener('fullscreenchange', ubah)
        tampilan.forEach((m) => m.addEventListener('change', ubah))

        let baterai: Baterai | null = null
        const bacaBaterai = () => baterai && setTambahan((t) => ({ ...t, baterai: { level: baterai!.level, mengisi: baterai!.charging } }))

        void (async () => {
            // Minta penyimpanan permanen: browser tidak menghapus jawaban offline saat ruang menipis.
            await navigator.storage?.persist?.().catch(() => false)
            const est = await navigator.storage?.estimate?.().catch(() => null)
            const ruangBebas = est?.quota !== undefined ? est.quota - (est.usage ?? 0) : null
            const reg = await navigator.serviceWorker?.getRegistration().catch(() => undefined)
            await reg?.update().catch(() => undefined)
            setTambahan((t) => ({ ...t, ruangBebas, pembaruanTersedia: !!reg?.waiting }))
            // Pembaruan yang selesai terunduh selagi halaman ini terbuka.
            reg?.addEventListener('updatefound', () => {
                const sw = reg.installing
                sw?.addEventListener('statechange', () => {
                    if (sw.state === 'installed' && navigator.serviceWorker.controller) setTambahan((t) => ({ ...t, pembaruanTersedia: true }))
                })
            })

            baterai = (await (navigator as Navigator & { getBattery?: () => Promise<Baterai> }).getBattery?.().catch(() => null)) ?? null
            bacaBaterai()
            baterai?.addEventListener('levelchange', bacaBaterai)
            baterai?.addEventListener('chargingchange', bacaBaterai)
        })()

        return () => {
            window.removeEventListener('resize', ubah)
            window.removeEventListener('orientationchange', ubah)
            document.removeEventListener('fullscreenchange', ubah)
            tampilan.forEach((m) => m.removeEventListener('change', ubah))
            baterai?.removeEventListener('levelchange', bacaBaterai)
            baterai?.removeEventListener('chargingchange', bacaBaterai)
        }
    }, [])

    return useMemo(() => {
        if (!level) return { daftar: [], penghalang: [] }
        const daftar = periksa(level, { ...tambahan, aplikasi })

        return { daftar, penghalang: menghalangi(daftar, level) }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [level, tambahan, detak, aplikasi])
}
