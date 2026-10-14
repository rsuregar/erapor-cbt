import { KepalaFitur } from '@/komponen/KepalaFitur'
import { Kartu } from '@/komponen/Kartu'
import { Lencana, type NadaLencana } from '@/komponen/Lencana'
import { SpanduOffline } from '@/komponen/SpanduOffline'
import { kelasTombol, Tombol } from '@/komponen/Tombol'
import { api } from '@/lib/api'
import { sesi } from '@/lib/sesi'
import { daftarUjian, penyimpanan } from '@/lib/ujian'
import { useOnline } from '@/lib/useOnline'
import { durasiSingkat, hariTanggal, jamMenit, tanggalGanda } from '@/lib/tanggal'
import { cn } from '@/lib/utils'
import type { UjianRingkas } from '@erapor-cbt/exam-core'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { BookOpenCheck, CalendarClock, ChevronRight, Smartphone, Clock, ListChecks, LogOut, MapPin, RefreshCw, Trophy } from 'lucide-react'
import { useEffect, useState } from 'react'

const STATUS: Record<UjianRingkas['status'], [string, NadaLencana]> = {
    belum_mulai: ['Belum dikerjakan', 'neutral'],
    mengerjakan: ['Sedang dikerjakan', 'amber'],
    terkunci: ['Terkunci', 'red'],
    menunggu_sinkron: ['Menunggu sinkron', 'sky'],
    selesai: ['Selesai', 'green'],
}

type Kelompok = 'Hari Ini' | 'Mendatang' | 'Riwayat'

function kelompokkan(daftar: UjianRingkas[], sekarang: number): Record<Kelompok, UjianRingkas[]> {
    const hasil: Record<Kelompok, UjianRingkas[]> = { 'Hari Ini': [], Mendatang: [], Riwayat: [] }
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

/** Daftar ujian murid: hari ini, mendatang, riwayat (PRD M-02). */
export default function Beranda() {
    const navigate = useNavigate()
    const online = useOnline()
    // networkMode always: offline tetap menjalankan queryFn, yang jatuh ke salinan lokal (bawaan Query menjedanya).
    const ujian = useQuery({ queryKey: ['ujian'], queryFn: daftarUjian, refetchInterval: 60_000, networkMode: 'always' })
    // Tersambung lagi: segarkan daftar.
    useEffect(() => {
        if (online) void ujian.refetch()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [online])
    const [sekarang, setSekarang] = useState(Date.now())
    useEffect(() => {
        const t = setInterval(() => setSekarang(Date.now()), 30_000)

        return () => clearInterval(t)
    }, [])
    const kelompok = kelompokkan(ujian.data?.data ?? [], sekarang)
    const nama = sesi.nama()

    return (
        <div className="min-h-full pb-10">
            <KepalaFitur
                judul={nama ? `Assalamu'alaikum, ${nama.split(' ')[0]}` : "Assalamu'alaikum"}
                subjudul={tanggalGanda(new Date(sekarang))}
                kanan={<img src="/brand/logogram.png" alt="" className="size-11 rounded-full bg-white p-0.5" />}
            >
                <div className="flex items-center gap-2">
                    <div className="mr-auto flex items-center gap-2 text-sm font-semibold">
                        <BookOpenCheck className="size-5" /> Ujian saya
                    </div>
                    <button
                        className="inline-flex size-9 items-center justify-center rounded-sm bg-white/15 active:scale-95"
                        aria-label="Muat ulang"
                        onClick={() => ujian.refetch()}
                    >
                        <RefreshCw className={cn('size-[18px]', ujian.isFetching && 'animate-spin')} />
                    </button>
                    <button
                        className="inline-flex size-9 items-center justify-center rounded-sm bg-white/15 active:scale-95"
                        aria-label="Keluar"
                        onClick={async () => {
                            await api.keluar().catch(() => undefined)
                            await penyimpanan.hapus(`daftar-ujian:${sesi.uuid()}`)
                            await sesi.keluar()
                            await navigate({ to: '/masuk' })
                        }}
                    >
                        <LogOut className="size-[18px]" />
                    </button>
                </div>
            </KepalaFitur>

            <main className="mx-auto max-w-3xl space-y-6 px-4 pt-5">
                {(!online || ujian.data?.dariCache) && (
                    <SpanduOffline pada={ujian.data?.pada}>Ujian yang sudah kamu mulai di perangkat ini tetap bisa dilanjutkan.</SpanduOffline>
                )}
                {ujian.isPending && <Kerangka />}
                {ujian.isError && (
                    <Kartu className="border-coral-100 bg-coral-100 text-sm font-medium text-coral-600">
                        {ujian.error.message}
                        <Tombol varian="outline" ukuran="sm" className="ml-3" onClick={() => ujian.refetch()}>
                            Coba lagi
                        </Tombol>
                    </Kartu>
                )}

                {(Object.keys(kelompok) as Kelompok[]).map((judul) =>
                    kelompok[judul].length === 0 ? null : (
                        <section key={judul} className="space-y-3">
                            <h2 className="text-title">{judul}</h2>
                            {kelompok[judul].map((u) => (
                                <KartuUjian key={u.id} ujian={u} sekarang={sekarang} riwayat={judul === 'Riwayat'} />
                            ))}
                        </section>
                    ),
                )}

                {ujian.data?.data.length === 0 && (
                    <Kartu nada="sunken" className="flex flex-col items-center gap-2 py-10 text-center">
                        <CalendarClock className="size-10 text-primary-300" />
                        <p className="font-semibold text-ink">Belum ada ujian</p>
                        <p className="text-sm text-slate-500">Ujian yang dijadwalkan guru akan muncul di sini.</p>
                    </Kartu>
                )}

                <Link to="/panduan" className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition active:scale-[0.99]">
                    <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-primary-50 text-primary">
                        <Smartphone className="size-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                        <span className="block font-bold text-ink">Panduan perangkat</span>
                        <span className="block text-sm text-slate-500">Pasang aplikasi ujian & kunci layar bersama pengawas</span>
                    </span>
                    <ChevronRight className="size-5 text-slate-400" />
                </Link>
            </main>
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
        <Kartu className={cn('space-y-3', sedangDibuka && u.status !== 'selesai' && 'border-primary-200 ring-1 ring-primary-100')}>
            <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                    {u.mapel && <p className="text-xs font-bold uppercase tracking-caps text-primary">{u.mapel}</p>}
                    <h3 className="mt-0.5 text-body-lg font-bold text-ink">{u.nama}</h3>
                </div>
                <Lencana nada={nada}>{label}</Lencana>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                    <CalendarClock className="size-4" /> {hariTanggal(u.dibuka_pada)}, {jamMenit(u.dibuka_pada)}–{jamMenit(u.ditutup_pada)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <Clock className="size-4" /> {durasi} menit
                </span>
                <span className="inline-flex items-center gap-1.5">
                    <ListChecks className="size-4" /> {u.jumlah_soal} soal
                </span>
                {u.sesi && (
                    <span className="inline-flex items-center gap-1.5">
                        <MapPin className="size-4" /> {u.sesi.nama}
                        {u.sesi.ruang ? ` · ${u.sesi.ruang}` : ''}
                    </span>
                )}
            </div>

            {!riwayat && u.status !== 'selesai' && (
                <div className="flex flex-wrap items-center gap-3 border-t border-dashed border-slate-200 pt-3">
                    <p className="mr-auto text-sm font-medium">
                        {sekarang < buka ? (
                            <span className="text-slate-700">
                                Dibuka dalam <span className="font-bold text-primary">{durasiSingkat(buka - sekarang)}</span>
                            </span>
                        ) : (
                            <span className="text-green-600">Sedang dibuka · tutup {jamMenit(u.ditutup_pada)}</span>
                        )}
                    </p>
                    <Link to="/ujian/$ujianId" params={{ ujianId: u.id }} className={kelasTombol(sedangDibuka ? 'primary' : 'secondary', 'sm')}>
                        {u.status === 'mengerjakan' ? 'Lanjutkan' : sedangDibuka ? 'Mulai' : 'Persiapan'}
                    </Link>
                </div>
            )}

            {u.hasil_tersedia && u.attempt_id && (
                <div className="border-t border-dashed border-slate-200 pt-3">
                    <Link to="/hasil/$attemptId" params={{ attemptId: u.attempt_id }} className={kelasTombol('outline', 'sm')}>
                        <Trophy className="size-4" /> Lihat hasil
                    </Link>
                </div>
            )}
        </Kartu>
    )
}

function Kerangka() {
    return (
        <div className="space-y-3" aria-hidden>
            {[0, 1].map((i) => (
                <div key={i} className="h-36 animate-pulse rounded-lg bg-white shadow-sm" />
            ))}
        </div>
    )
}
