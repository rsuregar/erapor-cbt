import { alasanKunci, DialogKesempatanTerakhir, IndikatorPelanggaran, PemberitahuanPelanggaran } from '@/komponen/Pelanggaran'
import { kelasTombol, Tombol } from '@/komponen/Tombol'
import { waktuMundur } from '@/lib/format'
import { sesi as sesiAkun } from '@/lib/sesi'
import { layarPenuhAktif, masukLayarPenuh, wajibLayarPenuh } from '@/lib/perangkat'
import { useOnline } from '@/lib/useOnline'
import { usePelanggaran } from '@/lib/usePelanggaran'
import { useProteksiKonten } from '@/lib/useProteksiKonten'
import { useSesiUjian, type IsiJawaban } from '@/lib/useSesiUjian'
import { cn } from '@/lib/utils'
import type { Jawaban as JawabanInti, SoalPaket } from '@erapor-cbt/exam-core'
import { TampilanSoal, type DokumenTiptap, type Jawaban, type Opsi, type SoalTampil } from '@erapor-cbt/question-renderer'
import { Link, useBlocker } from '@tanstack/react-router'
import {
    AlertTriangle,
    Bookmark,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ChevronUp,
    Check,
    Clock,
    CloudOff,
    Eye,
    EyeOff,
    Loader2,
    Lock,
    Maximize,
    Megaphone,
    Unlock,
    X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

const TEKS = new Set(['isian', 'uraian', 'studi_kasus'])

function terisi(j: JawabanInti | undefined): boolean {
    if (j === null || j === undefined) return false
    if (typeof j === 'string') return j.trim() !== ''
    if (Array.isArray(j)) return j.length > 0

    return Object.keys(j).length > 0
}

function keTampil(s: SoalPaket, stimulus: Record<string, { judul: string | null; konten: unknown }>): SoalTampil {
    const st = s.stimulus_id ? stimulus[String(s.stimulus_id)] : null

    return {
        jenis: s.jenis,
        pertanyaan: s.pertanyaan as DokumenTiptap,
        opsi: (s.opsi ?? null) as Opsi,
        stimulus: st ? { judul: st.judul, konten: st.konten as DokumenTiptap } : null,
    }
}

/**
 * Layar mengerjakan (PRD M-04–M-07, M-11), pola Bluebook: kepala (judul,
 * timer, status simpan), soal satu per layar (dua panel bila ada bacaan di
 * layar lebar), kaki (nomor + panel navigasi, Kembali/Lanjut), tinjauan.
 */
export default function Kerjakan({ attemptId }: { attemptId: number }) {
    const u = useSesiUjian(attemptId)
    const level = u.data?.sesi.ujian.level_keamanan
    const wajibLp = !!level && wajibLayarPenuh(level)
    const [layarPenuh, setLayarPenuh] = useState(layarPenuhAktif)
    useEffect(() => {
        const ubah = () => setLayarPenuh(layarPenuhAktif())
        document.addEventListener('fullscreenchange', ubah)

        return () => document.removeEventListener('fullscreenchange', ubah)
    }, [])
    const p = usePelanggaran({
        pantauLayarPenuh: wajibLp,
        attemptId,
        aktif: u.status === 'mengerjakan',
        ambangAwal: u.data?.sesi.mulai.ambang_pelanggaran ?? 0,
        level: u.data?.sesi.ujian.level_keamanan,
        msSejakMulai: u.msSejakMulai,
        onTerkunci: u.tandaiTerkunci,
    })
    const [indeks, setIndeks] = useState(0)
    const [panel, setPanel] = useState(false)
    const [tinjau, setTinjau] = useState(false)
    const [konfirmasi, setKonfirmasi] = useState(false)
    const [timerTampil, setTimerTampil] = useState(true)
    const [pesanDitutup, setPesanDitutup] = useState<string | null>(null)
    const [sisaMs, setSisaMs] = useState<number | null>(null)
    const habisDikirim = useRef(false)
    const [skalaFont, setSkalaFont] = useState<number>(() => {
        try {
            const s = localStorage.getItem('cbt_skala_font')
            return s ? Number(s) : 1
        } catch {
            return 1
        }
    })
    const ubahSkalaFont = (s: number) => {
        setSkalaFont(s)
        try {
            localStorage.setItem('cbt_skala_font', String(s))
        } catch {}
    }

    const soal = u.data?.isi.soal ?? []
    const aktif = soal[indeks]

    const pesanProteksi = useProteksiKonten(u.status === 'mengerjakan')

    // Jangan sampai keluar layar ujian tanpa sengaja (tombol kembali / tutup tab).
    const blokir = useBlocker({
        shouldBlockFn: () => u.status === 'mengerjakan',
        enableBeforeUnload: () => u.status === 'mengerjakan',
        withResolver: true,
    })

    // Pelanggaran yang belum terkirim ikut dikirim sebelum kumpul (antreannya dibuang setelah selesai).
    const kumpul = async () => {
        await p.kirim().catch(() => undefined)
        await u.kumpul()
    }

    useEffect(() => {
        if (aktif) u.setSoalAktif(aktif.id)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aktif?.id])

    // Timer dari jam server; habis → kumpul otomatis.
    useEffect(() => {
        if (!u.berakhir || !u.jam) return
        const detik = () => setSisaMs(u.jam!.sisaMs(u.berakhir!))
        detik()
        const t = setInterval(detik, 500)

        return () => clearInterval(t)
    }, [u.berakhir, u.jam])
    useEffect(() => {
        if (sisaMs === 0 && u.status === 'mengerjakan' && !habisDikirim.current) {
            habisDikirim.current = true
            void kumpul()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sisaMs, u.status])

    // Terkunci: kabar pelanggaran yang tertinggal tidak relevan lagi. Dibuka pengawas: beri tahu, sekali.
    const [dibukaPengawas, setDibukaPengawas] = useState(false)
    const statusSebelum = useRef(u.status)
    useEffect(() => {
        if (u.status === 'terkunci') p.tutupKejadian()
        if (statusSebelum.current === 'terkunci' && u.status === 'mengerjakan') setDibukaPengawas(true)
        statusSebelum.current = u.status
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [u.status])
    useEffect(() => {
        if (!dibukaPengawas) return
        const t = setTimeout(() => setDibukaPengawas(false), 8000)

        return () => clearTimeout(t)
    }, [dibukaPengawas])

    // Koneksi: event browser (seketika) + hasil sinkron (server tak terjangkau walau "online").
    const online = useOnline()
    const offline = !online || !u.koneksi.online
    const [sempatOffline, setSempatOffline] = useState(false)
    useEffect(() => {
        if (offline) setSempatOffline(true)
        else if (u.koneksi.tertunda === 0) setSempatOffline(false)
    }, [offline, u.koneksi.tertunda])
    // Online tapi jawaban lama tak terkirim = koneksi lambat. Tenangkan murid sebelum ia memuat ulang.
    const [lambat, setLambat] = useState(false)
    const adaTertunda = u.koneksi.tertunda > 0
    useEffect(() => {
        setLambat(false)
        if (offline || !adaTertunda) return
        const t = setTimeout(() => setLambat(true), 20_000)

        return () => clearTimeout(t)
    }, [offline, adaTertunda])

    const ringkas = useMemo(() => hitung(soal, u.jawaban), [soal, u.jawaban])

    if (u.status === 'memuat') return <Layar ikon={<Loader2 className="size-8 animate-spin text-primary" />} judul="Membuka ujian…" />
    if (u.status === 'tidak_ada') {
        return (
            <Layar ikon={<AlertTriangle className="size-8 text-amber-500" />} judul="Sesi ujian tidak ada di perangkat ini" isi="Buka lagi dari daftar ujian lalu masukkan token.">
                <Link to="/" className={kelasTombol('primary')}>
                    Ke daftar ujian
                </Link>
            </Layar>
        )
    }
    if (u.status === 'selesai') {
        return (
            <Layar ikon={<CheckCircle2 className="size-10 text-green-500" />} judul="Jawaban terkumpul" isi="Terima kasih. Nilai bisa dilihat setelah dirilis guru.">
                <Link to="/" className={kelasTombol('primary')} replace>
                    Kembali ke beranda
                </Link>
            </Layar>
        )
    }
    if (u.status === 'mengumpulkan' || u.status === 'menunggu_sinkron') {
        return u.status === 'mengumpulkan' ? (
            <Layar ikon={<Loader2 className="size-8 animate-spin text-primary" />} judul="Mengumpulkan jawaban…" />
        ) : (
            <Layar
                ikon={<CloudOff className="size-9 text-amber-500" />}
                judul="Menunggu internet"
                isi={`${u.koneksi.tertunda > 0 ? `${u.koneksi.tertunda} jawaban tersimpan di perangkat` : 'Semua jawaban sudah tersimpan'} — pengumpulan dikirim otomatis begitu tersambung. Jangan tutup aplikasi atau hapus datanya.`}
            >
                <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Tombol onClick={() => void kumpul()}>
                        Coba kirim sekarang
                    </Tombol>
                    <Tombol varian="outline" onClick={() => void u.batalKumpul()}>
                        Kembali ke soal
                    </Tombol>
                </div>
            </Layar>
        )
    }

    const nama = sesiAkun.nama() ?? ''
    const tandaAir = [nama, sesiAkun.nis()].filter(Boolean).join(' · ')
    const peringatan = sisaMs !== null && sisaMs <= 5 * 60_000
    const j = aktif ? u.jawaban[aktif.id] : undefined
    const tampilPesan = u.pesan && u.pesan.pada !== pesanDitutup

    return (
        <div className="flex h-full flex-col bg-white">
            {/* Kepala */}
            <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-2xs">
                <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-3 sm:px-6">
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <img src="/brand/logogram.png" alt="" className="size-8 shrink-0 object-contain drop-shadow-xs" />
                        <div className="min-w-0">
                            <p className="truncate text-xs sm:text-sm font-extrabold text-ink leading-tight">{u.data?.sesi.ujian.nama}</p>
                            <p className="truncate text-[11px] font-semibold text-slate-500">{u.data?.sesi.ujian.mapel}</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setTimerTampil((v) => !v)}
                        className={cn(
                            'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-display text-sm sm:text-base font-bold tabular-nums transition shadow-2xs border',
                            peringatan ? 'bg-coral-50 border-coral-200 text-coral-600 animate-pulse' : 'bg-slate-100/90 border-slate-200/90 text-slate-800 hover:bg-slate-200/70',
                        )}
                        aria-label={timerTampil ? 'Sembunyikan waktu' : 'Tampilkan waktu'}
                        title={timerTampil ? 'Sembunyikan waktu tersisa' : 'Tampilkan waktu tersisa'}
                    >
                        <Clock className={cn('size-4', peringatan ? 'text-coral-500' : 'text-slate-500')} />
                        {timerTampil ? waktuMundur((sisaMs ?? 0) / 1000) : <span className="font-sans text-xs">Waktu</span>}
                        {timerTampil ? <EyeOff className="size-3.5 opacity-40 ml-0.5" /> : <Eye className="size-3.5 opacity-60 ml-0.5" />}
                    </button>

                    <div className="flex flex-1 items-center justify-end gap-2">
                        <IndikatorPelanggaran r={p} />
                        <StatusSimpan online={u.koneksi.online} tertunda={u.koneksi.tertunda} />
                    </div>
                </div>
            </header>

            {offline ? (
                <div role="status" className="border-b border-amber-100 bg-amber-100">
                    <div className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2.5 text-sm text-amber-900">
                        <CloudOff className="mt-0.5 size-4 shrink-0" />
                        <p>
                            <b>Kamu sedang offline — tetap kerjakan.</b> Jawaban tersimpan di perangkat
                            {u.koneksi.tertunda > 0 ? ` (${u.koneksi.tertunda} menunggu dikirim)` : ''} dan terkirim otomatis saat tersambung. Tidak perlu memuat ulang halaman.
                        </p>
                    </div>
                </div>
            ) : lambat && !sempatOffline ? (
                <div role="status" className="border-b border-sky-100 bg-sky-100">
                    <div className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2.5 text-sm text-sky-600">
                        <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin" />
                        <p>
                            <b>Koneksi lambat.</b> {u.koneksi.tertunda} jawaban tersimpan aman di perangkat dan sedang dikirim. Lanjutkan saja — tidak perlu memuat ulang.
                        </p>
                    </div>
                </div>
            ) : (
                sempatOffline && (
                    <div role="status" className="border-b border-sky-100 bg-sky-100">
                        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2.5 text-sm text-sky-600">
                            <Loader2 className="size-4 shrink-0 animate-spin" />
                            <p>
                                <b>Tersambung lagi.</b> Mengirim {u.koneksi.tertunda} jawaban…
                            </p>
                        </div>
                    </div>
                )
            )}

            {tampilPesan && (
                <div className="border-b border-amber-100 bg-amber-100">
                    <div className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2.5 text-sm text-amber-900">
                        <Megaphone className="mt-0.5 size-4 shrink-0" />
                        <p className="flex-1">
                            <span className="font-bold">Pesan pengawas: </span>
                            {u.pesan!.teks}
                        </p>
                        <button onClick={() => setPesanDitutup(u.pesan!.pada)} aria-label="Tutup pesan" className="rounded-xs p-0.5">
                            <X className="size-4" />
                        </button>
                    </div>
                </div>
            )}

            {/* Soal / tinjauan */}
            {/* Teks soal tidak bisa diseleksi/ditekan-lama; kolom jawaban tetap bisa. */}
            <main className="relative flex-1 min-h-0 flex flex-col select-none overflow-hidden [-webkit-touch-callout:none] [&_[contenteditable]]:select-text [&_input]:select-text [&_textarea]:select-text">
                <Watermark teks={tandaAir} />
                {tinjau ? (
                    <div className="relative z-10 flex-1 overflow-y-auto">
                        <Tinjauan
                            soal={soal}
                            jawaban={u.jawaban}
                            ringkas={ringkas}
                            galat={u.galatKumpul}
                            onPilih={(i) => {
                                setIndeks(i)
                                setTinjau(false)
                            }}
                            onKumpul={() => setKonfirmasi(true)}
                        />
                    </div>
                ) : (
                    aktif &&
                    u.data && (
                        <div className="relative z-10 flex-1 min-h-0 flex flex-col w-full h-full max-w-7xl mx-auto">
                            <TampilanSoal
                                key={aktif.id}
                                soal={keTampil(aktif, u.data.isi.stimulus)}
                                nomor={aktif.nomor}
                                jawaban={(j?.jawaban ?? null) as Jawaban}
                                ragu={j?.ragu ?? false}
                                onJawab={(isi) => u.jawab(aktif.id, isi, j?.ragu ?? false, { teks: TEKS.has(aktif.jenis) })}
                                onRagu={(r) => u.jawab(aktif.id, j?.jawaban ?? null, r)}
                                skalaFont={skalaFont}
                                onUbahSkalaFont={ubahSkalaFont}
                            />
                        </div>
                    )
                )}
            </main>

            {/* Kaki */}
            <footer className="sticky bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur-md shadow-xs">
                <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-3 sm:px-6">
                    <div className="hidden flex-1 items-center gap-2.5 truncate md:flex">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-xs font-bold text-primary border border-sky-200/70">
                            {nama ? nama.charAt(0).toUpperCase() : 'P'}
                        </span>
                        <p className="truncate text-xs font-semibold text-slate-700">{nama}</p>
                    </div>

                    <div className="flex flex-1 justify-center">
                        <button
                            onClick={() => setPanel(true)}
                            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-4 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-slate-800 active:scale-95 transition"
                            aria-label="Buka navigasi nomor soal"
                        >
                            <span>{tinjau ? 'Tinjauan Jawaban' : `Soal ${indeks + 1} dari ${soal.length}`}</span>
                            <ChevronUp className="size-4 text-white/70" />
                        </button>
                    </div>

                    <div className="flex flex-1 justify-end gap-2">
                        {tinjau ? (
                            <Tombol varian="outline" onClick={() => setTinjau(false)} ikonKiri={<ChevronLeft className="size-4" />} className="rounded-xl font-semibold">
                                Kembali ke Soal
                            </Tombol>
                        ) : (
                            <>
                                <Tombol
                                    varian="outline"
                                    disabled={indeks === 0}
                                    onClick={() => setIndeks((i) => i - 1)}
                                    aria-label="Soal sebelumnya"
                                    className="rounded-xl px-3 sm:px-5 font-semibold"
                                >
                                    <ChevronLeft className="size-4" />
                                    <span className="hidden sm:inline">Kembali</span>
                                </Tombol>
                                {indeks < soal.length - 1 ? (
                                    <Tombol onClick={() => setIndeks((i) => i + 1)} ikonKanan={<ChevronRight className="size-4" />} className="rounded-xl font-bold shadow-xs">
                                        Lanjut
                                    </Tombol>
                                ) : (
                                    <Tombol onClick={() => setTinjau(true)} ikonKanan={<ChevronRight className="size-4" />} className="rounded-xl font-bold bg-primary text-white shadow-xs">
                                        Tinjau
                                    </Tombol>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </footer>

            {panel && (
                <PanelNomor
                    soal={soal}
                    jawaban={u.jawaban}
                    aktif={tinjau ? -1 : indeks}
                    onPilih={(i) => {
                        setIndeks(i)
                        setTinjau(false)
                        setPanel(false)
                    }}
                    onTinjau={() => {
                        setTinjau(true)
                        setPanel(false)
                    }}
                    onTutup={() => setPanel(false)}
                />
            )}

            {konfirmasi && (
                <Dialog onTutup={() => setKonfirmasi(false)}>
                    <h2 className="text-title">Kumpulkan sekarang?</h2>
                    <p className="mt-1 text-sm">
                        {ringkas.kosong > 0 || ringkas.ragu > 0
                            ? `Masih ada ${ringkas.kosong} soal kosong dan ${ringkas.ragu} ragu-ragu. `
                            : 'Semua soal sudah dijawab. '}
                        Setelah dikumpulkan, jawaban tidak bisa diubah.
                    </p>
                    <div className="mt-5 flex justify-end gap-2">
                        <Tombol varian="outline" onClick={() => setKonfirmasi(false)}>
                            Batal
                        </Tombol>
                        <Tombol
                            onClick={() => {
                                setKonfirmasi(false)
                                void kumpul()
                            }}
                        >
                            Kumpulkan
                        </Tombol>
                    </div>
                </Dialog>
            )}

            {p.kejadian &&
                u.status === 'mengerjakan' &&
                (p.mengunci && p.kejadian.ke === p.ambang - 1 ? (
                    <DialogKesempatanTerakhir r={p} onTutup={p.tutupKejadian} />
                ) : (
                    <PemberitahuanPelanggaran k={p.kejadian} r={p} onTutup={p.tutupKejadian} />
                ))}

            {dibukaPengawas && !p.kejadian && (
                <div className="pointer-events-none fixed inset-x-0 top-16 z-30 flex justify-center px-4">
                    <div role="status" aria-live="polite" className="pointer-events-auto flex w-full max-w-md animate-turun items-start gap-3 rounded-md bg-ink px-4 py-3 text-white shadow-lg">
                        <Unlock className="mt-0.5 size-5 shrink-0 text-green-500" />
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold">Ujian dibuka pengawas</p>
                            {p.tingkat === 'batas' && <p className="mt-0.5 text-xs text-white/80">Batas pelanggaran sudah tercapai — keluar dari layar sekali lagi langsung mengunci ujian.</p>}
                        </div>
                        <button onClick={() => setDibukaPengawas(false)} aria-label="Tutup" className="-mr-1 rounded-xs p-1 text-white/70 hover:text-white">
                            <X className="size-4" />
                        </button>
                    </div>
                </div>
            )}

            {pesanProteksi && (
                <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center px-4">
                    <p role="status" className="animate-turun rounded-full bg-ink/90 px-4 py-2 text-xs font-semibold text-white shadow-md">
                        {pesanProteksi}
                    </p>
                </div>
            )}

            {blokir.status === 'blocked' && (
                <Dialog onTutup={() => blokir.reset()}>
                    <h2 className="text-title">Keluar dari layar ujian?</h2>
                    <p className="mt-1 text-sm">Waktu tetap berjalan dan jawabanmu tetap tersimpan. Kembali ke sini sebelum waktu habis untuk mengumpulkan.</p>
                    <div className="mt-5 flex justify-end gap-2">
                        <Tombol varian="outline" onClick={() => blokir.proceed()}>
                            Keluar
                        </Tombol>
                        <Tombol onClick={() => blokir.reset()}>Tetap di sini</Tombol>
                    </div>
                </Dialog>
            )}

            {wajibLp && !layarPenuh && u.status === 'mengerjakan' && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/80 p-6 backdrop-blur-md">
                    <div className="max-w-sm rounded-lg bg-white p-6 text-center shadow-lg">
                        <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                            <Maximize className="size-7" />
                        </span>
                        <h2 className="mt-3 text-title">Kembali ke layar penuh</h2>
                        <p className="mt-1 text-sm">Ujian ini wajib dikerjakan dalam layar penuh. Soal tertutup sampai layar penuh aktif lagi.</p>
                        <Tombol penuh className="mt-5" onClick={() => void masukLayarPenuh()}>
                            Layar penuh
                        </Tombol>
                    </div>
                </div>
            )}

            {u.status === 'terkunci' && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-6 backdrop-blur-sm">
                    <div className="max-w-sm rounded-lg bg-white p-6 text-center shadow-lg">
                        <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-coral-100">
                            <Lock className="size-7 text-coral-600" />
                        </span>
                        <h2 className="mt-3 text-title">Ujian dikunci</h2>
                        <p className="mt-1 text-sm">{alasanKunci(p)}</p>
                    </div>
                </div>
            )}
        </div>
    )

    function hitung(daftar: SoalPaket[], isi: IsiJawaban) {
        let dijawab = 0
        let ragu = 0
        for (const s of daftar) {
            const x = isi[s.id]
            if (terisi(x?.jawaban)) dijawab++
            if (x?.ragu) ragu++
        }

        return { dijawab, ragu, kosong: daftar.length - dijawab }
    }
}

function StatusSimpan({ online, tertunda }: { online: boolean; tertunda: number }) {
    if (!online) {
        return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800 border border-amber-200" title="Jawaban aman di perangkat">
                <CloudOff className="size-3.5" /> <span className="hidden sm:inline">Offline ·</span> {tertunda}
            </span>
        )
    }

    return tertunda > 0 ? (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 border border-amber-200/80 px-2.5 py-1 text-xs font-semibold text-amber-800">
            <Loader2 className="size-3.5 animate-spin text-amber-600" /> <span className="hidden sm:inline">Menyimpan</span>
        </span>
    ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <Check className="size-3.5 text-emerald-600" /> <span className="hidden sm:inline">Tersimpan</span>
        </span>
    )
}

function kelasNomor(terjawab: boolean, ragu: boolean, aktif: boolean) {
    return cn(
        'relative inline-flex aspect-square items-center justify-center rounded-lg border-2 text-sm font-bold transition active:scale-95 shadow-2xs',
        terjawab ? 'border-primary bg-primary text-white shadow-xs' : 'border-dashed border-slate-300 bg-white text-ink hover:border-slate-400',
        aktif && 'ring-2 ring-slate-900 ring-offset-2',
        ragu && 'border-amber-500 bg-amber-50 text-amber-900',
    )
}

function PanelNomor({
    soal,
    jawaban,
    aktif,
    onPilih,
    onTinjau,
    onTutup,
}: {
    soal: SoalPaket[]
    jawaban: IsiJawaban
    aktif: number
    onPilih: (i: number) => void
    onTinjau: () => void
    onTutup: () => void
}) {
    return (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 backdrop-blur-xs sm:items-center p-0 sm:p-4" onClick={onTutup}>
            <div className="max-h-[85vh] w-full overflow-y-auto rounded-t-lg bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-lg border border-slate-200" onClick={(e) => e.stopPropagation()}>
                <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                    <h2 className="text-base sm:text-lg font-bold text-ink">Daftar Nomor Soal</h2>
                    <button onClick={onTutup} aria-label="Tutup" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
                        <X className="size-5" />
                    </button>
                </div>
                <Legenda />
                <div className="mt-4 grid grid-cols-6 gap-2 sm:grid-cols-8">
                    {soal.map((s, i) => {
                        const x = jawaban[s.id]

                        return (
                            <button key={s.id} onClick={() => onPilih(i)} className={kelasNomor(terisi(x?.jawaban), !!x?.ragu, i === aktif)}>
                                {s.nomor}
                                {x?.ragu && <Bookmark className="absolute -right-1 -top-1.5 size-3.5 fill-amber-500 text-amber-500 drop-shadow-xs" />}
                            </button>
                        )
                    })}
                </div>
                <Tombol varian="secondary" penuh className="mt-6 rounded-lg font-bold py-3" onClick={onTinjau}>
                    Ke Halaman Tinjauan
                </Tombol>
            </div>
        </div>
    )
}

function Legenda() {
    return (
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600 bg-slate-50/80 p-2.5 rounded-lg border border-slate-100">
            <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="size-3.5 rounded-sm bg-primary" /> Sudah Dijawab
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="size-3.5 rounded-sm border-2 border-dashed border-slate-300 bg-white" /> Belum Dijawab
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                <Bookmark className="size-3.5 fill-amber-500 text-amber-500" /> Ragu-ragu
            </span>
        </div>
    )
}

function Tinjauan({
    soal,
    jawaban,
    ringkas,
    galat,
    onPilih,
    onKumpul,
}: {
    soal: SoalPaket[]
    jawaban: IsiJawaban
    ringkas: { dijawab: number; ragu: number; kosong: number }
    galat: string | null
    onPilih: (i: number) => void
    onKumpul: () => void
}) {
    return (
        <div className="relative mx-auto max-w-2xl space-y-5 px-4 py-6 sm:py-8">
            <div className="text-center space-y-1">
                <h1 className="text-xl sm:text-2xl font-extrabold text-ink">Tinjau Jawaban Ujian</h1>
                <p className="text-xs sm:text-sm text-slate-500">Periksa kembali sebelum mengumpulkan. Ketuk nomor soal untuk membuka dan mengubah jawaban.</p>
            </div>
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 text-center">
                <Angka label="Dijawab" nilai={ringkas.dijawab} kelas="bg-sky-50 border border-sky-200/80 text-sky-800" />
                <Angka label="Ragu-ragu" nilai={ringkas.ragu} kelas="bg-amber-50 border border-amber-200/80 text-amber-800" />
                <Angka label="Kosong" nilai={ringkas.kosong} kelas={ringkas.kosong ? 'bg-coral-50 border border-coral-200/80 text-coral-700' : 'bg-slate-100 border border-slate-200 text-slate-700'} />
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
                <Legenda />
                <div className="grid grid-cols-6 gap-2 sm:grid-cols-10 pt-1">
                    {soal.map((s, i) => {
                        const x = jawaban[s.id]

                        return (
                            <button key={s.id} onClick={() => onPilih(i)} className={kelasNomor(terisi(x?.jawaban), !!x?.ragu, false)}>
                                {s.nomor}
                                {x?.ragu && <Bookmark className="absolute -right-1 -top-1.5 size-3.5 fill-amber-500 text-amber-500 drop-shadow-xs" />}
                            </button>
                        )
                    })}
                </div>
            </div>
            {galat && (
                <p role="alert" className="flex items-center gap-2 rounded-lg bg-coral-50 border border-coral-200 px-3.5 py-2.5 text-xs font-semibold text-coral-700">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>{galat}</span>
                </p>
            )}
            <Tombol ukuran="lg" penuh onClick={onKumpul} className="rounded-lg font-bold py-3.5 shadow-md shadow-primary/25">
                Kumpulkan Jawaban Sekarang
            </Tombol>
        </div>
    )
}

function Angka({ label, nilai, kelas }: { label: string; nilai: number; kelas: string }) {
    return (
        <div className={cn('rounded-lg py-3 px-2', kelas)}>
            <p className="font-display text-2xl sm:text-3xl font-extrabold leading-none">{nilai}</p>
            <p className="mt-1 text-xs font-semibold tracking-wide">{label}</p>
        </div>
    )
}

/** Nama + NIS samar di latar — bocoran foto/tangkapan layar soal bisa dilacak (PRD batasan web). */
function Watermark({ teks }: { teks: string }) {
    if (!teks) return null

    const sanitized = teks
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="200" viewBox="0 0 360 200"><text x="180" y="100" fill="#0f172a" fill-opacity="0.04" font-size="13" font-weight="700" font-family="'Plus Jakarta Sans', system-ui, sans-serif" text-anchor="middle" transform="rotate(-20 180 100)">${sanitized}</text></svg>`
    const bgUrl = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`

    return (
        <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-0 select-none"
            style={{
                backgroundImage: bgUrl,
                backgroundRepeat: 'repeat',
                backgroundPosition: '0 0',
            }}
        />
    )
}

function Dialog({ children, onTutup }: { children: React.ReactNode; onTutup: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-6" onClick={onTutup}>
            <div role="dialog" aria-modal className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>
    )
}

function Layar({ ikon, judul, isi, children }: { ikon: React.ReactNode; judul: string; isi?: string; children?: React.ReactNode }) {
    return (
        <main className="flex min-h-full flex-col items-center justify-center gap-3 p-6 text-center">
            {ikon}
            <h1 className="text-h3">{judul}</h1>
            {isi && <p className="max-w-sm text-sm text-slate-500">{isi}</p>}
            {children && <div className="mt-2">{children}</div>}
        </main>
    )
}
