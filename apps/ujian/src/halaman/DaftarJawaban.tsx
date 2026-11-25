import { Tombol } from '@/komponen/Tombol'
import { api } from '@/lib/api'
import { ambilArsipJawaban, type ArsipJawaban, type ButirArsip } from '@/lib/arsipJawaban'
import { hariTanggal, jamMenit } from '@/lib/tanggal'
import { cn } from '@/lib/utils'
import { GalatApi, type ButirJawabanServer } from '@erapor-cbt/exam-core'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
    AlertTriangle,
    Bookmark,
    CheckCircle2,
    ChevronLeft,
    Cloud,
    CloudOff,
    FileCheck2,
    Loader2,
    RefreshCw,
    Smartphone,
} from 'lucide-react'
import { useMemo, useState } from 'react'

type StatusBanding = 'cocok' | 'hanya_client' | 'berbeda' | 'ditolak' | 'hanya_satu_sisi'

type BarisJawaban = {
    nomor: number
    soalId: number
    jenis: string
    client: ButirArsip | null
    server: ButirJawabanServer | null
    ditolakAlasan: string | null
    status: StatusBanding
}

const ALASAN_DITOLAK: Record<string, string> = {
    LEWAT_WAKTU: 'Lewat batas waktu',
    FORMAT_JAWABAN: 'Format jawaban tidak sah',
    SOAL_TIDAK_DIKENAL: 'Soal tidak dikenali',
}

function pesanGalatServer(e: unknown): { pesan: string; bisaCobaLagi: boolean } {
    if (e instanceof GalatApi && e.kode === 'BELUM_SELESAI') {
        return {
            pesan: 'Ujian ini masih aktif / belum dikumpulkan di server. Jawaban baru tercatat lengkap setelah dikumpulkan.',
            bisaCobaLagi: true,
        }
    }
    if (e instanceof GalatApi && e.sementara) {
        return {
            pesan: 'Tidak tersambung ke server. Data perangkat tetap tampil bila tersedia; sambungkan internet lalu muat ulang.',
            bisaCobaLagi: true,
        }
    }
    if (e instanceof GalatApi) {
        return { pesan: e.message, bisaCobaLagi: false }
    }
    return { pesan: 'Gagal memuat bukti jawaban dari server.', bisaCobaLagi: true }
}

function gabungButir(arsip: ArsipJawaban | null | undefined, serverButir: ButirJawabanServer[] | undefined): BarisJawaban[] {
    const mapClient = new Map((arsip?.butir ?? []).map((b) => [b.soalId, b]))
    const mapServer = new Map((serverButir ?? []).map((b) => [b.soal_id, b]))
    const urutanIds: number[] = []
    const terlihat = new Set<number>()

    for (const s of serverButir ?? []) {
        if (!terlihat.has(s.soal_id)) {
            terlihat.add(s.soal_id)
            urutanIds.push(s.soal_id)
        }
    }
    for (const c of arsip?.butir ?? []) {
        if (!terlihat.has(c.soalId)) {
            terlihat.add(c.soalId)
            urutanIds.push(c.soalId)
        }
    }

    const baris = urutanIds.map((soalId): BarisJawaban => {
        const client = mapClient.get(soalId) ?? null
        const server = mapServer.get(soalId) ?? null
        const ditolakAlasan = arsip?.ditolak[String(soalId)] ?? null

        let status: StatusBanding = 'hanya_satu_sisi'
        if (client && server) {
            if (ditolakAlasan) {
                status = 'ditolak'
            } else if (client.terjawab && !server.terjawab) {
                status = 'hanya_client'
            } else if (client.terjawab === server.terjawab && (client.ringkasan ?? null) === (server.ringkasan ?? null)) {
                status = 'cocok'
            } else {
                status = 'berbeda'
            }
        } else if (ditolakAlasan) {
            status = 'ditolak'
        }

        return {
            nomor: server?.nomor ?? client?.nomor ?? 0,
            soalId,
            jenis: String(server?.jenis ?? client?.jenis ?? ''),
            client,
            server,
            ditolakAlasan,
            status,
        }
    })

    return baris.sort((a, b) => a.nomor - b.nomor)
}

/**
 * Halaman Bukti Jawaban 2 Sisi (Perangkat/Client vs Server).
 * Tersedia segera setelah ujian dikumpulkan, bahkan sebelum nilai dirilis guru.
 */
export default function DaftarJawaban({ attemptId }: { attemptId: number }) {
    const navigate = useNavigate()
    const [filter, setFilter] = useState<'semua' | 'berbeda' | 'terjawab' | 'kosong'>('semua')

    const serverQuery = useQuery({
        queryKey: ['jawaban-attempt', attemptId],
        queryFn: () => api.jawabanAttempt(attemptId),
        retry: false,
    })
    const arsipQuery = useQuery({
        queryKey: ['arsip-jawaban', attemptId],
        queryFn: () => ambilArsipJawaban(attemptId),
        networkMode: 'always',
    })

    const server = serverQuery.data
    const arsip = arsipQuery.data
    const namaUjian = server?.ujian.nama ?? arsip?.namaUjian ?? 'Bukti Jawaban Ujian'
    const mapel = server?.ujian.mapel ?? arsip?.mapel ?? null

    const baris = useMemo(() => gabungButir(arsip, server?.butir), [arsip, server?.butir])
    const jumlahSelisih = useMemo(
        () => baris.filter((b) => b.status === 'hanya_client' || b.status === 'berbeda' || b.status === 'ditolak').length,
        [baris],
    )
    const adaPerbedaanTotal = Boolean(server && arsip && (server.jumlah_terjawab !== arsip.jumlahTerjawab || jumlahSelisih > 0))

    const barisTampil = useMemo(() => {
        if (filter === 'berbeda') {
            return baris.filter((b) => b.status === 'hanya_client' || b.status === 'berbeda' || b.status === 'ditolak')
        }
        if (filter === 'terjawab') {
            return baris.filter((b) => Boolean(b.server?.terjawab || b.client?.terjawab))
        }
        if (filter === 'kosong') {
            return baris.filter((b) => !b.server?.terjawab && !b.client?.terjawab)
        }
        return baris
    }, [baris, filter])

    const galatServer = serverQuery.isError ? pesanGalatServer(serverQuery.error) : null

    if (serverQuery.isPending && arsipQuery.isPending) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
                <Loader2 className="size-8 animate-spin text-primary" />
                <p className="mt-3 text-sm font-semibold text-slate-600">Memuat bukti jawaban…</p>
            </div>
        )
    }

    return (
        <div className="min-h-full bg-slate-50/70 pb-12">
            <header className="permukaan-gelap relative overflow-hidden rounded-b-[1.75rem] bg-gradient-to-br from-[#0B486F] via-[#006195] to-[#004B74] px-4 pb-10 pt-3 text-white shadow-lg sm:rounded-b-[2.5rem] sm:px-6">
                <div className="relative mx-auto max-w-3xl space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={() => navigate({ to: '/' })}
                            className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-95"
                        >
                            <ChevronLeft className="size-5" />
                            <span>Beranda</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => void serverQuery.refetch()}
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/20 active:scale-95"
                        >
                            <RefreshCw className={cn('size-3.5', serverQuery.isFetching && 'animate-spin')} />
                            <span>Muat Ulang Server</span>
                        </button>
                    </div>
                    <div>
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-0.5 text-xs font-semibold text-sky-100">
                            <FileCheck2 className="size-3.5" />
                            <span>Bukti 2 Sisi · Perangkat &amp; Server</span>
                        </span>
                        <h1 className="mt-1.5 font-display text-xl font-extrabold tracking-tight text-white sm:text-2xl">{namaUjian}</h1>
                        {mapel && <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-sky-100">{mapel}</p>}
                    </div>
                </div>
            </header>

            <main className="relative z-10 -mt-6 mx-auto max-w-3xl space-y-4 px-3 sm:px-4">
                {/* Ringkasan 2 Sisi */}
                <section aria-label="Perbandingan jumlah jawaban" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                            <Smartphone className="size-4 text-primary" />
                            <span>Perangkat Ini (Client)</span>
                        </div>
                        {arsip ? (
                            <>
                                <p className="font-display text-2xl font-extrabold text-ink tabular-nums">
                                    {arsip.jumlahTerjawab} <span className="text-sm font-semibold text-slate-500">/ {arsip.totalSoal} terjawab</span>
                                </p>
                                <p className="text-xs text-slate-600">
                                    Arsip lokal aktif s.d. {hariTanggal(new Date(arsip.kadaluarsaPada).toISOString())}, pukul{' '}
                                    {jamMenit(new Date(arsip.kadaluarsaPada).toISOString(), true)} (±48 jam)
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-base font-bold text-slate-700">Tidak tersedia di perangkat ini</p>
                                <p className="text-xs text-slate-500">
                                    Arsip lokal disimpan 48 jam di perangkat tempat ujian dikerjakan (atau sudah kedaluwarsa).
                                </p>
                            </>
                        )}
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                            {server ? <Cloud className="size-4 text-emerald-600" /> : <CloudOff className="size-4 text-amber-600" />}
                            <span>Server e-Rapor</span>
                        </div>
                        {server ? (
                            <>
                                <p className="font-display text-2xl font-extrabold text-ink tabular-nums">
                                    {server.jumlah_terjawab} <span className="text-sm font-semibold text-slate-500">/ {server.total_soal} terjawab</span>
                                </p>
                                <p className="text-xs text-slate-600">
                                    {server.dikumpulkan_pada
                                        ? `Dikumpulkan ${hariTanggal(server.dikumpulkan_pada)}, pukul ${jamMenit(server.dikumpulkan_pada, true)}`
                                        : 'Tercatat selesai di server'}
                                </p>
                            </>
                        ) : serverQuery.isFetching ? (
                            <p className="flex items-center gap-2 text-sm text-slate-600">
                                <Loader2 className="size-4 animate-spin" /> Menghubungi server…
                            </p>
                        ) : (
                            <>
                                <p className="text-base font-bold text-coral-700">Belum termuat dari server</p>
                                <p className="text-xs text-slate-600">{galatServer?.pesan}</p>
                            </>
                        )}
                    </div>
                </section>

                {/* Status Perbandingan */}
                {server && arsip && (
                    adaPerbedaanTotal ? (
                        <div role="alert" className="flex items-start gap-3 rounded-xl border border-coral-200 bg-coral-50 p-4 text-sm text-coral-800 shadow-xs">
                            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-coral-600" />
                            <div className="space-y-1">
                                <p className="font-bold">
                                    Ditemukan perbedaan antara perangkat dan server (Client: {arsip.jumlahTerjawab}, Server: {server.jumlah_terjawab})
                                </p>
                                <p className="text-xs">
                                    Tunjukkan halaman ini kepada pengawas/proktor sebagai bukti pengerjaan di perangkat.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-xs">
                            <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />
                            <div>
                                <p className="font-bold">Cocok — Semua jawaban di perangkat sama dengan yang tercatat di server.</p>
                                <p className="text-xs text-emerald-700">Total {server.jumlah_terjawab} dari {server.total_soal} soal terverifikasi di kedua sisi.</p>
                            </div>
                        </div>
                    )
                )}

                {galatServer && (
                    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
                        <span>{galatServer.pesan}</span>
                        {galatServer.bisaCobaLagi && (
                            <Tombol varian="outline" ukuran="sm" onClick={() => void serverQuery.refetch()}>
                                Coba Lagi
                            </Tombol>
                        )}
                    </div>
                )}

                {/* Filter & Tabel Rincian */}
                {baris.length > 0 ? (
                    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
                            <h2 className="text-sm font-bold text-ink">Rincian Jawaban Per Nomor</h2>
                            <div className="flex flex-wrap gap-1.5">
                                {(
                                    [
                                        { id: 'semua' as const, label: `Semua (${baris.length})` },
                                        ...(jumlahSelisih > 0 ? [{ id: 'berbeda' as const, label: `Berbeda (${jumlahSelisih})` }] : []),
                                        { id: 'terjawab' as const, label: 'Terjawab' },
                                        { id: 'kosong' as const, label: 'Kosong' },
                                    ]
                                ).map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => setFilter(tab.id)}
                                        className={cn(
                                            'rounded-lg px-2.5 py-1 text-xs font-bold transition',
                                            filter === tab.id
                                                ? 'bg-primary text-white'
                                                : tab.id === 'berbeda'
                                                  ? 'bg-coral-50 text-coral-700 hover:bg-coral-100'
                                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                                        )}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs sm:text-sm">
                                <thead className="bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500">
                                    <tr>
                                        <th className="px-4 py-2.5 w-14">No</th>
                                        <th className="px-4 py-2.5">Perangkat (Client)</th>
                                        <th className="px-4 py-2.5">Server</th>
                                        <th className="px-4 py-2.5 w-32 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {barisTampil.map((b) => (
                                        <tr
                                            key={b.soalId}
                                            className={cn(
                                                b.status === 'hanya_client' || b.status === 'berbeda' || b.status === 'ditolak'
                                                    ? 'bg-coral-50/50'
                                                    : 'hover:bg-slate-50/70',
                                            )}
                                        >
                                            <td className="px-4 py-2.5 font-bold text-ink tabular-nums">
                                                <span className="inline-flex items-center gap-1">
                                                    {b.nomor}
                                                    {(b.server?.ragu || b.client?.ragu) && (
                                                        <Bookmark className="size-3 fill-amber-500 text-amber-500" aria-label="Ragu-ragu" />
                                                    )}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-700 break-words max-w-[14rem]">
                                                {b.client ? (
                                                    b.client.terjawab ? (
                                                        <span className="font-semibold text-ink">{b.client.ringkasan}</span>
                                                    ) : (
                                                        <span className="italic text-slate-400">Kosong</span>
                                                    )
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-700 break-words max-w-[14rem]">
                                                {b.server ? (
                                                    b.server.terjawab ? (
                                                        <span className="font-semibold text-ink">{b.server.ringkasan}</span>
                                                    ) : (
                                                        <span className="italic text-slate-400">Kosong</span>
                                                    )
                                                ) : (
                                                    <span className="text-slate-400">—</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 text-right whitespace-nowrap">
                                                {b.status === 'cocok' ? (
                                                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                                                        Cocok
                                                    </span>
                                                ) : b.status === 'ditolak' ? (
                                                    <span className="inline-flex items-center rounded-full bg-coral-100 px-2 py-0.5 text-[11px] font-bold text-coral-800">
                                                        {ALASAN_DITOLAK[b.ditolakAlasan ?? ''] ?? 'Ditolak server'}
                                                    </span>
                                                ) : b.status === 'hanya_client' ? (
                                                    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                                                        Belum di server
                                                    </span>
                                                ) : b.status === 'berbeda' ? (
                                                    <span className="inline-flex items-center rounded-full bg-coral-100 px-2 py-0.5 text-[11px] font-bold text-coral-800">
                                                        Berbeda
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                                                        Satu sisi
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                ) : (
                    !serverQuery.isPending && (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
                            Belum ada data jawaban yang bisa ditampilkan untuk sesi ini.
                        </div>
                    )
                )}

                <p className="text-center text-xs text-slate-500">
                    Daftar ini hanya menampilkan bukti jawaban tanpa teks soal maupun nilai. Nilai dapat dilihat di menu Hasil setelah dirilis guru.
                </p>
            </main>
        </div>
    )
}
