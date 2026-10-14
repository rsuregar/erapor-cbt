import { KepalaFitur } from '@/komponen/KepalaFitur'
import { Kartu } from '@/komponen/Kartu'
import { KotakToken } from '@/komponen/KotakToken'
import { Lencana } from '@/komponen/Lencana'
import { Progres } from '@/komponen/Progres'
import { Tombol } from '@/komponen/Tombol'
import { api, platform } from '@/lib/api'
import { ukuranBerkas } from '@/lib/format'
import { sesi } from '@/lib/sesi'
import { durasiSingkat, hariTanggal, jamMenit } from '@/lib/tanggal'
import { ambilPaket, simpanSesi } from '@/lib/ujian'
import { useUnduhPaket, type TahapUnduh } from '@/lib/useUnduhPaket'
import { cn } from '@/lib/utils'
import { dekripsiPaket, GalatApi, type UjianRingkas } from '@erapor-cbt/exam-core'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, BellOff, CheckCircle2, Clock, DownloadCloud, ListChecks, MapPin, RotateCw, ShieldCheck, Wifi } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'

const KEAMANAN = { dasar: 'Dasar', ketat: 'Ketat', lockdown: 'Lockdown' } as const

const PESAN_MULAI: Record<string, string> = {
    TOKEN_SALAH: 'Token salah atau sudah berganti. Tanyakan token terbaru ke pengawas.',
    BELUM_DIBUKA: 'Ujian belum dibuka.',
    SUDAH_DITUTUP: 'Ujian sudah ditutup.',
    PERANGKAT_LAIN: 'Ujian ini sedang dikerjakan di perangkat lain. Minta pengawas mereset perangkat.',
    TERKUNCI: 'Ujianmu dikunci. Hubungi pengawas.',
    SUDAH_SELESAI: 'Ujian ini sudah kamu kumpulkan.',
    JARINGAN: 'Tidak tersambung ke server. Periksa internet lalu coba lagi.',
}

/**
 * Konfirmasi sebelum mulai (PRD M-03): identitas, tata tertib, pra-unduh
 * paket + media dengan progres, token, lalu /mulai.
 */
export default function Persiapan({ ujianId }: { ujianId: number }) {
    const navigate = useNavigate()
    const [token, setToken] = useState('')
    const [goyang, setGoyang] = useState(0)
    const [sekarang, setSekarang] = useState(Date.now())
    useEffect(() => {
        const t = setInterval(() => setSekarang(Date.now()), 1000)

        return () => clearInterval(t)
    }, [])

    const ujian = useQuery({ queryKey: ['ujian'], queryFn: () => api.daftarUjian(), select: (d) => d.find((u) => u.id === ujianId) })
    const u = ujian.data
    const { status, unduh } = useUnduhPaket(u)

    const mulai = useMutation({
        mutationFn: async () => {
            const r = await api.mulai(ujianId, token, await sesi.perangkatId(), {
                platform: platform(),
                versi_app: __VERSI_APP__,
                // PWA tidak bisa membaca status kunci OS; pengawas memverifikasi manual.
                kiosk_aktif: platform() === 'pwa' ? null : false,
            })
            const paket = await ambilPaket(ujianId)
            if (!paket) throw new Error('Paket belum ada di perangkat.')
            await dekripsiPaket(paket, r.kunci) // pastikan paket cocok sebelum masuk layar ujian
            await simpanSesi({
                mulai: r,
                ujian: { id: ujianId, nama: u!.nama, mapel: u!.mapel, level_keamanan: u!.level_keamanan },
                selisihJam: Date.parse(r.waktu_server) - Date.now(),
            })

            return r
        },
        onSuccess: (r) => navigate({ to: '/kerjakan/$attemptId', params: { attemptId: r.attempt_id }, replace: true }),
        onError: (e) => {
            if (e instanceof GalatApi && e.kode === 'TOKEN_SALAH') {
                setGoyang((n) => n + 1)
                setToken('')
            }
        },
    })

    if (!u) {
        return (
            <div className="min-h-full">
                <KepalaFitur judul="Persiapan ujian" onKembali={() => navigate({ to: '/' })} />
                <p className="p-4 text-slate-500">{ujian.isPending ? 'Memuat…' : 'Ujian tidak ditemukan.'}</p>
            </div>
        )
    }

    const buka = Date.parse(u.dibuka_pada)
    const tutup = Date.parse(u.ditutup_pada)
    const siap = status.tahap === 'siap'
    const dibuka = sekarang >= buka && sekarang <= tutup
    const selesai = u.status === 'selesai'
    const bisaMulai = siap && dibuka && !selesai && token.length === 6 && !mulai.isPending
    const galatMulai = mulai.error ? (mulai.error instanceof GalatApi ? (PESAN_MULAI[mulai.error.kode] ?? mulai.error.message) : mulai.error.message) : null

    return (
        <div className="min-h-full pb-10">
            <KepalaFitur judul={u.nama} subjudul={u.mapel ?? undefined} onKembali={() => navigate({ to: '/' })} />

            <main className="mx-auto max-w-xl space-y-4 px-4 pt-5">
                <Kartu className="space-y-3">
                    <div className="flex items-center gap-3">
                        <img src="/brand/logogram.png" alt="" className="size-11" />
                        <div>
                            <p className="text-xs text-slate-500">Peserta</p>
                            <p className="font-bold text-ink">{sesi.nama() ?? '—'}</p>
                        </div>
                    </div>
                    <dl className="grid grid-cols-2 gap-3 border-t border-dashed border-slate-200 pt-3 text-sm">
                        <Butir ikon={<Clock className="size-4" />} label="Waktu" isi={`${hariTanggal(u.dibuka_pada)}, ${jamMenit(u.dibuka_pada)}–${jamMenit(u.ditutup_pada)}`} />
                        <Butir ikon={<ListChecks className="size-4" />} label="Soal · durasi" isi={`${u.jumlah_soal} soal · ${u.durasi_menit + u.tambahan_waktu_menit} menit`} />
                        <Butir ikon={<MapPin className="size-4" />} label="Sesi" isi={u.sesi ? `${u.sesi.nama}${u.sesi.ruang ? ` · ${u.sesi.ruang}` : ''}` : '—'} />
                        <Butir ikon={<ShieldCheck className="size-4" />} label="Keamanan" isi={<Lencana nada={u.level_keamanan === 'dasar' ? 'neutral' : 'magenta'}>{KEAMANAN[u.level_keamanan]}</Lencana>} />
                    </dl>
                </Kartu>

                <Kartu className="space-y-2.5">
                    <h2 className="text-body-lg">Tata tertib</h2>
                    <Aturan ikon={<BellOff className="size-4" />}>Nyalakan mode Jangan Ganggu dan tutup aplikasi lain.</Aturan>
                    <Aturan ikon={<ShieldCheck className="size-4" />}>Jangan keluar dari aplikasi atau berpindah layar — tercatat sebagai pelanggaran.</Aturan>
                    <Aturan ikon={<Wifi className="size-4" />}>Jawaban tersimpan di perangkat walau internet putus, lalu terkirim otomatis.</Aturan>
                    <Aturan ikon={<Clock className="size-4" />}>Waktu mengikuti jam server; ujian terkumpul otomatis saat waktu habis.</Aturan>
                </Kartu>

                <Kartu className="space-y-4">
                    <KartuUnduh ujian={u} status={status} onUnduh={unduh} />

                    <div className={cn('space-y-2 text-center', !siap && 'opacity-50')}>
                        <p className="text-sm font-semibold text-ink">Masukkan token dari pengawas</p>
                        <div key={goyang} className={goyang ? 'animate-goyang' : undefined}>
                            <KotakToken nilai={token} onUbah={setToken} galat={!!galatMulai && token.length === 0} nonaktif={!siap || selesai || mulai.isPending} />
                        </div>
                    </div>

                    {galatMulai && (
                        <p role="alert" className="flex gap-2 rounded-sm bg-coral-100 px-3 py-2.5 text-sm font-medium text-coral-600">
                            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {galatMulai}
                        </p>
                    )}

                    <Tombol ukuran="lg" penuh disabled={!bisaMulai} onClick={() => mulai.mutate()}>
                        {mulai.isPending ? 'Memulai…' : u.status === 'mengerjakan' ? 'Lanjutkan ujian' : 'Mulai ujian'}
                    </Tombol>
                    <p className="text-center text-xs text-slate-500">
                        {selesai
                            ? 'Ujian ini sudah dikumpulkan.'
                            : sekarang < buka
                              ? `Ujian dibuka dalam ${durasiSingkat(buka - sekarang)}.`
                              : sekarang > tutup
                                ? 'Ujian sudah ditutup.'
                                : !siap
                                  ? 'Tombol aktif setelah paket soal selesai diunduh.'
                                  : token.length < 6
                                    ? 'Masukkan 6 karakter token.'
                                    : 'Siap. Waktu mulai berjalan setelah kamu menekan Mulai.'}
                    </p>
                </Kartu>
            </main>
        </div>
    )
}

function KartuUnduh({ ujian, status, onUnduh }: { ujian: UjianRingkas; status: TahapUnduh; onUnduh: () => void }) {
    const [lencana, nada] =
        status.tahap === 'siap'
            ? (['Siap di perangkat', 'green'] as const)
            : status.tahap === 'galat'
              ? (['Gagal', 'red'] as const)
              : status.tahap === 'paket' || status.tahap === 'media' || status.tahap === 'menunggu'
                ? (['Mengunduh', 'sky'] as const)
                : ujian.bisa_unduh
                  ? (['Siap diunduh', 'sky'] as const)
                  : (['Belum tersedia', 'neutral'] as const)

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
                {status.tahap === 'siap' ? <CheckCircle2 className="size-5 text-green-500" /> : <DownloadCloud className="size-5 text-primary" />}
                <span className="mr-auto font-semibold text-ink">Paket soal</span>
                <Lencana nada={nada}>{lencana}</Lencana>
            </div>

            {status.tahap === 'belum' && !ujian.bisa_unduh && (
                <p className="text-sm text-slate-500">Paket bisa diunduh 30 menit sebelum ujian dibuka ({jamMenit(ujian.dibuka_pada)}).</p>
            )}

            {status.tahap === 'menunggu' && (
                <div className="flex items-center gap-3 text-sm text-slate-500">
                    <span className="mr-auto">Paket diunduh otomatis sebentar lagi.</span>
                    <Tombol varian="secondary" ukuran="sm" onClick={onUnduh}>
                        Unduh sekarang
                    </Tombol>
                </div>
            )}

            {status.tahap === 'paket' && (
                <div className="space-y-1.5">
                    <Progres nilai={status.total ? status.diterima / status.total : null} />
                    <p className="flex justify-between text-xs text-slate-500">
                        <span>Mengunduh paket soal…</span>
                        <span className="font-semibold tabular-nums">
                            {ukuranBerkas(status.diterima)}
                            {status.total ? ` / ${ukuranBerkas(status.total)}` : ''}
                        </span>
                    </p>
                </div>
            )}

            {status.tahap === 'media' && (
                <div className="space-y-1.5">
                    <Progres nilai={status.total ? status.selesai / status.total : null} />
                    <p className="flex justify-between text-xs text-slate-500">
                        <span>Mengunduh gambar soal…</span>
                        <span className="font-semibold tabular-nums">
                            {status.selesai} / {status.total}
                        </span>
                    </p>
                </div>
            )}

            {status.tahap === 'siap' && (
                <div className="space-y-1.5">
                    <Progres nilai={1} />
                    <p className="text-xs text-slate-500">
                        Tersimpan di perangkat ({ukuranBerkas(status.ukuran)}
                        {status.media ? ` + ${status.media} gambar` : ''}). Soal terkunci sampai token dimasukkan.
                    </p>
                </div>
            )}

            {status.tahap === 'galat' && (
                <div className="flex items-center gap-3">
                    <p className="mr-auto text-sm text-coral-600">{status.pesan}</p>
                    <Tombol varian="outline" ukuran="sm" ikonKiri={<RotateCw className="size-4" />} onClick={onUnduh}>
                        Coba lagi
                    </Tombol>
                </div>
            )}
        </div>
    )
}

function Butir({ ikon, label, isi }: { ikon: ReactNode; label: string; isi: ReactNode }) {
    return (
        <div>
            <dt className="flex items-center gap-1.5 text-xs text-slate-500">
                {ikon} {label}
            </dt>
            <dd className="mt-0.5 font-semibold text-ink">{isi}</dd>
        </div>
    )
}

function Aturan({ ikon, children }: { ikon: ReactNode; children: ReactNode }) {
    return (
        <p className="flex gap-2.5 text-sm">
            <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-50 text-primary">{ikon}</span>
            <span>{children}</span>
        </p>
    )
}
