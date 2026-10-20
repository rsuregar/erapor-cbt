import { alasanKunci, DialogKesempatanTerakhir, IndikatorPelanggaran, PemberitahuanPelanggaran } from '@/komponen/Pelanggaran'
import { kelasTombol, Tombol } from '@/komponen/Tombol'
import { waktuMundur } from '@/lib/format'
import { kelompokkanPerSection } from '@/lib/sectionSoal'
import { sesi as sesiAkun } from '@/lib/sesi'
import { layarPenuhAktif, masukLayarPenuh, wajibLayarPenuh } from '@/lib/perangkat'
import { useOnline } from '@/lib/useOnline'
import { usePelanggaran } from '@/lib/usePelanggaran'
import { useProteksiKonten } from '@/lib/useProteksiKonten'
import { useSesiUjian, type IsiJawaban } from '@/lib/useSesiUjian'
import { cn } from '@/lib/utils'
import type { Jawaban as JawabanInti, SoalPaket } from '@erapor-cbt/exam-core'
import { TampilanSoal, type DokumenTiptap, type Jawaban, type Opsi, type SoalTampil } from '@erapor-cbt/question-renderer'
import { Link, useBlocker, useNavigate } from '@tanstack/react-router'
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
    Layers,
    Loader2,
    Lock,
    Maximize,
    Megaphone,
    Unlock,
    X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'

const TEKS = new Set(['isian', 'uraian', 'studi_kasus'])

/** Pesan "diakhiri pengawas" ditahan sebelum kembali ke beranda supaya murid sempat membacanya. */
const JEDA_PESAN_PENGAWAS_MS = 10_000
/** Layar "selesai" cukup lama untuk dibaca anak — penutup yang paling diingat. */
const JEDA_SELESAI_MS = 6000

function terisi(j: JawabanInti | undefined): boolean {
    if (j === null || j === undefined) return false
    if (typeof j === 'string') return j.trim() !== ''
    if (Array.isArray(j)) return j.length > 0

    return Object.keys(j).length > 0
}

type StatusIsi = 'kosong' | 'sebagian' | 'lengkap'

/**
 * Benar/salah & menjodohkan baru lengkap bila SEMUA baris terisi — dulu satu baris
 * saja sudah dihitung "dijawab", dan murid baru kaget saat nilai keluar.
 */
function statusJawaban(s: SoalPaket, j: JawabanInti | undefined): StatusIsi {
    if (!terisi(j)) return 'kosong'
    const isi = Object.values((j ?? {}) as Record<string, unknown>)
    if (s.jenis === 'benar_salah') {
        const n = ((s.opsi as { pernyataan?: unknown[] } | null)?.pernyataan ?? []).length
        return n > 0 && isi.filter((v) => typeof v === 'boolean').length < n ? 'sebagian' : 'lengkap'
    }
    if (s.jenis === 'menjodohkan') {
        const n = ((s.opsi as { kiri?: unknown[] } | null)?.kiri ?? []).length
        const terpasang = isi.filter((v) => typeof v === 'string' && v !== '').length
        if (terpasang === 0) return 'kosong'
        return n > 0 && terpasang < n ? 'sebagian' : 'lengkap'
    }
    return 'lengkap'
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
    const navigate = useNavigate()
    const u = useSesiUjian(attemptId)
    const level = u.data?.sesi.ujian.level_keamanan
    const wajibLp = !!level && wajibLayarPenuh(level)
    const [layarPenuh, setLayarPenuh] = useState(layarPenuhAktif)
    useEffect(() => {
        const ubah = () => setLayarPenuh(layarPenuhAktif())
        document.addEventListener('fullscreenchange', ubah)

        return () => document.removeEventListener('fullscreenchange', ubah)
    }, [])

    // Jika status ujian menjadi selesai (dikumpulkan murid, waktu habis,
    // atau diakhiri pengawas dari dashboard e-Rapor), arahkan murid kembali ke
    // beranda. Pesan dari pengawas ditahan lebih lama supaya sempat terbaca.
    useEffect(() => {
        if (u.status === 'selesai') {
            const timer = setTimeout(() => {
                void navigate({ to: '/', replace: true })
            }, u.alasanSelesai ? JEDA_PESAN_PENGAWAS_MS : JEDA_SELESAI_MS)

            return () => clearTimeout(timer)
        }
    }, [u.status, u.alasanSelesai, navigate])
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

    // Pindah ke bagian (section) lain: beri tahu sebentar, kecuali saat layar baru dibuka.
    const sectionSebelum = useRef<string | null | undefined>(undefined)
    const [masukSection, setMasukSection] = useState<string | null>(null)
    useEffect(() => {
        if (!aktif) return
        u.setSoalAktif(aktif.id)
        const s = aktif.section?.trim() || null
        if (sectionSebelum.current !== undefined && s && s !== sectionSebelum.current) setMasukSection(s)
        sectionSebelum.current = s
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [aktif?.id])
    useEffect(() => {
        if (!masukSection) return
        const t = setTimeout(() => setMasukSection(null), 4000)

        return () => clearTimeout(t)
    }, [masukSection])

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
        const olehPengawas = u.alasanSelesai !== null

        return (
            <Layar
                ikon={
                    olehPengawas ? (
                        <Megaphone className="size-12 text-amber-500" />
                    ) : (
                        <CheckCircle2 className="size-12 text-green-500 animate-turun" />
                    )
                }
                judul={
                    u.alasanSelesai === 'sesi_dihentikan'
                        ? 'Sesi Ujian Dihentikan Pengawas'
                        : u.alasanSelesai === 'dikumpulkan_pengawas'
                          ? 'Ujian Dikumpulkan Pengawas'
                          : 'Ujian Selesai & Jawaban Terkumpul'
                }
                isi={
                    u.alasanSelesai === 'sesi_dihentikan'
                        ? 'Sesi ujian dihentikan oleh pengawas/guru. Semua jawabanmu sudah dikumpulkan otomatis dan tersimpan aman di server.'
                        : u.alasanSelesai === 'dikumpulkan_pengawas'
                          ? 'Pengawas/guru sudah mengumpulkan ujianmu. Jawaban yang terkirim tersimpan aman di server — aplikasimu tidak bermasalah.'
                          : 'Terima kasih sudah mengerjakan dengan jujur. Jawabanmu sudah terkirim dan tersimpan aman. Nilai bisa dilihat setelah dirilis guru.'
                }
            >
                <div className="mt-4 flex flex-col items-center gap-2">
                    <Link to="/" className={kelasTombol('primary')} replace>
                        Kembali ke beranda sekarang
                    </Link>
                    <p className="text-[11px] text-slate-400">
                        {`Otomatis kembali ke beranda dalam ${(olehPengawas ? JEDA_PESAN_PENGAWAS_MS : JEDA_SELESAI_MS) / 1000} detik…`}
                    </p>
                </div>
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
                        {/* HP: ruang untuk nama ujian lebih penting dari logo. */}
                        <img src="/brand/logogram.png" alt="" className="hidden size-8 shrink-0 object-contain drop-shadow-xs sm:block" />
                        <div className="min-w-0">
                            <p className="truncate text-xs sm:text-sm font-extrabold text-ink leading-tight">{u.data?.sesi.ujian.nama}</p>
                            <p className="truncate text-[11px] font-semibold text-slate-500">{u.data?.sesi.ujian.mapel}</p>
                        </div>
                    </div>

                    <button
                        onClick={() => setTimerTampil((v) => !v)}
                        className={cn(
                            'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-display text-sm sm:text-base font-bold tabular-nums transition shadow-2xs border',
                            peringatan ? 'bg-coral-50 border-coral-200 text-coral-700' : 'bg-slate-100/90 border-slate-200/90 text-slate-800 hover:bg-slate-200/70',
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
                        <button onClick={() => setPesanDitutup(u.pesan!.pada)} aria-label="Tutup pesan pengawas" className="-my-2 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-md">
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
                        // Satu-satunya area gulir soal (HP: bacaan + soal mengalir; lg: panel per kolom).
                        <div className="relative z-10 mx-auto w-full max-w-7xl flex-1 min-h-0 overflow-y-auto overscroll-contain">
                            <TampilanSoal
                                key={aktif.id}
                                soal={keTampil(aktif, u.data.isi.stimulus)}
                                nomor={aktif.nomor}
                                section={aktif.section}
                                jawaban={(j?.jawaban ?? null) as Jawaban}
                                ragu={j?.ragu ?? false}
                                onJawab={(isi) => u.jawab(aktif.id, isi, j?.ragu ?? false, { teks: TEKS.has(aktif.jenis) })}
                                onRagu={(r) => u.jawab(aktif.id, j?.jawaban ?? null, r)}
                                skalaFont={skalaFont}
                                onUbahSkalaFont={ubahSkalaFont}
                                kontrolDiKaki
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

                    {/* HP: ragu-ragu & ukuran teks di zona jempol (renderer menyembunyikannya di atas). */}
                    {!tinjau && aktif && (
                        <div className="flex items-center gap-1.5 sm:hidden">
                            <button
                                type="button"
                                aria-pressed={!!j?.ragu}
                                aria-label={j?.ragu ? 'Batalkan tanda ragu-ragu' : 'Tandai ragu-ragu'}
                                onClick={() => u.jawab(aktif.id, j?.jawaban ?? null, !j?.ragu)}
                                className={cn(
                                    'inline-flex size-11 items-center justify-center rounded-xl border-2 transition active:scale-95',
                                    j?.ragu ? 'border-amber-500 bg-amber-100 text-amber-800' : 'border-slate-200 bg-white text-slate-600',
                                )}
                            >
                                <Bookmark className={cn('size-5', j?.ragu && 'fill-amber-500 text-amber-600')} />
                            </button>
                            <UkuranTeks skala={skalaFont} onUbah={ubahSkalaFont} />
                        </div>
                    )}

                    <div className="flex flex-1 justify-center">
                        <button
                            onClick={() => setPanel(true)}
                            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 text-sm font-bold text-white shadow-sm hover:bg-slate-800 active:scale-95 transition sm:px-4"
                            aria-label={tinjau ? 'Buka daftar nomor soal' : `Soal ${indeks + 1} dari ${soal.length}. Buka daftar nomor soal`}
                        >
                            {tinjau ? (
                                <span>Nomor soal</span>
                            ) : (
                                <span className="tabular-nums">
                                    <span className="hidden sm:inline">Soal </span>
                                    {indeks + 1}
                                    <span className="sm:hidden">/</span>
                                    <span className="hidden sm:inline"> dari </span>
                                    {soal.length}
                                </span>
                            )}
                            <ChevronUp className="size-4 text-white/70" />
                        </button>
                    </div>

                    <div className="flex flex-1 justify-end gap-2">
                        {tinjau ? (
                            <Tombol varian="outline" onClick={() => setTinjau(false)} ikonKiri={<ChevronLeft className="size-4" />} className="rounded-xl font-semibold">
                                Ke soal
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
                    <h2 id="judul-dialog" className="text-title">Kumpulkan sekarang?</h2>
                    {ringkas.kosong + ringkas.sebagian + ringkas.ragu === 0 ? (
                        <p className="mt-1 text-sm">Semua soal sudah dijawab.</p>
                    ) : (
                        <ul className="mt-2 space-y-1 text-sm">
                            {ringkas.kosong > 0 && <li><b>Kosong:</b> soal {ringkas.nomorKosong.join(', ')}</li>}
                            {ringkas.sebagian > 0 && <li><b>Belum lengkap:</b> soal {ringkas.nomorSebagian.join(', ')}</li>}
                            {ringkas.ragu > 0 && <li><b>Ragu-ragu:</b> {ringkas.ragu} soal</li>}
                        </ul>
                    )}
                    <p className="mt-2 text-sm">
                        {sisaMs !== null && sisaMs > 0 ? `Sisa waktu ${waktuMundur(sisaMs / 1000)}. ` : ''}Setelah dikumpulkan, jawaban tidak bisa diubah.
                    </p>
                    <div className="mt-5 flex justify-end gap-2">
                        <Tombol varian="outline" onClick={() => setKonfirmasi(false)} data-fokus-awal>
                            Periksa lagi
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

            {masukSection && !p.kejadian && !dibukaPengawas && (
                <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center px-4">
                    <div role="status" aria-live="polite" className="pointer-events-auto flex w-full max-w-md animate-turun items-center gap-3 rounded-md bg-sky-700 px-4 py-3 text-white shadow-lg">
                        <Layers className="size-5 shrink-0 text-sky-200" />
                        <p className="min-w-0 flex-1 text-sm">
                            <span className="text-sky-100">Memasuki </span>
                            <b>{masukSection}</b>
                        </p>
                        <button onClick={() => setMasukSection(null)} aria-label="Tutup" className="-mr-1 rounded-xs p-1 text-white/70 hover:text-white">
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
                    <h2 id="judul-dialog" className="text-title">Keluar dari layar ujian?</h2>
                    <p className="mt-1 text-sm">Waktu tetap berjalan dan jawabanmu tetap tersimpan. Kembali ke sini sebelum waktu habis untuk mengumpulkan.</p>
                    <div className="mt-5 flex justify-end gap-2">
                        <Tombol varian="outline" onClick={() => blokir.proceed()}>
                            Keluar
                        </Tombol>
                        <Tombol onClick={() => blokir.reset()} data-fokus-awal>
                            Tetap di sini
                        </Tombol>
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
        const nomorKosong: number[] = []
        const nomorSebagian: number[] = []
        let ragu = 0
        for (const s of daftar) {
            const x = isi[s.id]
            const st = statusJawaban(s, x?.jawaban)
            if (st === 'kosong') nomorKosong.push(s.nomor)
            if (st === 'sebagian') nomorSebagian.push(s.nomor)
            if (x?.ragu) ragu++
        }
        const dijawab = daftar.length - nomorKosong.length - nomorSebagian.length

        return { dijawab, ragu, kosong: nomorKosong.length, sebagian: nomorSebagian.length, nomorKosong, nomorSebagian }
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

function kelasNomor(status: StatusIsi, ragu: boolean, aktif: boolean) {
    return cn(
        'relative inline-flex aspect-square min-h-11 items-center justify-center rounded-lg border-2 text-sm font-bold transition active:scale-95',
        status === 'lengkap' && 'border-primary bg-primary text-white',
        // Belum lengkap: setengah terisi, tetap terbaca beda dari "dijawab".
        status === 'sebagian' && 'border-primary bg-[linear-gradient(135deg,theme(colors.primary.100)_50%,white_50%)] text-primary-800',
        status === 'kosong' && 'border-dashed border-slate-400 bg-white text-ink hover:border-slate-500',
        aktif && 'ring-2 ring-ink ring-offset-2',
        // Ragu: bingkai kuning saja — isi tetap menunjukkan status jawaban.
        ragu && 'border-amber-500',
    )
}

const LABEL_STATUS: Record<StatusIsi, string> = { lengkap: 'sudah dijawab', sebagian: 'belum lengkap', kosong: 'belum dijawab' }

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
    const ref = useLapisan(onTutup)

    return (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40 backdrop-blur-xs sm:items-center p-0 sm:p-4" onClick={onTutup}>
            <div
                ref={ref}
                role="dialog"
                aria-modal
                aria-labelledby="judul-panel-nomor"
                className="max-h-[85vh] w-full overflow-y-auto rounded-t-lg bg-white p-5 shadow-2xl sm:max-w-xl sm:rounded-lg border border-slate-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
                    <h2 id="judul-panel-nomor" className="text-base sm:text-lg font-bold text-ink">Daftar Nomor Soal</h2>
                    <button onClick={onTutup} aria-label="Tutup daftar nomor soal" className="-m-1.5 inline-flex size-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition">
                        <X className="size-5" />
                    </button>
                </div>
                <Legenda />
                <div className="mt-4">
                    <GridNomor soal={soal} jawaban={jawaban} aktif={aktif} kolom="grid-cols-6 sm:grid-cols-8" onPilih={onPilih} />
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
                <span className="size-3.5 rounded-sm border-2 border-primary bg-[linear-gradient(135deg,theme(colors.primary.100)_50%,white_50%)]" /> Belum Lengkap
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium">
                <span className="size-3.5 rounded-sm border-2 border-dashed border-slate-400 bg-white" /> Belum Dijawab
            </span>
            <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                <Bookmark className="size-3.5 fill-amber-500 text-amber-500" /> Ragu-ragu
            </span>
        </div>
    )
}

/** Tombol nomor soal, dikelompokkan per bagian bila paket memakai section. */
function GridNomor({
    soal,
    jawaban,
    aktif,
    kolom,
    onPilih,
}: {
    soal: SoalPaket[]
    jawaban: IsiJawaban
    aktif: number
    kolom: string
    onPilih: (i: number) => void
}) {
    return (
        <div className="space-y-4">
            {kelompokkanPerSection(soal).map((k) => (
                <section key={`${k.nomorAwal}-${k.section ?? ''}`} aria-label={k.section ?? undefined}>
                    {k.section && (
                        <h3 className="mb-2 flex items-baseline justify-between gap-2 border-b border-slate-100 pb-1.5">
                            <span className="truncate text-xs font-bold text-sky-700">{k.section}</span>
                            <span className="shrink-0 text-[11px] font-semibold text-slate-400 tabular-nums">
                                {k.nomorAwal === k.nomorAkhir ? `Soal ${k.nomorAwal}` : `Soal ${k.nomorAwal}–${k.nomorAkhir}`}
                            </span>
                        </h3>
                    )}
                    <div className={cn('grid gap-2', kolom)}>
                        {k.butir.map(({ soal: s, indeks: i }) => {
                            const x = jawaban[s.id]

                            return (
                                <button
                                    key={s.id}
                                    onClick={() => onPilih(i)}
                                    className={kelasNomor(statusJawaban(s, x?.jawaban), !!x?.ragu, i === aktif)}
                                    aria-label={`Soal ${s.nomor}, ${LABEL_STATUS[statusJawaban(s, x?.jawaban)]}${x?.ragu ? ', ditandai ragu-ragu' : ''}${i === aktif ? ', sedang dibuka' : ''}`}
                                    aria-current={i === aktif ? 'step' : undefined}
                                >
                                    {s.nomor}
                                    {x?.ragu && <Bookmark className="absolute -right-1 -top-1.5 size-3.5 fill-amber-500 text-amber-500 drop-shadow-xs" />}
                                </button>
                            )
                        })}
                    </div>
                </section>
            ))}
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
    ringkas: { dijawab: number; ragu: number; kosong: number; sebagian: number; nomorKosong: number[]; nomorSebagian: number[] }
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
            {/* Tiga angka berjumlah sama dengan banyak soal; ragu-ragu adalah tanda, bukan status. */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 text-center">
                <Angka label="Dijawab" nilai={ringkas.dijawab} kelas="bg-sky-50 border border-sky-200/80 text-sky-800" />
                <Angka label="Belum lengkap" nilai={ringkas.sebagian} kelas={ringkas.sebagian ? 'bg-primary-50 border border-primary-200 text-primary-800' : 'bg-slate-100 border border-slate-200 text-slate-700'} />
                <Angka label="Kosong" nilai={ringkas.kosong} kelas={ringkas.kosong ? 'bg-coral-50 border border-coral-200/80 text-coral-700' : 'bg-slate-100 border border-slate-200 text-slate-700'} />
            </div>
            {ringkas.ragu > 0 && (
                <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-amber-800">
                    <Bookmark className="size-4 fill-amber-500 text-amber-500" /> {ringkas.ragu} soal ditandai ragu-ragu
                </p>
            )}
            <div className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5 shadow-xs space-y-3.5">
                <Legenda />
                <GridNomor soal={soal} jawaban={jawaban} aktif={-1} kolom="grid-cols-6 sm:grid-cols-10" onPilih={onPilih} />
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

/** Esc menutup; fokus pindah ke dalam lapisan (tombol [data-fokus-awal] atau yang pertama). */
function useLapisan(onTutup: () => void) {
    const ref = useRef<HTMLDivElement>(null)
    const tutup = useRef(onTutup)
    tutup.current = onTutup
    useEffect(() => {
        const sebelum = document.activeElement as HTMLElement | null
        const el = ref.current
        ;(el?.querySelector<HTMLElement>('[data-fokus-awal]') ?? el?.querySelector<HTMLElement>('button, [href], input, select, textarea'))?.focus()
        const esc = (e: KeyboardEvent) => e.key === 'Escape' && tutup.current()
        document.addEventListener('keydown', esc)

        return () => {
            document.removeEventListener('keydown', esc)
            sebelum?.focus?.()
        }
    }, [])

    return ref
}

function Dialog({ children, onTutup }: { children: React.ReactNode; onTutup: () => void }) {
    const ref = useLapisan(onTutup)

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-6" onClick={onTutup}>
            <div ref={ref} role="dialog" aria-modal aria-labelledby="judul-dialog" className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
                {children}
            </div>
        </div>
    )
}

/** Ukuran teks soal untuk HP: satu tombol "Aa" di kaki, pilihan muncul di atasnya. */
function UkuranTeks({ skala, onUbah }: { skala: number; onUbah: (s: number) => void }) {
    const [buka, setBuka] = useState(false)
    const PILIHAN = [
        { nilai: 0.85, label: 'Kecil', kelas: 'text-sm' },
        { nilai: 1, label: 'Normal', kelas: 'text-base' },
        { nilai: 1.15, label: 'Besar', kelas: 'text-lg' },
        { nilai: 1.3, label: 'Lebih besar', kelas: 'text-xl' },
    ]

    return (
        <div className="relative">
            <button
                type="button"
                aria-label="Ukuran teks soal"
                aria-expanded={buka}
                onClick={() => setBuka((v) => !v)}
                className="inline-flex size-11 items-center justify-center rounded-xl border-2 border-slate-200 bg-white font-display text-base font-bold text-slate-700 active:scale-95"
            >
                Aa
            </button>
            {buka && (
                <>
                    <div className="fixed inset-0 z-30" onClick={() => setBuka(false)} />
                    <div role="menu" aria-label="Ukuran teks" className="absolute bottom-14 left-0 z-40 w-44 animate-turun rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
                        {PILIHAN.map((p) => (
                            <button
                                key={p.nilai}
                                role="menuitemradio"
                                aria-checked={Math.abs(skala - p.nilai) < 0.01}
                                onClick={() => {
                                    onUbah(p.nilai)
                                    setBuka(false)
                                }}
                                className={cn(
                                    'flex min-h-11 w-full items-center justify-between rounded-md px-3 font-semibold',
                                    p.kelas,
                                    Math.abs(skala - p.nilai) < 0.01 ? 'bg-primary-50 text-primary-800' : 'text-slate-700 hover:bg-slate-50',
                                )}
                            >
                                {p.label}
                                {Math.abs(skala - p.nilai) < 0.01 && <Check className="size-4" />}
                            </button>
                        ))}
                    </div>
                </>
            )}
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
