import { api } from '@/lib/api'
import { ambilPaket, GalatMedia, simpanPaket, unduhMedia } from '@/lib/ujian'
import { GalatApi, type PaketTerenkripsi, type UjianRingkas } from '@erapor-cbt/exam-core'
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

/** Apakah salinan paket lokal sudah tertinggal dari revisi server. */
export function paketUsang(ada: PaketTerenkripsi, versiServer: string | undefined, online: boolean): boolean {
    return online && Boolean(versiServer) && ada.versi_paket !== versiServer
}

/**
 * Unduh paket dan seluruh medianya terlebih dahulu; baru simpan paket ke penyimpanan
 * lokal setelah semua media sukses agar paket yang medianya gagal tidak tersimpan.
 */
export async function unduhDanSimpanPaket(
    ujianId: number,
    onProgres: (tahap: TahapUnduh) => void,
): Promise<PaketTerenkripsi> {
    onProgres({ tahap: 'paket', diterima: 0, total: null })
    const paket = await api.paket(ujianId, (diterima, total) => onProgres({ tahap: 'paket', diterima, total }))
    await unduhMedia(ujianId, paket.media, (selesai, total) => onProgres({ tahap: 'media', selesai, total }))
    await simpanPaket(ujianId, paket)

    return paket
}

/**
 * Pra-unduh paket + media (kontrak "pra-unduh"): otomatis begitu tersedia.
 * Bila ujian masih lama dibuka, ditunda acak ≤ 2 menit supaya ratusan
 * perangkat tidak mengunduh pada detik yang sama; murid bisa menekan
 * "Unduh sekarang".
 */
export function useUnduhPaket(ujian: UjianRingkas | undefined, online = true) {
    const [status, setStatus] = useState<TahapUnduh>({ tahap: 'belum' })
    const berjalan = useRef(false)

    const unduh = useCallback(async () => {
        if (!ujian || berjalan.current) return
        berjalan.current = true
        try {
            const paket = await unduhDanSimpanPaket(ujian.id, setStatus)
            setStatus({ tahap: 'siap', ukuran: paket.isi.length, media: paket.media.length })
        } catch (e) {
            setStatus({ tahap: 'galat', pesan: pesanGalat(e) })
        } finally {
            berjalan.current = false
        }
    }, [ujian])

    /** Paket sudah ada di perangkat: pastikan medianya juga lengkap (berkas bisa terhapus / unduhan lama terputus). */
    const lengkapiMedia = useCallback(
        async (ukuran: number, media: string[]) => {
            if (!ujian || berjalan.current) return
            berjalan.current = true
            try {
                await unduhMedia(ujian.id, media, (selesai, total) => setStatus({ tahap: 'media', selesai, total }))
                setStatus({ tahap: 'siap', ukuran, media: media.length })
            } catch (e) {
                setStatus({ tahap: 'galat', pesan: pesanGalat(e) })
            } finally {
                berjalan.current = false
            }
        },
        [ujian],
    )

    useEffect(() => {
        if (!ujian?.bisa_unduh) return
        let batal = false
        let tunda: ReturnType<typeof setTimeout> | undefined
        void (async () => {
            const ada = await ambilPaket(ujian.id)
            if (batal) return
            if (ada) {
                if (paketUsang(ada, ujian.versi_paket, online)) {
                    void unduh()

                    return
                }
                if (status.tahap === 'belum') {
                    // Media yang sudah tersimpan tidak diunduh ulang, jadi ini tetap jalan saat offline.
                    void lengkapiMedia(ada.isi.length, ada.media)
                }

                return
            }
            if (status.tahap !== 'belum') return
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
    }, [ujian?.id, ujian?.bisa_unduh, ujian?.versi_paket, online])

    return { status, unduh }
}

function pesanGalat(e: unknown): string {
    if (e instanceof GalatApi) return e.kode === 'JARINGAN' ? 'Unduhan terputus. Periksa internet lalu coba lagi.' : e.message
    if (e instanceof GalatMedia) return e.message

    return 'Gagal menyimpan paket di perangkat.'
}
