import { FotoMurid } from '@/komponen/FotoMurid'
import { IndikatorKoneksi } from '@/komponen/IndikatorKoneksi'
import { Lencana, type NadaLencana } from '@/komponen/Lencana'
import { SpanduOffline } from '@/komponen/SpanduOffline'
import { kelasTombol, Tombol } from '@/komponen/Tombol'
import { api } from '@/lib/api'
import { sesi } from '@/lib/sesi'
import { durasiSingkat, hariTanggal, jamMenit, tanggalGanda } from '@/lib/tanggal'
import { daftarUjian, penyimpanan } from '@/lib/ujian'
import { useOnline } from '@/lib/useOnline'
import { cn } from '@/lib/utils'
import type { UjianRingkas } from '@erapor-cbt/exam-core'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
    ArrowRight,
    BookOpenCheck,
    CalendarClock,
    ChevronRight,
    Clock,
    ListChecks,
    Lock,
    LogOut,
    MapPin,
    RefreshCw,
    ShieldAlert,
    Smartphone,
    Sparkles,
    Trophy,
} from 'lucide-react'
import { useEffect, useState } from 'react'

const STATUS: Record<UjianRingkas['status'], [string, NadaLencana]> = {
    belum_mulai: ['Belum dikerjakan', 'neutral'],
    mengerjakan: ['Sedang dikerjakan', 'amber'],
    terkunci: ['Terkunci', 'red'],
    menunggu_sinkron: ['Menunggu sinkron', 'sky'],
    selesai: ['Selesai', 'green'],
}

type KategoriTab = 'Semua' | 'Hari Ini' | 'Mendatang' | 'Riwayat'

function kelompokkan(daftar: UjianRingkas[], sekarang: number): Record<'Hari Ini' | 'Mendatang' | 'Riwayat', UjianRingkas[]> {
    const hasil: Record<'Hari Ini' | 'Mendatang' | 'Riwayat', UjianRingkas[]> = { 'Hari Ini': [], Mendatang: [], Riwayat: [] }
    const hariIni = new Date(sekarang).toDateString()
    for (const u of daftar) {
        const buka = Date.parse(u.dibuka_pada)
        if (u.status === 'selesai' || Date.parse(u.ditutup_pada) < sekarang) hasil.Riwayat.push(u)
        else if (buka <= sekarang || new Date(buka).toDateString() === hariIni) hasil['Hari Ini'].push(u)
        else hasil.Mendatang.push(u)
    }
    hasil.Riwayat.reverse()

    return hasil
}

/** Dashboard utama ujian murid (PRD M-02). */
export default function Beranda() {
    const navigate = useNavigate()
    const online = useOnline()
    const [tabAktif, setTabAktif] = useState<KategoriTab>('Semua')
    const [modalKeluar, setModalKeluar] = useState(false)
    const [prosesKeluar, setProsesKeluar] = useState(false)

    // networkMode always: offline tetap menjalankan queryFn, yang jatuh ke salinan lokal
    const ujian = useQuery({
        queryKey: ['ujian'],
        queryFn: daftarUjian,
        refetchInterval: 60_000,
        networkMode: 'always',
    })

    // Tersambung lagi: segarkan daftar
    useEffect(() => {
        if (online) void ujian.refetch()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [online])

    const [sekarang, setSekarang] = useState(Date.now())
    useEffect(() => {
        const t = setInterval(() => setSekarang(Date.now()), 15_000)

        return () => clearInterval(t)
    }, [])

    const daftarSemua = ujian.data?.data ?? []
    const kelompok = kelompokkan(daftarSemua, sekarang)
    const nama = sesi.nama()
    const nis = sesi.nis()
    const murid = daftarSemua[0]?.murid

    const daftarFilter =
        tabAktif === 'Semua'
            ? daftarSemua
            : tabAktif === 'Hari Ini'
              ? kelompok['Hari Ini']
              : tabAktif === 'Mendatang'
                ? kelompok.Mendatang
                : kelompok.Riwayat

    const tanganiKeluar = async () => {
        setProsesKeluar(true)
        try {
            await api.keluar().catch(() => undefined)
            await penyimpanan.hapus(`daftar-ujian:${sesi.uuid()}`)
            await sesi.keluar()
            await navigate({ to: '/masuk' })
        } finally {
            setProsesKeluar(false)
        }
    }

    return (
        <div className="min-h-full bg-slate-50/70 pb-16">
            {/* Header / Hero Section */}
            <header className="relative overflow-hidden rounded-b-[2rem] sm:rounded-b-[2.5rem] bg-gradient-to-br from-[#0B486F] via-[#006195] to-[#004B74] px-4 pt-6 pb-20 text-white shadow-lg sm:px-6">
                {/* Decorative Ambient Backgrounds */}
                <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-white/5 blur-3xl" aria-hidden="true" />
                <div className="pointer-events-none absolute -left-16 bottom-0 size-72 rounded-full bg-sky-400/10 blur-2xl" aria-hidden="true" />

                <div className="relative mx-auto max-w-3xl space-y-6">
                    {/* Top Bar: Brand, Status, Actions */}
                    <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
                        <div className="flex items-center gap-3">
                            <img src="/brand/lockup-putih.png" alt="Al Akhyar" className="h-8 sm:h-9 w-auto drop-shadow-sm" />
                        </div>

                        <div className="flex items-center gap-2">
                            <IndikatorKoneksi online={online} tema="gelap" />

                            <button
                                className="inline-flex size-9 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
                                aria-label="Segarkan data ujian"
                                title="Segarkan data"
                                onClick={() => ujian.refetch()}
                            >
                                <RefreshCw className={cn('size-4', ujian.isFetching && 'animate-spin')} />
                            </button>

                            <button
                                className="inline-flex size-9 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-sm transition hover:bg-coral-500/80 hover:text-white active:scale-95"
                                aria-label="Keluar dari akun"
                                title="Keluar akun"
                                onClick={() => setModalKeluar(true)}
                            >
                                <LogOut className="size-4" />
                            </button>
                        </div>
                    </div>

                    {/* Student Identity Card */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
                        <div className="space-y-1">
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-sky-100 backdrop-blur-md border border-white/15">
                                <Sparkles className="size-3.5 text-amber-300" />
                                <span>{tanggalGanda(new Date(sekarang))}</span>
                            </div>
                            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm">
                                {nama ? `Assalamu'alaikum, ${nama.split(' ')[0]}` : "Assalamu'alaikum"}
                            </h1>
                            <p className="text-xs sm:text-sm text-sky-100/85">
                                Selamat datang di Pusat Ujian Digital (CBT) Al Akhyar
                            </p>
                        </div>

                        <div className="flex items-center gap-3 rounded-2xl bg-white/10 p-2.5 backdrop-blur-md border border-white/15 self-start sm:self-auto">
                            <FotoMurid nama={murid?.nama ?? nama ?? 'Murid'} foto={murid?.foto} ukuran="md" className="ring-2 ring-white/60 bg-white" />
                            <div className="pr-2">
                                <p className="text-sm font-bold leading-tight text-white line-clamp-1">{murid?.nama ?? nama ?? 'Murid'}</p>
                                <p className="text-xs text-sky-200 mt-0.5">{nis ? `NIS: ${nis}` : 'Peserta Ujian'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Summary Stat Cards */}
                    <div className="grid grid-cols-3 gap-2.5 sm:gap-3 pt-2">
                        <button
                            type="button"
                            onClick={() => setTabAktif('Hari Ini')}
                            className={cn(
                                'rounded-xl p-3 text-left transition-all backdrop-blur-md border',
                                tabAktif === 'Hari Ini'
                                    ? 'bg-white text-ink border-white shadow-md'
                                    : 'bg-white/10 text-white border-white/15 hover:bg-white/15',
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Hari Ini</span>
                                <BookOpenCheck className={cn('size-4', tabAktif === 'Hari Ini' ? 'text-primary' : 'text-sky-200')} />
                            </div>
                            <p className="mt-1 text-xl sm:text-2xl font-extrabold">{kelompok['Hari Ini'].length}</p>
                        </button>

                        <button
                            type="button"
                            onClick={() => setTabAktif('Mendatang')}
                            className={cn(
                                'rounded-xl p-3 text-left transition-all backdrop-blur-md border',
                                tabAktif === 'Mendatang'
                                    ? 'bg-white text-ink border-white shadow-md'
                                    : 'bg-white/10 text-white border-white/15 hover:bg-white/15',
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Mendatang</span>
                                <CalendarClock className={cn('size-4', tabAktif === 'Mendatang' ? 'text-primary' : 'text-sky-200')} />
                            </div>
                            <p className="mt-1 text-xl sm:text-2xl font-extrabold">{kelompok.Mendatang.length}</p>
                        </button>

                        <button
                            type="button"
                            onClick={() => setTabAktif('Riwayat')}
                            className={cn(
                                'rounded-xl p-3 text-left transition-all backdrop-blur-md border',
                                tabAktif === 'Riwayat'
                                    ? 'bg-white text-ink border-white shadow-md'
                                    : 'bg-white/10 text-white border-white/15 hover:bg-white/15',
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-semibold uppercase tracking-wider opacity-80">Selesai</span>
                                <Trophy className={cn('size-4', tabAktif === 'Riwayat' ? 'text-amber-500' : 'text-amber-200')} />
                            </div>
                            <p className="mt-1 text-xl sm:text-2xl font-extrabold">{kelompok.Riwayat.length}</p>
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="relative z-10 -mt-10 mx-auto max-w-3xl space-y-6 px-4">
                {/* Offline Warning Banner */}
                {(!online || ujian.data?.dariCache) && (
                    <SpanduOffline pada={ujian.data?.pada}>
                        Ujian yang sudah diunduh ke perangkat ini tetap dapat dikerjakan secara offline.
                    </SpanduOffline>
                )}

                {/* Filter Tabs Navigation */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                    {(['Semua', 'Hari Ini', 'Mendatang', 'Riwayat'] as KategoriTab[]).map((tab) => {
                        const jumlah =
                            tab === 'Semua'
                                ? daftarSemua.length
                                : tab === 'Hari Ini'
                                  ? kelompok['Hari Ini'].length
                                  : tab === 'Mendatang'
                                    ? kelompok.Mendatang.length
                                    : kelompok.Riwayat.length

                        const aktif = tabAktif === tab

                        return (
                            <button
                                key={tab}
                                type="button"
                                onClick={() => setTabAktif(tab)}
                                className={cn(
                                    'inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all shadow-sm',
                                    aktif
                                        ? 'bg-primary text-white shadow-primary/20'
                                        : 'bg-white text-slate-600 hover:bg-slate-100 hover:text-ink border border-slate-200/80',
                                )}
                            >
                                <span>{tab}</span>
                                <span
                                    className={cn(
                                        'rounded-full px-1.5 py-0.5 text-[10px] font-extrabold',
                                        aktif ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                                    )}
                                >
                                    {jumlah}
                                </span>
                            </button>
                        )
                    })}
                </div>

                {/* Loading Skeleton */}
                {ujian.isPending && <Kerangka />}

                {/* Error Banner */}
                {ujian.isError && (
                    <div className="flex items-center justify-between rounded-2xl border border-coral-200 bg-coral-50 p-4 text-sm font-medium text-coral-700">
                        <span>{ujian.error.message}</span>
                        <Tombol varian="outline" ukuran="sm" onClick={() => ujian.refetch()}>
                            Coba lagi
                        </Tombol>
                    </div>
                )}

                {/* Exam List */}
                {!ujian.isPending && daftarFilter.length > 0 && (
                    <div className="space-y-4">
                        {daftarFilter.map((u) => (
                            <KartuUjian key={u.id} ujian={u} sekarang={sekarang} riwayat={tabAktif === 'Riwayat' || u.status === 'selesai'} />
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!ujian.isPending && daftarFilter.length === 0 && (
                    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white py-12 px-4 text-center shadow-sm">
                        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary-50 text-primary mb-3">
                            <CalendarClock className="size-7" />
                        </div>
                        <h3 className="text-base font-bold text-ink">Tidak ada ujian di tab ini</h3>
                        <p className="mt-1 max-w-sm text-xs text-slate-500">
                            {tabAktif === 'Hari Ini'
                                ? 'Tidak ada ujian yang dijadwalkan untuk hari ini. Silakan cek tab Mendatang atau Riwayat.'
                                : 'Jadwal ujian yang ditetapkan guru akan tampil otomatis di sini.'}
                        </p>
                        {tabAktif !== 'Semua' && (
                            <button
                                type="button"
                                onClick={() => setTabAktif('Semua')}
                                className="mt-4 text-xs font-bold text-primary hover:underline"
                            >
                                Lihat semua jadwal ujian &rarr;
                            </button>
                        )}
                    </div>
                )}

                {/* Device & Security Guide Banner */}
                <Link
                    to="/panduan"
                    className="group flex items-center gap-4 rounded-2xl border border-slate-200/90 bg-gradient-to-r from-sky-50/70 via-white to-white p-4 sm:p-5 shadow-sm transition hover:border-primary/40 hover:shadow-md active:scale-[0.99]"
                >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-sm transition-transform group-hover:scale-105">
                        <Smartphone className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block font-bold text-ink text-sm sm:text-base group-hover:text-primary transition-colors">
                            Panduan Perangkat &amp; Kunci Layar
                        </span>
                        <span className="block text-xs text-slate-500 mt-0.5">
                            Petunjuk instalasi aplikasi ujian, izin lokasi, dan mode aman bersama proktor
                        </span>
                    </span>
                    <ChevronRight className="size-5 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
            </main>

            {/* Modal Konfirmasi Keluar */}
            {modalKeluar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95">
                        <div className="flex size-12 items-center justify-center rounded-full bg-coral-100 text-coral-600">
                            <LogOut className="size-6" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-ink">Keluar dari Akun?</h3>
                            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                                Pastikan Anda tidak sedang mengerjakan ujian aktif. Anda perlu memasukkan NIS dan kata sandi kembali untuk masuk.
                            </p>
                        </div>
                        <div className="flex items-center justify-end gap-2.5 pt-2">
                            <Tombol varian="outline" ukuran="sm" onClick={() => setModalKeluar(false)} disabled={prosesKeluar}>
                                Batal
                            </Tombol>
                            <Tombol varian="danger" ukuran="sm" onClick={tanganiKeluar} disabled={prosesKeluar}>
                                {prosesKeluar ? 'Memproses…' : 'Ya, Keluar'}
                            </Tombol>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

function KartuUjian({ ujian: u, sekarang, riwayat }: { ujian: UjianRingkas; sekarang: number; riwayat: boolean }) {
    const [label, nada] = STATUS[u.status]
    const buka = Date.parse(u.dibuka_pada)
    const tutup = Date.parse(u.ditutup_pada)
    const sedangDibuka = buka <= sekarang && sekarang <= tutup
    const durasi = u.durasi_menit + u.tambahan_waktu_menit

    return (
        <div
            className={cn(
                'group rounded-2xl border bg-white p-5 sm:p-6 transition-all duration-200 shadow-sm hover:shadow-md',
                sedangDibuka && u.status !== 'selesai'
                    ? 'border-primary-300 ring-2 ring-primary/15 bg-gradient-to-br from-white via-white to-sky-50/40 shadow-primary/5'
                    : 'border-slate-200/90 hover:border-slate-300',
            )}
        >
            {/* Live Indicator Ribbon (if ongoing) */}
            {sedangDibuka && u.status !== 'selesai' && (
                <div className="mb-3.5 flex items-center justify-between border-b border-sky-100 pb-2.5">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700">
                        <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                        <span className="size-2 rounded-full bg-emerald-500 -ml-3.5" />
                        <span>Sedang Berlangsung</span>
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                        Tutup pukul {jamMenit(u.ditutup_pada)}
                    </span>
                </div>
            )}

            {/* Header: Mapel, Security Badge, Status */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                        {u.mapel && (
                            <span className="inline-flex items-center rounded-md bg-primary-50 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-primary">
                                {u.mapel}
                            </span>
                        )}
                        {u.level_keamanan === 'lockdown' && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                                <ShieldAlert className="size-3" />
                                <span>Lockdown</span>
                            </span>
                        )}
                        {u.level_keamanan === 'ketat' && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                                <Lock className="size-3" />
                                <span>Ketat</span>
                            </span>
                        )}
                    </div>
                    <h3 className="text-base sm:text-lg font-bold text-ink leading-snug group-hover:text-primary transition-colors">
                        {u.nama}
                    </h3>
                </div>

                <Lencana nada={nada} className="shrink-0 text-xs">
                    {label}
                </Lencana>
            </div>

            {/* Meta Information Grid */}
            <div className="mt-3.5 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-x-5 sm:gap-y-2 text-xs text-slate-500 border-y border-slate-100 py-3">
                <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="size-3.5 text-slate-400 shrink-0" />
                    <span>{hariTanggal(u.dibuka_pada)}, {jamMenit(u.dibuka_pada)}–{jamMenit(u.ditutup_pada)}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-3.5 text-slate-400 shrink-0" />
                    <span>{durasi} Menit</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <ListChecks className="size-3.5 text-slate-400 shrink-0" />
                    <span>{u.jumlah_soal} Soal</span>
                </span>
                {u.sesi && (
                    <span className="inline-flex items-center gap-1.5 col-span-2 sm:col-span-1">
                        <MapPin className="size-3.5 text-slate-400 shrink-0" />
                        <span>
                            {u.sesi.nama}
                            {u.sesi.ruang ? ` · ${u.sesi.ruang}` : ''}
                        </span>
                    </span>
                )}
            </div>

            {/* Bottom Actions Area */}
            <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs font-medium">
                    {!riwayat && u.status !== 'selesai' && (
                        sekarang < buka ? (
                            <span className="inline-flex items-center gap-1.5 text-slate-600">
                                <span className="size-1.5 rounded-full bg-amber-400" />
                                Dibuka dalam <span className="font-bold text-primary">{durasiSingkat(buka - sekarang)}</span>
                            </span>
                        ) : sedangDibuka ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold">
                                <span className="size-1.5 rounded-full bg-emerald-500" />
                                Waktu tersisa hingga {jamMenit(u.ditutup_pada)}
                            </span>
                        ) : (
                            <span className="text-slate-400">Jadwal pengerjaan telah berakhir</span>
                        )
                    )}
                    {(riwayat || u.status === 'selesai') && (
                        <span className="text-slate-400">Ujian telah diselesaikan</span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {u.hasil_tersedia && u.attempt_id && (
                        <Link
                            to="/hasil/$attemptId"
                            params={{ attemptId: u.attempt_id }}
                            className={kelasTombol('outline', 'sm')}
                        >
                            <Trophy className="size-3.5 text-amber-500" />
                            <span>Lihat Hasil</span>
                        </Link>
                    )}

                    {!riwayat && u.status !== 'selesai' && (
                        <Link
                            to="/ujian/$ujianId"
                            params={{ ujianId: u.id }}
                            className={cn(
                                kelasTombol(sedangDibuka ? 'primary' : 'outline', 'sm'),
                                'gap-1.5 font-bold',
                            )}
                        >
                            <span>
                                {u.status === 'mengerjakan'
                                    ? 'Lanjutkan Ujian'
                                    : sedangDibuka
                                      ? 'Mulai Ujian'
                                      : 'Persiapan Ujian'}
                            </span>
                            <ArrowRight className="size-3.5 opacity-80" />
                        </Link>
                    )}
                </div>
            </div>
        </div>
    )
}

function Kerangka() {
    return (
        <div className="space-y-4" aria-hidden>
            {[0, 1].map((i) => (
                <div key={i} className="h-44 animate-pulse rounded-2xl bg-white border border-slate-100 p-6 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="h-5 w-24 rounded bg-slate-200" />
                        <div className="h-5 w-20 rounded-full bg-slate-100" />
                    </div>
                    <div className="h-6 w-3/4 rounded bg-slate-200" />
                    <div className="h-10 border-y border-slate-100 my-2" />
                    <div className="flex justify-between items-center pt-1">
                        <div className="h-4 w-32 rounded bg-slate-100" />
                        <div className="h-8 w-24 rounded-lg bg-slate-200" />
                    </div>
                </div>
            ))}
        </div>
    )
}
