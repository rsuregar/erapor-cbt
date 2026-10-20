import { Tombol } from '@/komponen/Tombol'
import { bukaTautanLuar } from '@/lib/native'
import { terapkanPembaruan, usePembaruanPwa } from '@/lib/pembaruanPwa'
import { usePembaruan } from '@/lib/usePembaruan'
import { Download, RotateCw, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'

/** Versi yang ditutup pengguna; bertahan antar halaman selama app terbuka. */
const ditutup = new Set<string>()
const KUNCI_PWA = 'pwa'

/**
 * Spanduk "versi baru tersedia" untuk layar di luar ujian (Masuk, Beranda).
 * App native: unduh pemasang dari GitHub Releases. PWA: pasang service worker baru
 * yang sudah terunduh lalu muat ulang — tidak pernah ditampilkan di layar ujian.
 */
export function SpanduPembaruan() {
    const info = usePembaruan()
    const pwa = usePembaruanPwa()
    const [, segarkan] = useState(0)
    const [galat, setGalat] = useState(false)
    const [memasang, setMemasang] = useState(false)
    const tutup = (kunci: string) => {
        ditutup.add(kunci)
        segarkan((n) => n + 1)
    }

    if (info && !ditutup.has(info.versi)) {
        return (
            <Kerangka onTutup={() => tutup(info.versi)}>
                <p>
                    <b>Versi {info.versi} tersedia.</b> Perbarui aplikasi sebelum hari ujian agar tidak ditolak server (versi sekarang {__VERSI_APP__}).
                </p>
                {galat && <p className="text-xs text-red-700">Gagal membuka tautan unduhan. Coba lagi atau hubungi pengawas / tim IT.</p>}
                <Tombol
                    ukuran="sm"
                    className="min-h-11"
                    onClick={() => {
                        setGalat(false)
                        bukaTautanLuar(info.unduh).catch(() => setGalat(true))
                    }}
                >
                    Unduh pembaruan
                </Tombol>
            </Kerangka>
        )
    }

    if (pwa && !ditutup.has(KUNCI_PWA)) {
        return (
            <Kerangka onTutup={() => tutup(KUNCI_PWA)}>
                <p>
                    <b>Versi baru aplikasi sudah siap.</b> Ketuk Perbarui: halaman dimuat ulang sebentar, akun dan jawabanmu tetap aman (versi sekarang {__VERSI_APP__}).
                </p>
                <Tombol
                    ukuran="sm"
                    className="min-h-11"
                    disabled={memasang}
                    ikonKiri={<RotateCw className="size-4" />}
                    onClick={() => {
                        setMemasang(true)
                        void terapkanPembaruan()
                    }}
                >
                    {memasang ? 'Memperbarui…' : 'Perbarui'}
                </Tombol>
            </Kerangka>
        )
    }

    return null
}

function Kerangka({ onTutup, children }: { onTutup: () => void; children: ReactNode }) {
    return (
        <div role="status" className="flex items-start gap-2.5 rounded-md bg-sky-100 px-3.5 py-3 text-sm text-sky-900">
            <Download className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">{children}</div>
            <button
                type="button"
                aria-label="Tutup"
                className="-m-2 inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-sky-700 hover:bg-sky-200"
                onClick={onTutup}
            >
                <X className="size-4" />
            </button>
        </div>
    )
}
