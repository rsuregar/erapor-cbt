import { api } from '@/lib/api'
import { ambilPaket, simpanPaket, unduhMedia } from '@/lib/ujian'
import { GalatApi, type UjianRingkas } from '@erapor-cbt/exam-core'
import { useCallback, useEffect, useRef, useState } from 'react'

export type TahapUnduh =
    | { tahap: 'menunggu'; mulaiDalamMs: number }
    | { tahap: 'paket'; diterima: number; total: number | null }
    | { tahap: 'media'; selesai: number; total: number }
    | { tahap: 'siap'; ukuran: number; media: number }
    | { tahap: 'galat'; pesan: string }
    | { tahap: 'belum' }

/** Lebih dari ini sebelum dibuka: unduhan ditunda acak (kontrak: jangan serentak). */
const AMBANG_TUNDA_MS = 5 * 60_000
const TUNDA_MAKS_MS = 2 * 60_000

/**
 * Pra-unduh paket + media (kontrak "pra-unduh"): otomatis begitu tersedia.
 * Bila ujian masih lama dibuka, ditunda acak ≤ 2 menit supaya ratusan
 * perangkat tidak mengunduh pada detik yang sama; murid bisa menekan
 * "Unduh sekarang".
 */
export function useUnduhPaket(ujian: UjianRingkas | undefined) {
    const [status, setStatus] = useState<TahapUnduh>({ tahap: 'belum' })
    const berjalan = useRef(false)

    const unduh = useCallback(async () => {
        if (!ujian || berjalan.current) return
        berjalan.current = true
        try {
            setStatus({ tahap: 'paket', diterima: 0, total: null })
            const paket = await api.paket(ujian.id, (diterima, total) => setStatus({ tahap: 'paket', diterima, total }))
            await simpanPaket(ujian.id, paket)
            await unduhMedia(paket.media, (selesai, total) => setStatus({ tahap: 'media', selesai, total }))
            setStatus({ tahap: 'siap', ukuran: paket.isi.length, media: paket.media.length })
        } catch (e) {
            const pesan =
                e instanceof GalatApi
                    ? e.kode === 'JARINGAN'
                        ? 'Unduhan terputus. Periksa internet lalu coba lagi.'
                        : e.message
                    : 'Gagal menyimpan paket di perangkat.'
            setStatus({ tahap: 'galat', pesan })
        } finally {
            berjalan.current = false
        }
    }, [ujian])

    useEffect(() => {
        if (!ujian?.bisa_unduh || status.tahap !== 'belum') return
        let batal = false
        let tunda: ReturnType<typeof setTimeout> | undefined
        void (async () => {
            // Paket yang sudah diunduh sebelumnya tetap dipakai (versi diperiksa saat unduh ulang).
            const ada = await ambilPaket(ujian.id)
            if (batal) return
            if (ada) {
                setStatus({ tahap: 'siap', ukuran: ada.isi.length, media: ada.media.length })

                return
            }
            const sisa = Date.parse(ujian.dibuka_pada) - Date.now()
            if (sisa > AMBANG_TUNDA_MS) {
                const ms = Math.round(Math.random() * TUNDA_MAKS_MS)
                setStatus({ tahap: 'menunggu', mulaiDalamMs: ms })
                tunda = setTimeout(() => void unduh(), ms)
            } else {
                void unduh()
            }
        })()

        return () => {
            batal = true
            if (tunda) clearTimeout(tunda)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ujian?.id, ujian?.bisa_unduh])

    return { status, unduh }
}
