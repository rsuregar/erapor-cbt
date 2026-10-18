import { Tombol } from '@/komponen/Tombol'
import { bukaTautanLuar } from '@/lib/native'
import { usePembaruan } from '@/lib/usePembaruan'
import { Download, X } from 'lucide-react'
import { useState } from 'react'

/** Versi yang ditutup pengguna; bertahan antar halaman selama app terbuka. */
const ditutup = new Set<string>()

/** Spanduk "versi baru tersedia" untuk layar di luar ujian (Masuk, Beranda). */
export function SpanduPembaruan() {
    const info = usePembaruan()
    const [, segarkan] = useState(0)
    const [galat, setGalat] = useState(false)

    if (!info || ditutup.has(info.versi)) return null

    return (
        <div role="status" className="flex items-start gap-2.5 rounded-md bg-sky-100 px-3.5 py-3 text-sm text-sky-900">
            <Download className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">
                <p>
                    <b>Versi {info.versi} tersedia.</b> Perbarui aplikasi sebelum hari ujian agar tidak ditolak server (versi sekarang {__VERSI_APP__}).
                </p>
                {galat && <p className="text-xs text-red-700">Gagal membuka tautan unduhan. Coba lagi atau hubungi proktor / tim IT.</p>}
                <Tombol
                    ukuran="sm"
                    onClick={() => {
                        setGalat(false)
                        bukaTautanLuar(info.unduh).catch(() => setGalat(true))
                    }}
                >
                    Unduh pembaruan
                </Tombol>
            </div>
            <button
                type="button"
                aria-label="Tutup"
                className="-m-1 rounded p-1 text-sky-700 hover:bg-sky-200"
                onClick={() => {
                    ditutup.add(info.versi)
                    segarkan((n) => n + 1)
                }}
            >
                <X className="size-4" />
            </button>
        </div>
    )
}
