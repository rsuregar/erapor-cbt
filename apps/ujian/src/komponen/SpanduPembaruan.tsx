import { Progres } from '@/komponen/Progres'
import { Tombol } from '@/komponen/Tombol'
import { adaNative, bisaPasangPembaruan, bukaTautanLuar, pasangPembaruan } from '@/lib/native'
import { terapkanPembaruan, usePembaruanPwa } from '@/lib/pembaruanPwa'
import { usePembaruan } from '@/lib/usePembaruan'
import { Download, RotateCw, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

/** Versi yang ditutup pengguna; bertahan antar halaman selama app terbuka. */
const ditutup = new Set<string>()
const KUNCI_PWA = 'pwa'

/** Status pasang di dalam app (desktop & Android): null = belum mulai. */
type StatusPasang = { tahap: 'unduh'; diterima: number; total: number | null } | { tahap: 'memasang' } | null

const mb = (byte: number) => (byte / 1024 / 1024).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/**
 * Spanduk "versi baru tersedia" untuk layar di luar ujian (Masuk, Beranda).
 * Desktop dengan updater: unduh + pasang di dalam app dengan progres, lalu mulai ulang.
 * Android: unduh APK dengan progres lalu buka pemasang sistem.
 * App native lain (atau updater gagal): unduh pemasang dari GitHub Releases. PWA: pasang
 * service worker baru yang sudah terunduh lalu muat ulang — tidak pernah ditampilkan di layar ujian.
 */
export function SpanduPembaruan() {
    const info = usePembaruan()
    const pwa = usePembaruanPwa()
    const [, segarkan] = useState(0)
    const [galat, setGalat] = useState(false)
    const [memasang, setMemasang] = useState(false)
    const [bisaPasang, setBisaPasang] = useState(false)
    const [pasang, setPasang] = useState<StatusPasang>(null)
    const [galatPasang, setGalatPasang] = useState<string | null>(null)
    const [pemasangTerbuka, setPemasangTerbuka] = useState(false)
    const unduh = info?.unduh
    const manifes = info?.manifes

    useEffect(() => {
        if (!unduh) return
        let batal = false
        void bisaPasangPembaruan({ unduh, manifes }).then((b) => !batal && setBisaPasang(b))

        return () => {
            batal = true
        }
    }, [unduh, manifes])

    const pasangSekarang = (rilis: { unduh: string; manifes?: string }) => {
        setGalatPasang(null)
        setPemasangTerbuka(false)
        setPasang({ tahap: 'unduh', diterima: 0, total: null })
        pasangPembaruan(rilis, (p) => {
            if (p.jenis === 'mulai') setPasang({ tahap: 'unduh', diterima: 0, total: p.total })
            else if (p.jenis === 'progres') setPasang((s) => (s?.tahap === 'unduh' ? { ...s, diterima: s.diterima + p.diterima } : s))
            else setPasang({ tahap: 'memasang' })
        })
            // Android: pemasang sistem terbuka; bila murid membatalkan, app kembali ke sini.
            .then(() => {
                setPasang(null)
                setPemasangTerbuka(true)
            })
            .catch((e: unknown) => {
                setPasang(null)
                setGalatPasang(e instanceof Error ? e.message : 'Pembaruan gagal.')
            })
    }
    const tutup = (kunci: string) => {
        ditutup.add(kunci)
        segarkan((n) => n + 1)
    }

    if (info && !ditutup.has(info.versi)) {
        const dalamApp = bisaPasang
        const sibuk = pasang !== null

        return (
            <Kerangka onTutup={sibuk ? undefined : () => tutup(info.versi)}>
                <p>
                    <b>Versi {info.versi} tersedia.</b> Perbarui aplikasi sebelum hari ujian agar tidak ditolak server (versi sekarang {__VERSI_APP__}).
                </p>
                {pasang?.tahap === 'unduh' && (
                    <div className="space-y-1">
                        <Progres nilai={pasang.total ? pasang.diterima / pasang.total : null} className="bg-sky-200" />
                        <p className="text-xs tabular-nums">
                            Mengunduh… {mb(pasang.diterima)}
                            {pasang.total ? ` / ${mb(pasang.total)} MB (${Math.round((pasang.diterima / pasang.total) * 100)}%)` : ' MB'}
                        </p>
                    </div>
                )}
                {pasang?.tahap === 'memasang' && (
                    <div className="space-y-1">
                        <Progres nilai={null} className="bg-sky-200" />
                        <p className="text-xs">
                            {adaNative() ? 'Membuka pemasang… Tekan Pasang/Perbarui di layar berikutnya.' : 'Memasang pembaruan… Aplikasi akan tertutup dan terbuka kembali otomatis.'}
                        </p>
                    </div>
                )}
                {pemasangTerbuka && <p className="text-xs">Tekan Pasang/Perbarui di layar pemasang. Bila tadi dibatalkan, tekan Perbarui sekarang lagi.</p>}
                {galatPasang && <p className="text-xs text-red-700">Pembaruan otomatis gagal: {galatPasang} Bila tetap gagal, gunakan Unduh manual.</p>}
                {galat && <p className="text-xs text-red-700">Gagal membuka tautan unduhan. Coba lagi atau hubungi pengawas / tim IT.</p>}
                {!sibuk && (
                    <div className="flex flex-wrap gap-2">
                        {dalamApp && (
                            <Tombol ukuran="sm" className="min-h-11" ikonKiri={<RotateCw className="size-4" />} onClick={() => pasangSekarang(info)}>
                                Perbarui sekarang
                            </Tombol>
                        )}
                        <Tombol
                            ukuran="sm"
                            varian={dalamApp ? 'outline' : undefined}
                            className="min-h-11"
                            onClick={() => {
                                setGalat(false)
                                bukaTautanLuar(info.unduh).catch(() => setGalat(true))
                            }}
                        >
                            {dalamApp ? 'Unduh manual' : 'Unduh pembaruan'}
                        </Tombol>
                    </div>
                )}
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

function Kerangka({ onTutup, children }: { onTutup?: () => void; children: ReactNode }) {
    return (
        <div role="status" className="flex items-start gap-2.5 rounded-md bg-sky-100 px-3.5 py-3 text-sm text-sky-900">
            <Download className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1 space-y-2">{children}</div>
            {onTutup && (
                <button
                    type="button"
                    aria-label="Tutup"
                    className="-m-2 inline-flex size-11 shrink-0 items-center justify-center rounded-sm text-sky-700 hover:bg-sky-200"
                    onClick={onTutup}
                >
                    <X className="size-4" />
                </button>
            )}
        </div>
    )
}
