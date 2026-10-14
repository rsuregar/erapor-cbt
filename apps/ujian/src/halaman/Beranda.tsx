import { api } from '@/lib/api'
import { sesi } from '@/lib/sesi'
import { cn } from '@/lib/utils'
import type { UjianRingkas } from '@erapor-cbt/exam-core'
import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { CalendarClock, LogOut, RefreshCw } from 'lucide-react'

const LABEL_STATUS: Record<UjianRingkas['status'], string> = {
    belum_mulai: 'Belum mulai',
    mengerjakan: 'Sedang dikerjakan',
    terkunci: 'Terkunci',
    menunggu_sinkron: 'Menunggu sinkron',
    selesai: 'Selesai',
}

const jam = (iso: string) => new Date(iso).toLocaleString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

/** Daftar ujian murid: hari ini, mendatang, riwayat (PRD M-02). */
export default function Beranda() {
    const navigate = useNavigate()
    const ujian = useQuery({ queryKey: ['ujian'], queryFn: () => api.daftarUjian(), refetchInterval: 60_000 })

    const hariIni = new Date().toDateString()
    const kelompok = {
        'Hari ini': [] as UjianRingkas[],
        Mendatang: [] as UjianRingkas[],
        Riwayat: [] as UjianRingkas[],
    }
    for (const u of ujian.data ?? []) {
        if (u.status === 'selesai' || new Date(u.ditutup_pada) < new Date()) kelompok.Riwayat.push(u)
        else if (new Date(u.dibuka_pada).toDateString() === hariIni || new Date(u.dibuka_pada) <= new Date()) kelompok['Hari ini'].push(u)
        else kelompok.Mendatang.push(u)
    }

    return (
        <main className="mx-auto max-w-3xl space-y-6 p-4">
            <header className="flex items-center gap-3">
                <div className="mr-auto">
                    <h1 className="text-xl font-semibold">Ujian saya</h1>
                    {sesi.nama() && <p className="text-sm text-slate-500">{sesi.nama()}</p>}
                </div>
                <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" title="Muat ulang" onClick={() => ujian.refetch()}>
                    <RefreshCw className={cn('size-5', ujian.isFetching && 'animate-spin')} />
                </button>
                <button
                    className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                    title="Keluar"
                    onClick={async () => {
                        await api.keluar().catch(() => undefined)
                        await sesi.keluar()
                        await navigate({ to: '/masuk' })
                    }}
                >
                    <LogOut className="size-5" />
                </button>
            </header>

            {ujian.isPending && <p className="text-slate-500">Memuat…</p>}
            {ujian.isError && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{ujian.error.message}</p>}

            {Object.entries(kelompok).map(([judul, daftar]) =>
                daftar.length === 0 ? null : (
                    <section key={judul} className="space-y-2">
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{judul}</h2>
                        {daftar.map((u) => (
                            <article key={u.id} className="space-y-2 rounded-xl border border-slate-200 p-4">
                                <div className="flex flex-wrap items-start gap-2">
                                    <div className="mr-auto">
                                        <h3 className="font-semibold">{u.nama}</h3>
                                        <p className="text-sm text-slate-500">
                                            {u.mapel ?? '—'} · {u.jumlah_soal} soal · {u.durasi_menit + u.tambahan_waktu_menit} menit
                                        </p>
                                    </div>
                                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold">{LABEL_STATUS[u.status]}</span>
                                </div>
                                <p className="flex items-center gap-1.5 text-sm text-slate-600">
                                    <CalendarClock className="size-4" /> {jam(u.dibuka_pada)}
                                    {u.sesi ? ` · ${u.sesi.nama}${u.sesi.ruang ? `, ${u.sesi.ruang}` : ''}` : ''}
                                </p>
                                <div className="flex gap-2">
                                    {u.status !== 'selesai' && judul !== 'Riwayat' && (
                                        <Link to="/ujian/$ujianId" params={{ ujianId: u.id }} className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white">
                                            {u.status === 'mengerjakan' ? 'Lanjutkan' : 'Buka'}
                                        </Link>
                                    )}
                                    {u.hasil_tersedia && u.attempt_id && (
                                        <Link to="/hasil/$attemptId" params={{ attemptId: u.attempt_id }} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium">
                                            Lihat hasil
                                        </Link>
                                    )}
                                </div>
                            </article>
                        ))}
                    </section>
                ),
            )}
            {ujian.data?.length === 0 && <p className="rounded-xl border border-dashed p-8 text-center text-slate-500">Belum ada ujian.</p>}
        </main>
    )
}
