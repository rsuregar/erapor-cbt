import { menghalangi, periksa, type KeadaanTambahan } from '@/lib/kesiapan'
import { jumlahMonitor } from '@/lib/native'
import { penyimpanan } from '@/lib/penyimpanan'
import type { InfoAplikasi, UjianRingkas } from '@erapor-cbt/exam-core'
import { useEffect, useMemo, useState } from 'react'

type Baterai = EventTarget & { level: number; charging: boolean }

// Dipakai juga oleh halaman Persiapan (aksi "Perbarui" di cek versi).
export { terapkanPembaruan } from '@/lib/pembaruanPwa'

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

        let batal = false
        let regSw: ServiceWorkerRegistration | undefined
        const pantauSw = (sw: ServiceWorker | null | undefined) => {
            sw?.addEventListener('statechange', () => {
                if (!batal && sw.state === 'installed' && navigator.serviceWorker.controller) {
                    setTambahan((t) => ({ ...t, pembaruanTersedia: true }))
                }
            })
        }
        const saatUpdateFound = () => {
            if (!batal && regSw) pantauSw(regSw.installing)
        }
        let baterai: Baterai | null = null
        const bacaBaterai = () => !batal && baterai && setTambahan((t) => ({ ...t, baterai: { level: baterai!.level, mengisi: baterai!.charging } }))

        void (async () => {
            // Minta penyimpanan permanen: browser tidak menghapus jawaban offline saat ruang menipis.
            await navigator.storage?.persist?.().catch(() => false)
            const est = await navigator.storage?.estimate?.().catch(() => null)
            const ruangBebas = est?.quota !== undefined ? est.quota - (est.usage ?? 0) : null
            regSw = await navigator.serviceWorker?.getRegistration().catch(() => undefined)
            if (batal) return
            if (regSw) {
                regSw.addEventListener('updatefound', saatUpdateFound)
                pantauSw(regSw.installing)
                await regSw.update().catch(() => undefined)
            }
            if (batal) return
            setTambahan((t) => ({ ...t, ruangBebas, pembaruanTersedia: !!regSw?.waiting }))
            // Backend penyimpanan (uji SQLite + migrasi berjalan sekali per sesi app).
            await penyimpanan.siapkan().catch(() => undefined)
            if (batal) return
            setTambahan((t) => ({ ...t, penyimpanan: { ...penyimpanan.status } }))

            baterai = (await (navigator as Navigator & { getBattery?: () => Promise<Baterai> }).getBattery?.().catch(() => null)) ?? null
            if (batal) return
            bacaBaterai()
            baterai?.addEventListener('levelchange', bacaBaterai)
            baterai?.addEventListener('chargingchange', bacaBaterai)

            const monitor = await jumlahMonitor().catch(() => 1)
            if (batal) return
            setTambahan((t) => ({ ...t, jumlahMonitor: monitor }))
        })()

        return () => {
            batal = true
            regSw?.removeEventListener('updatefound', saatUpdateFound)
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
