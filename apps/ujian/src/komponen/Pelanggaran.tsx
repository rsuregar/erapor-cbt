import { Tombol } from '@/komponen/Tombol'
import type { Kejadian } from '@/lib/usePelanggaran'
import { cn } from '@/lib/utils'
import type { JenisPelanggaran } from '@erapor-cbt/exam-core'
import { ShieldAlert, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

type Tingkat = 'tenang' | 'waspada' | 'batas'

type Ringkas = { jumlah: number; ambang: number; mengunci: boolean; tingkat: Tingkat }

const LABEL: Partial<Record<JenisPelanggaran, string>> = {
    pindah_tab: 'Keluar dari layar ujian',
    latar_belakang: 'Aplikasi ujian ditinggalkan',
    muat_ulang: 'Halaman ujian dimuat ulang',
    keluar_layar_penuh: 'Keluar dari layar penuh',
    ukuran_layar: 'Layar dibagi dengan aplikasi lain',
    salin_tempel: 'Mencoba menyalin / menempel',
}

const WARNA: Record<Tingkat, string> = {
    tenang: 'bg-slate-100 text-slate-600',
    waspada: 'bg-amber-100 text-amber-700',
    batas: 'bg-coral-100 text-coral-600',
}

function durasi(ms: number) {
    const d = Math.round(ms / 1000)
    if (d < 1) return ''

    return d < 60 ? ` · ${d} dtk` : ` · ${Math.floor(d / 60)} mnt ${d % 60} dtk`
}

/** Titik-titik kesempatan: terisi = terpakai. Lebih mudah dibaca sekilas daripada angka. */
function Titik({ jumlah, ambang, besar }: { jumlah: number; ambang: number; besar?: boolean }) {
    return (
        <span className={cn('inline-flex items-center', besar ? 'gap-2' : 'gap-1')} aria-hidden>
            {Array.from({ length: ambang }, (_, i) => (
                <span key={i} className={cn('rounded-full', besar ? 'size-3' : 'size-1.5', i < jumlah ? 'bg-current' : 'bg-current opacity-25')} />
            ))}
        </span>
    )
}

/**
 * Penanda di kepala: tidak tampil sama sekali sebelum ada pelanggaran, supaya
 * murid yang tertib tidak dibuat cemas. Ketuk untuk penjelasan.
 */
export function IndikatorPelanggaran({ r }: { r: Ringkas }) {
    const [buka, setBuka] = useState(false)
    const [denyut, setDenyut] = useState(false)
    const sebelum = useRef(r.jumlah)

    useEffect(() => {
        if (r.jumlah > sebelum.current) setDenyut(true)
        sebelum.current = r.jumlah
    }, [r.jumlah])

    if (r.jumlah === 0) return null
    const pakaiTitik = r.mengunci && r.ambang >= 2 && r.ambang <= 5
    const label = r.mengunci ? `Pelanggaran ${r.jumlah} dari ${r.ambang}` : `${r.jumlah} pelanggaran tercatat`

    return (
        <div className="relative">
            <button
                onClick={() => setBuka((v) => !v)}
                onAnimationEnd={() => setDenyut(false)}
                aria-label={label}
                aria-expanded={buka}
                className={cn('inline-flex h-7 items-center gap-1.5 rounded-full px-2 text-xs font-bold tabular-nums transition', WARNA[r.tingkat], denyut && 'animate-denyut')}
            >
                <ShieldAlert className="size-4" />
                {pakaiTitik ? <Titik jumlah={r.jumlah} ambang={r.ambang} /> : r.mengunci ? `${r.jumlah}/${r.ambang}` : r.jumlah}
            </button>
            {buka && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setBuka(false)} />
                    <div role="dialog" className="absolute right-0 top-9 z-40 w-72 animate-turun rounded-md border border-slate-200 bg-white p-4 text-left shadow-lg">
                        <p className="text-sm font-bold text-ink">{label}</p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-500">
                            {r.mengunci
                                ? r.jumlah >= r.ambang
                                    ? 'Batas sudah tercapai. Keluar dari layar sekali lagi akan langsung mengunci ujian.'
                                    : `Ujian terkunci otomatis pada pelanggaran ke-${r.ambang} dan harus dibuka pengawas.`
                                : 'Tercatat dan terlihat oleh pengawas. Ujian ini tidak terkunci otomatis.'}
                        </p>
                        <p className="mt-3 text-xs leading-relaxed text-slate-500">
                            Yang dihitung: keluar atau berpindah aplikasi/tab, dan keluar dari layar penuh. Internet putus dan memuat ulang halaman <b>tidak</b> dihitung.
                        </p>
                    </div>
                </>
            )}
        </div>
    )
}

/**
 * Kabar singkat saat murid kembali ke layar: apa yang tercatat dan sisa
 * kesempatan. Tidak menutupi soal, hilang sendiri. Kesempatan terakhir
 * memakai {@link DialogKesempatanTerakhir} karena wajib benar-benar dibaca.
 */
export function PemberitahuanPelanggaran({ k, r, onTutup }: { k: Kejadian; r: Ringkas; onTutup: () => void }) {
    useEffect(() => {
        const t = setTimeout(onTutup, 7000)

        return () => clearTimeout(t)
    }, [k.kunci, onTutup])

    const sisa = r.ambang - k.ke

    // Di atas lapisan "kembali ke layar penuh" (z-40), di bawah dialog (z-50).
    return (
        <div className="pointer-events-none fixed inset-x-0 top-16 z-[45] flex justify-center px-4">
            <div role="status" aria-live="polite" className="pointer-events-auto flex w-full max-w-md animate-turun items-start gap-3 rounded-md bg-ink px-4 py-3 text-white shadow-lg">
                <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-500" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">
                        Tercatat: {LABEL[k.jenis] ?? 'Pelanggaran'}
                        <span className="font-medium text-white/70">{durasi(k.durasiMs)}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-white/80">
                        {r.mengunci
                            ? `Pelanggaran ke-${k.ke} dari ${r.ambang}. ${sisa > 0 ? `Tetap di layar ini — ujian terkunci di pelanggaran ke-${r.ambang}.` : ''}`
                            : `Pelanggaran ke-${k.ke}, terlihat oleh pengawas.`}
                    </p>
                </div>
                <button onClick={onTutup} aria-label="Tutup" className="-mr-1 rounded-xs p-1 text-white/70 hover:text-white">
                    <X className="size-4" />
                </button>
            </div>
        </div>
    )
}

export function DialogKesempatanTerakhir({ r, onTutup }: { r: Ringkas; onTutup: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-6">
            <div role="alertdialog" aria-modal aria-labelledby="judul-terakhir" className="w-full max-w-sm animate-turun rounded-lg bg-white p-6 text-center shadow-lg">
                <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <ShieldAlert className="size-7" />
                </span>
                <h2 id="judul-terakhir" className="mt-3 text-title">
                    Tinggal satu kesempatan
                </h2>
                <div className="mt-2 flex justify-center text-amber-500">
                    <Titik jumlah={r.jumlah} ambang={r.ambang} besar />
                </div>
                <p className="mt-3 text-sm">
                    Kamu sudah {r.jumlah} kali meninggalkan layar ujian. Sekali lagi, ujian <b>terkunci</b> dan kamu perlu memanggil pengawas untuk melanjutkan.
                </p>
                <Tombol penuh className="mt-5" onClick={onTutup}>
                    Saya mengerti, lanjutkan
                </Tombol>
            </div>
        </div>
    )
}

/** Teks layar terkunci: sebutkan sebabnya bila karena ambang pelanggaran. */
export function alasanKunci(r: Ringkas): string {
    return r.mengunci && r.jumlah >= r.ambang
        ? `Batas pelanggaran tercapai (${r.jumlah > r.ambang ? `${r.jumlah} pelanggaran, batas ${r.ambang}` : `${r.jumlah} dari ${r.ambang}`}). Panggil pengawas untuk membuka — jangan tutup aplikasi.`
        : 'Pengawas mengunci ujianmu. Layar terbuka otomatis setelah pengawas membuka kunci — jangan tutup aplikasi.'
}
