import { ambilPosisi, izinLokasi, kodeGalatLokasi, type GalatLokasi, type PosisiDidapat } from '@/lib/lokasi'
import { useCallback, useEffect, useRef, useState } from 'react'

export type TahapLokasi =
    | { tahap: 'tidak_perlu' }
    | { tahap: 'belum' }
    | { tahap: 'mencari' }
    | { tahap: 'siap'; posisi: PosisiDidapat }
    | { tahap: 'galat'; kode: GalatLokasi }

/** Posisi dianggap segar selama ini; lebih tua → ambil ulang saat Mulai. */
const SEGAR_MS = 30_000

/**
 * Izin + posisi untuk ujian "di sekolah". Izin yang sudah diberikan langsung
 * dipakai; yang belum ditanyakan menunggu ketukan murid (browser lebih
 * bersahabat bila permintaan izin berasal dari tindakan pengguna).
 */
export function useLokasi(wajib: boolean) {
    const [status, setStatus] = useState<TahapLokasi>({ tahap: wajib ? 'belum' : 'tidak_perlu' })
    const terakhir = useRef<PosisiDidapat | null>(null)

    const cari = useCallback(async (): Promise<PosisiDidapat> => {
        setStatus({ tahap: 'mencari' })
        try {
            const p = await ambilPosisi()
            terakhir.current = p
            setStatus({ tahap: 'siap', posisi: p })

            return p
        } catch (e) {
            setStatus({ tahap: 'galat', kode: kodeGalatLokasi(e) })
            throw e
        }
    }, [])

    useEffect(() => {
        if (!wajib) {
            setStatus({ tahap: 'tidak_perlu' })

            return
        }
        let batal = false
        void izinLokasi().then((izin) => {
            if (batal) return
            if (izin === 'granted') void cari().catch(() => undefined)
            else if (izin === 'denied') setStatus({ tahap: 'galat', kode: 'DITOLAK' })
            else setStatus({ tahap: 'belum' })
        })

        return () => {
            batal = true
        }
    }, [wajib, cari])

    /** Posisi untuk /mulai: pakai yang masih segar, kalau tidak ambil ulang. */
    const posisiSegar = useCallback(async () => {
        const p = terakhir.current
        if (p && Date.now() - p.pada < SEGAR_MS) return p

        return cari()
    }, [cari])

    return { status, cari: () => void cari().catch(() => undefined), posisiSegar }
}
