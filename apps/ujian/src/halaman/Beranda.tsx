import { FotoMurid } from '@/komponen/FotoMurid'
import { IndikatorKoneksi } from '@/komponen/IndikatorKoneksi'
import { Lencana, type NadaLencana } from '@/komponen/Lencana'
import { SpanduOffline } from '@/komponen/SpanduOffline'
import { Tombol } from '@/komponen/Tombol'
import { api } from '@/lib/api'
import { sesi } from '@/lib/sesi'
import { durasiLengkap, hariTanggal, jamMenit, tanggalGanda, tanggalKunciWita } from '@/lib/tanggal'
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
    const hariIniWita = tanggalKunciWita(sekarang)

    for (const u of daftar) {
        const buka = Date.parse(u.dibuka_pada)
        const tutup = Date.parse(u.ditutup_pada)
        const hariBukaWita = tanggalKunciWita(u.dibuka_pada)

        if (u.status === 'selesai' || tutup < sekarang) {
            hasil.Riwayat.push(u)
        } else if (buka <= sekarang || hariBukaWita === hariIniWita) {
            hasil['Hari Ini'].push(u)
        } else {
            hasil.Mendatang.push(u)
        }
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

    // Hitung mundur realtime setiap 1 detik
    const [sekarang, setSekarang] = useState(Date.now())
    useEffect(() => {
        const t = setInterval(() => setSekarang(Date.now()), 1000)

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
            <header className="relative overflow-hidden rounded-b-[1.75rem] sm:rounded-b-[2.5rem] bg-gradient-to-br from-[#0B486F] via-[#006195] to-[#004B74] px-3.5 pt-4 pb-12 text-white shadow-lg sm:px-6 sm:pt-6 sm:pb-16">
                {/* Decorative Ambient Backgrounds */}
                <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-white/5 blur-3xl" aria-hidden="true" />
                <div className="pointer-events-none absolute -left-16 bottom-0 size-72 rounded-full bg-sky-400/10 blur-2xl" aria-hidden="true" />

                <div className="relative mx-auto max-w-3xl space-y-4 sm:space-y-5">
                    {/* Top Bar: Brand, Status, Actions */}
                    <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3 sm:pb-4">
                        <div className="flex items-center gap-2.5">
                            <img src="/brand/lockup-putih.png" alt="Al Akhyar" className="h-7 sm:h-9 w-auto drop-shadow-sm" />
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <IndikatorKoneksi online={online} tema="gelap" />

                            <button
                                className="inline-flex size-8 sm:size-9 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
                                aria-label="Segarkan data ujian"
                                title="Segarkan data"
                                onClick={() => ujian.refetch()}
                            >
                                <RefreshCw className={cn('size-3.5 sm:size-4', ujian.isFetching && 'animate-spin')} />
                            </button>

                            <button
                                className="inline-flex size-8 sm:size-9 items-center justify-center rounded-xl bg-white/10 text-white backdrop-blur-sm transition hover:bg-coral-500/80 hover:text-white active:scale-95"
                                aria-label="Keluar dari akun"
                                title="Keluar akun"
                                onClick={() => setModalKeluar(true)}
                            >
                                <LogOut className="size-3.5 sm:size-4" />
                            </button>
                        </div>
                    </div>

                    {/* Student Identity & Greeting */}
                    <div className="flex items-center justify-between gap-3 pt-0.5">
                        <div className="min-w-0 space-y-0.5 sm:space-y-1">
                            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] sm:text-xs font-semibold text-sky-100 backdrop-blur-md border border-white/15">
                                <Sparkles className="size-3 text-amber-300" />
                                <span>{tanggalGanda(new Date(sekarang))}</span>
                            </div>
                            <h1 className="font-display text-lg sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white drop-shadow-sm truncate">
                                {nama ? `Assalamu'alaikum, ${nama.split(' ')[0]}` : "Assalamu'alaikum"}
                            </h1>
                            <p className="text-[11px] sm:text-xs text-sky-100/80 truncate">
                                Pusat Ujian Digital (CBT) Al Akhyar
                            </p>
                        </div>

                        <div className="flex shrink-0 items-center gap-2 rounded-lg bg-white/10 p-1.5 sm:p-2.5 backdrop-blur-md border border-white/15">
                            <FotoMurid nama={murid?.nama ?? nama ?? 'Murid'} foto={murid?.foto} ukuran="sm" className="ring-2 ring-white/60 bg-white" />
                            <div className="hidden sm:block pr-1 text-left">
                                <p className="text-xs font-bold leading-tight text-white line-clamp-1">{murid?.nama ?? nama ?? 'Murid'}</p>
                                <p className="text-[10px] text-sky-200 mt-0.5">{nis ? `NIS: ${nis}` : 'Peserta Ujian'}</p>
                            </div>
                        </div>
                    </div>

                    {/* Quick Summary Stat Cards with Large Watermark Background */}
                    <div className="grid grid-cols-3 gap-2 sm:gap-3">
                        {[
                            { id: 'Hari Ini', label: 'Hari Ini', count: kelompok['Hari Ini'].length, icon: BookOpenCheck },
                            { id: 'Mendatang', label: 'Mendatang', count: kelompok.Mendatang.length, icon: CalendarClock },
                            { id: 'Riwayat', label: 'Selesai', count: kelompok.Riwayat.length, icon: Trophy },
                        ].map((item) => {
                            const aktif = tabAktif === item.id
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setTabAktif(item.id as KategoriTab)}
                                    className={cn(
                                        'group relative overflow-hidden rounded-lg p-2.5 sm:p-3.5 text-left transition-all backdrop-blur-md border select-none',
                                        aktif
                                            ? 'bg-white text-ink border-white shadow-md ring-2 ring-white/50'
                                            : 'bg-white/10 text-white border-white/15 hover:bg-white/15 active:scale-[0.98]',
                                    )}
                                >
                                    {/* Large Decorative Background Watermark Icon */}
                                    <item.icon
                                        className={cn(
                                            'pointer-events-none absolute -right-2 -bottom-2 sm:-right-1 sm:-bottom-1 size-12 sm:size-14 transition-transform duration-300 group-hover:scale-110',
                                            aktif ? 'text-primary/10' : 'text-white/[0.14]',
                                        )}
                                        aria-hidden="true"
                                    />

                                    <div className="relative z-10">
                                        <span className={cn('block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider', aktif ? 'text-primary' : 'text-sky-100/80')}>
                                            {item.label}
                                        </span>
                                        <p className="mt-1 text-xl sm:text-2xl font-black leading-none">{item.count}</p>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="relative z-10 -mt-5 sm:-mt-7 mx-auto max-w-3xl space-y-3.5 sm:space-y-4 px-3 sm:px-4">
                {/* Offline Warning Banner */}
                {(!online || ujian.data?.dariCache) && (
                    <SpanduOffline pada={ujian.data?.pada}>
                        Ujian yang sudah diunduh ke perangkat ini tetap dapat dikerjakan secara offline.
                    </SpanduOffline>
                )}

                {/* Full-width Balanced Filter Tabs Navigation */}
                <div className="grid grid-cols-4 gap-1 rounded-lg bg-white p-1 shadow-sm border border-slate-200/80">
                    {[
                        { id: 'Semua', label: 'Semua', count: daftarSemua.length },
                        { id: 'Hari Ini', label: 'Hari Ini', count: kelompok['Hari Ini'].length },
                        { id: 'Mendatang', label: 'Mendatang', count: kelompok.Mendatang.length },
                        { id: 'Riwayat', label: 'Selesai', count: kelompok.Riwayat.length },
                    ].map((tab) => {
                        const aktif = tabAktif === tab.id

                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setTabAktif(tab.id as KategoriTab)}
                                className={cn(
                                    'flex items-center justify-center gap-1 rounded-lg py-1.5 sm:py-2 text-[11px] sm:text-xs font-bold transition-all',
                                    aktif
                                        ? 'bg-primary text-white shadow-sm shadow-primary/20'
                                        : 'text-slate-600 hover:bg-slate-100/70 hover:text-ink',
                                )}
                            >
                                <span className="truncate">{tab.label}</span>
                                <span
                                    className={cn(
                                        'rounded-full px-1.5 py-0.5 text-[9px] sm:text-[10px] font-extrabold leading-none',
                                        aktif ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500',
                                    )}
                                >
                                    {tab.count}
                                </span>
                            </button>
                        )
                    })}
                </div>

                {/* Loading Skeleton */}
                {ujian.isPending && <Kerangka />}

                {/* Error Banner */}
                {ujian.isError && (
                    <div className="flex items-center justify-between rounded-lg border border-coral-200 bg-coral-50 p-3 text-xs sm:text-sm font-medium text-coral-700">
                        <span>{ujian.error.message}</span>
                        <Tombol varian="outline" ukuran="sm" onClick={() => ujian.refetch()}>
                            Coba lagi
                        </Tombol>
                    </div>
                )}

                {/* Exam List */}
                {!ujian.isPending && daftarFilter.length > 0 && (
                    <div className="space-y-3">
                        {daftarFilter.map((u) => (
                            <KartuUjian key={u.id} ujian={u} sekarang={sekarang} riwayat={tabAktif === 'Riwayat' || u.status === 'selesai'} />
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {!ujian.isPending && daftarFilter.length === 0 && (
                    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white py-10 px-4 text-center shadow-sm">
                        <div className="flex size-12 items-center justify-center rounded-lg bg-primary-50 text-primary mb-2.5">
                            <CalendarClock className="size-6" />
                        </div>
                        <h3 className="text-sm sm:text-base font-bold text-ink">Tidak ada ujian di tab ini</h3>
                        <p className="mt-1 max-w-sm text-xs text-slate-500">
                            {tabAktif === 'Hari Ini'
                                ? 'Tidak ada ujian yang dijadwalkan untuk hari ini. Silakan cek tab Mendatang atau Selesai.'
                                : 'Jadwal ujian yang ditetapkan guru akan tampil otomatis di sini.'}
                        </p>
                        {tabAktif !== 'Semua' && (
                            <button
                                type="button"
                                onClick={() => setTabAktif('Semua')}
                                className="mt-3 text-xs font-bold text-primary hover:underline"
                            >
                                Lihat semua jadwal ujian &rarr;
                            </button>
                        )}
                    </div>
                )}

                {/* Device & Security Guide Banner */}
                <Link
                    to="/panduan"
                    className="group flex items-center gap-3 rounded-lg border border-slate-200/90 bg-gradient-to-r from-sky-50/60 via-white to-white p-3 shadow-sm transition hover:border-primary/40 hover:shadow-md active:scale-[0.99]"
                >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-white shadow-sm transition-transform group-hover:scale-105">
                        <Smartphone className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block font-bold text-ink text-xs sm:text-sm group-hover:text-primary transition-colors">
                            Panduan Perangkat &amp; Kunci Layar
                        </span>
                        <span className="block text-[11px] text-slate-500 mt-0.5 line-clamp-1 sm:line-clamp-none">
                            Petunjuk instalasi aplikasi ujian, izin lokasi, dan mode aman proktor
                        </span>
                    </span>
                    <ChevronRight className="size-4 text-slate-400 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
            </main>

            {/* Modal Konfirmasi Keluar */}
            {modalKeluar && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
                    <div className="w-full max-w-sm space-y-4 rounded-lg bg-white p-5 sm:p-6 shadow-2xl border border-slate-100 animate-in zoom-in-95">
                        <div className="flex size-11 items-center justify-center rounded-full bg-coral-100 text-coral-600">
                            <LogOut className="size-5" />
                        </div>
                        <div>
                            <h3 className="text-base sm:text-lg font-bold text-ink">Keluar dari Akun?</h3>
                            <p className="mt-1 text-xs text-slate-500 leading-relaxed">
                                Pastikan Anda tidak sedang mengerjakan ujian aktif. Anda perlu memasukkan NIS dan kata sandi kembali untuk masuk.
                            </p>
                        </div>
                        <div className="flex items-center justify-end gap-2.5 pt-1">
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
                'group rounded-lg border bg-white p-3.5 sm:p-4.5 transition-all duration-200 shadow-sm hover:shadow-md',
                sedangDibuka && u.status !== 'selesai'
                    ? 'border-primary/40 ring-1 ring-primary/20 bg-gradient-to-br from-white via-white to-sky-50/30'
                    : 'border-slate-200/90 hover:border-slate-300',
            )}
        >
            {/* Top Row: Mapel & Security Badges + Status */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                    {sedangDibuka && u.status !== 'selesai' && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span>Berlangsung</span>
                        </span>
                    )}
                    {u.mapel && (
                        <span className="inline-flex items-center rounded-md bg-primary-50 px-2 py-0.5 text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wide text-primary">
                            {u.mapel}
                        </span>
                    )}
                    {u.level_keamanan === 'lockdown' && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                            <ShieldAlert className="size-2.5" />
                            <span>Lockdown</span>
                        </span>
                    )}
                    {u.level_keamanan === 'ketat' && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 border border-amber-200">
                            <Lock className="size-2.5" />
                            <span>Ketat</span>
                        </span>
                    )}
                </div>

                <Lencana nada={nada} className="shrink-0 text-[10px] sm:text-xs py-0.5 px-2">
                    {label}
                </Lencana>
            </div>

            {/* Exam Title */}
            <h3 className="mt-1.5 text-sm sm:text-base font-bold text-ink leading-snug group-hover:text-primary transition-colors line-clamp-2">
                {u.nama}
            </h3>

            {/* Meta Information List */}
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] sm:text-xs text-slate-500">
                <span className="inline-flex items-center gap-1">
                    <CalendarClock className="size-3 text-slate-400 shrink-0" />
                    <span>{hariTanggal(u.dibuka_pada)}, {jamMenit(u.dibuka_pada)}–{jamMenit(u.ditutup_pada)} WITA</span>
                </span>
                <span className="inline-flex items-center gap-1">
                    <Clock className="size-3 text-slate-400 shrink-0" />
                    <span>{durasi} Menit</span>
                </span>
                <span className="inline-flex items-center gap-1">
                    <ListChecks className="size-3 text-slate-400 shrink-0" />
                    <span>{u.jumlah_soal} Soal</span>
                </span>
                {u.sesi && (
                    <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3 text-slate-400 shrink-0" />
                        <span>
                            {u.sesi.nama}
                            {u.sesi.ruang ? ` · ${u.sesi.ruang}` : ''}
                        </span>
                    </span>
                )}
            </div>

            {/* Bottom Actions Area */}
            <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-2.5">
                <div className="min-w-0 text-xs">
                    {!riwayat && u.status !== 'selesai' && (
                        sekarang < buka ? (
                            <span className="inline-flex items-center gap-1.5 text-slate-600 truncate">
                                <span className="size-1.5 rounded-full bg-amber-400 shrink-0" />
                                <span>Dibuka <strong className="font-semibold text-primary">{durasiLengkap(buka - sekarang)}</strong></span>
                                <span className="text-slate-400 text-[11px] hidden xs:inline">({jamMenit(u.dibuka_pada)} WITA)</span>
                            </span>
                        ) : sedangDibuka ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 font-semibold truncate">
                                <span className="size-1.5 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                                <span>Sisa <strong className="font-bold text-emerald-800">{durasiLengkap(tutup - sekarang)}</strong></span>
                                <span className="text-slate-400 font-normal text-[11px]">(s/d {jamMenit(u.ditutup_pada)} WITA)</span>
                            </span>
                        ) : (
                            <span className="text-slate-400">Jadwal telah berakhir</span>
                        )
                    )}
                    {(riwayat || u.status === 'selesai') && (
                        <span className="text-slate-400">Ujian telah diselesaikan</span>
                    )}
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                    {u.hasil_tersedia && u.attempt_id && (
                        <Link
                            to="/hasil/$attemptId"
                            params={{ attemptId: u.attempt_id }}
                            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 transition hover:bg-amber-100 active:scale-95"
                        >
                            <Trophy className="size-3.5 text-amber-600" />
                            <span>Hasil</span>
                        </Link>
                    )}

                    {!riwayat && u.status !== 'selesai' && (
                        <Link
                            to="/ujian/$ujianId"
                            params={{ ujianId: u.id }}
                            className={cn(
                                'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-bold transition shadow-sm active:scale-95',
                                sedangDibuka
                                    ? 'bg-primary text-white hover:bg-primary-600 shadow-primary/20'
                                    : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
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
        <div className="space-y-3" aria-hidden>
            {[0, 1].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-lg bg-white border border-slate-100 p-3.5 shadow-sm space-y-2.5">
                    <div className="flex items-center justify-between">
                        <div className="h-4 w-20 rounded bg-slate-200" />
                        <div className="h-4 w-16 rounded-full bg-slate-100" />
                    </div>
                    <div className="h-5 w-3/4 rounded bg-slate-200" />
                    <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                        <div className="h-3 w-28 rounded bg-slate-100" />
                        <div className="h-7 w-20 rounded-lg bg-slate-200" />
                    </div>
                </div>
            ))}
        </div>
    )
}
