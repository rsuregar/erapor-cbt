import { KepalaFitur } from '@/komponen/KepalaFitur'
import { Kartu } from '@/komponen/Kartu'
import { KartuKesiapan } from '@/komponen/KartuKesiapan'
import { KotakToken } from '@/komponen/KotakToken'
import { Lencana } from '@/komponen/Lencana'
import { Progres } from '@/komponen/Progres'
import { SpanduOffline } from '@/komponen/SpanduOffline'
import { Tombol } from '@/komponen/Tombol'
import { api, platform } from '@/lib/api'
import { ukuranBerkas } from '@/lib/format'
import { masukLayarPenuh, wajibLayarPenuh } from '@/lib/perangkat'
import { BATAS_AKURASI_M, kodeGalatLokasi, petunjukIzin, tanpaWaktu } from '@/lib/lokasi'
import { sesi } from '@/lib/sesi'
import { durasiSingkat, hariTanggal, jamMenit } from '@/lib/tanggal'
import { ambilPaket, daftarUjian, sesiLokalUjian, simpanSesi } from '@/lib/ujian'
import { useOnline } from '@/lib/useOnline'
import { terapkanPembaruan, useKesiapan } from '@/lib/useKesiapan'
import { useLokasi, type TahapLokasi } from '@/lib/useLokasi'
import { useUnduhPaket, type TahapUnduh } from '@/lib/useUnduhPaket'
import { cn } from '@/lib/utils'
import { dekripsiPaket, GalatApi, type UjianRingkas } from '@erapor-cbt/exam-core'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, BellOff, CheckCircle2, Clock, DownloadCloud, ListChecks, Loader2, LocateFixed, MapPin, RotateCw, ShieldCheck, Wifi } from 'lucide-react'
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
    LOKASI_DIPERLUKAN: 'Ujian ini hanya bisa dikerjakan di sekolah. Izinkan akses lokasi lalu coba lagi.',
    LOKASI_PALSU: 'Terdeteksi aplikasi lokasi palsu. Matikan aplikasi tersebut lalu coba lagi.',
    LOKASI_BELUM_DIATUR: 'Lokasi sekolah belum diatur untuk ujian ini. Hubungi pengawas.',
}

const PESAN_LOKASI_PERANGKAT: Record<string, string> = {
    DITOLAK: 'Akses lokasi ditolak. Izinkan lokasi lalu coba lagi.',
    WAKTU_HABIS: 'Posisi belum didapat. Pastikan GPS menyala, lalu coba lagi.',
    TIDAK_ADA: 'Posisi belum didapat. Pastikan GPS menyala, lalu coba lagi.',
    TIDAK_DIDUKUNG: 'Perangkat ini tidak bisa membaca lokasi. Hubungi pengawas.',
}

function pesanGalatMulai(e: Error): string {
    // Galat GPS perangkat (ditolak, waktu habis) membawa `kode` sendiri.
    if (!(e instanceof GalatApi)) return 'kode' in e ? PESAN_LOKASI_PERANGKAT[kodeGalatLokasi(e)] : e.message
    const m = (k: string) => Math.round(Number(e.data[k] ?? 0))
    if (e.kode === 'DI_LUAR_LOKASI') {
        return `Kamu berada ±${jarak(m('jarak_meter'))} dari sekolah (batas ${m('radius_meter')} m). Ujian ini hanya bisa dikerjakan di area sekolah — bila kamu mendapat izin, minta pengawas memberi izin dari luar sekolah.`
    }
    if (e.kode === 'LOKASI_TIDAK_AKURAT') {
        return `Sinyal GPS kurang akurat (±${m('akurasi_meter')} m). Pindah ke dekat jendela atau ruang terbuka, tunggu sebentar, lalu coba lagi.`
    }

    return PESAN_MULAI[e.kode] ?? e.message
}

const jarak = (m: number) => (m >= 1000 ? `${(m / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} km` : `${m} m`)

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

    const online = useOnline()
    const ujian = useQuery({ queryKey: ['ujian'], queryFn: daftarUjian, select: (d) => d.data.find((u) => u.id === ujianId), networkMode: 'always' })
    // Sudah dimulai di perangkat ini? Offline tetap bisa dilanjutkan tanpa /mulai.
    const lokal = useQuery({ queryKey: ['sesi-lokal', ujianId], queryFn: () => sesiLokalUjian(ujianId), networkMode: 'always' })
    const lanjutLokal = () => lokal.data && navigate({ to: '/kerjakan/$attemptId', params: { attemptId: lokal.data.mulai.attempt_id }, replace: true })
    const u = ujian.data
    const { status, unduh } = useUnduhPaket(u)
    const wajibLokasi = !!u?.lokasi?.wajib
    const lokasi = useLokasi(wajibLokasi)
    const kesiapan = useKesiapan(u?.level_keamanan)

    const mulai = useMutation({
        mutationFn: async (layarPenuh: Promise<boolean>) => {
            // Ketat/Lockdown di laptop: tanpa layar penuh tidak boleh mulai.
            if (!(await layarPenuh) && u && wajibLayarPenuh(u.level_keamanan)) {
                throw new Error('Ujian ini wajib layar penuh. Izinkan layar penuh saat diminta browser, lalu tekan Mulai lagi.')
            }
            // Posisi baru dicek server di /mulai — juga saat melanjutkan atau pindah perangkat.
            const posisi = wajibLokasi ? tanpaWaktu(await lokasi.posisiSegar()) : undefined
            let r
            try {
                r = await api.mulai(
                    ujianId,
                    token,
                    await sesi.perangkatId(),
                    {
                        platform: platform(),
                        versi_app: __VERSI_APP__,
                        // PWA tidak bisa membaca status kunci OS; pengawas memverifikasi manual.
                        kiosk_aktif: platform() === 'pwa' ? null : false,
                    },
                    posisi,
                )
            } catch (e) {
                // Server tak terjangkau tapi ujian sudah berjalan di perangkat ini: lanjutkan lokal.
                if (e instanceof GalatApi && e.sementara && lokal.data) return lokal.data.mulai
                throw e
            }
            const paket = await ambilPaket(ujianId)
            if (!paket) throw new Error('Paket belum ada di perangkat.')
            await dekripsiPaket(paket, r.kunci) // pastikan paket cocok sebelum masuk layar ujian
            await simpanSesi({
                mulai: r,
                ujian: { id: ujianId, nama: u!.nama, mapel: u!.mapel, level_keamanan: u!.level_keamanan },
                pemilik: sesi.uuid(),
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
            // Bacaan GPS berikutnya bisa lebih baik: segarkan di latar.
            if (e instanceof GalatApi && (e.kode === 'LOKASI_TIDAK_AKURAT' || e.kode === 'DI_LUAR_LOKASI')) lokasi.cari()
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
    const lokasiSiap = !wajibLokasi || lokasi.status.tahap === 'siap'
    const perangkatSiap = kesiapan.penghalang.length === 0
    const bisaMulai = online && perangkatSiap && siap && lokasiSiap && dibuka && !selesai && token.length === 6 && !mulai.isPending
    const offlineLokal = !online && !!lokal.data
    const galatMulai = mulai.error ? pesanGalatMulai(mulai.error) : null

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
                        <Butir
                            ikon={<LocateFixed className="size-4" />}
                            label="Lokasi"
                            isi={wajibLokasi ? `Di sekolah${u.lokasi.radius_meter ? ` · radius ${u.lokasi.radius_meter} m` : ''}` : 'Dari mana saja'}
                        />
                    </dl>
                </Kartu>

                <Kartu className="space-y-2.5">
                    <h2 className="text-body-lg">Tata tertib</h2>
                    <Aturan ikon={<BellOff className="size-4" />}>Nyalakan mode Jangan Ganggu dan tutup aplikasi lain.</Aturan>
                    <Aturan ikon={<ShieldCheck className="size-4" />}>Jangan keluar dari aplikasi atau berpindah layar — tercatat sebagai pelanggaran.</Aturan>
                    {u.level_keamanan === 'lockdown' && (
                        <Aturan ikon={<ShieldCheck className="size-4" />}>Ujian Lockdown: memuat ulang atau menutup aplikasi langsung mengunci ujian sampai dibuka pengawas.</Aturan>
                    )}
                    {wajibLokasi && (
                        <Aturan ikon={<LocateFixed className="size-4" />}>Ujian ini hanya bisa dikerjakan di area sekolah. Posisimu dicek saat menekan Mulai dan selama ujian.</Aturan>
                    )}
                    <Aturan ikon={<Wifi className="size-4" />}>Jawaban tersimpan di perangkat walau internet putus, lalu terkirim otomatis.</Aturan>
                    <Aturan ikon={<Clock className="size-4" />}>Waktu mengikuti jam server; ujian terkumpul otomatis saat waktu habis.</Aturan>
                </Kartu>

                <KartuKesiapan
                    daftar={kesiapan.daftar}
                    penghalang={kesiapan.penghalang}
                    onAksi={(a) => {
                        if (a === 'perbarui') void terapkanPembaruan()
                        else if (a === 'layar_penuh') void masukLayarPenuh()
                        else if (a === 'panduan') void navigate({ to: '/panduan' })
                    }}
                />

                {!online && (
                    <SpanduOffline>
                        {lokal.data
                            ? 'Ujian ini sudah kamu mulai di perangkat ini — lanjutkan tanpa token; jawaban terkirim otomatis saat tersambung.'
                            : 'Memulai ujian butuh internet untuk memeriksa token. Paket soal yang sudah diunduh tetap tersimpan.'}
                    </SpanduOffline>
                )}

                {offlineLokal ? (
                    <Kartu>
                        <Tombol
                            ukuran="lg"
                            penuh
                            onClick={() => {
                                void masukLayarPenuh()
                                lanjutLokal()
                            }}
                        >
                            Lanjutkan ujian
                        </Tombol>
                    </Kartu>
                ) : (
                <Kartu className="space-y-4">
                    <KartuUnduh ujian={u} status={status} onUnduh={unduh} />

                    {wajibLokasi && <KartuLokasi status={lokasi.status} radius={u.lokasi.radius_meter} onCari={lokasi.cari} />}

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

                    <Tombol ukuran="lg" penuh disabled={!bisaMulai} onClick={() => mulai.mutate(masukLayarPenuh())}>
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
                                  : !perangkatSiap
                                    ? `Perbaiki dulu: ${kesiapan.penghalang.map((i) => i.judul.toLowerCase()).join(', ')}.`
                                    : !lokasiSiap
                                    ? 'Tombol aktif setelah posisimu didapat.'
                                    : token.length < 6
                                    ? 'Masukkan 6 karakter token.'
                                    : !online
                                      ? 'Tombol aktif setelah tersambung ke internet.'
                                      : 'Siap. Waktu mulai berjalan setelah kamu menekan Mulai.'}
                    </p>
                </Kartu>
                )}
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

function KartuLokasi({ status, radius, onCari }: { status: TahapLokasi; radius: number | null; onCari: () => void }) {
    const lemah = status.tahap === 'siap' && status.posisi.akurasi_m > BATAS_AKURASI_M
    const [lencana, nada] =
        status.tahap === 'siap'
            ? lemah
                ? (['Sinyal lemah', 'amber'] as const)
                : (['Posisi didapat', 'green'] as const)
            : status.tahap === 'mencari'
              ? (['Mencari…', 'sky'] as const)
              : status.tahap === 'galat'
                ? (['Belum didapat', 'red'] as const)
                : (['Perlu izin', 'neutral'] as const)

    return (
        <div className="space-y-3 border-t border-dashed border-slate-200 pt-4">
            <div className="flex items-center gap-2 text-sm">
                {status.tahap === 'siap' && !lemah ? <CheckCircle2 className="size-5 text-green-500" /> : <LocateFixed className="size-5 text-primary" />}
                <span className="mr-auto font-semibold text-ink">Lokasi</span>
                <Lencana nada={nada}>{lencana}</Lencana>
            </div>

            {status.tahap === 'belum' && (
                <div className="flex items-center gap-3">
                    <p className="mr-auto text-sm text-slate-500">
                        Ujian ini dikerjakan di sekolah{radius ? ` (radius ${radius} m)` : ''}. Izinkan akses lokasi agar posisimu bisa dicek.
                    </p>
                    <Tombol varian="secondary" ukuran="sm" onClick={onCari}>
                        Izinkan
                    </Tombol>
                </div>
            )}

            {status.tahap === 'mencari' && (
                <p className="flex items-center gap-2 text-sm text-slate-500">
                    <Loader2 className="size-4 animate-spin" /> Mencari posisi… di dalam gedung bisa butuh beberapa detik.
                </p>
            )}

            {status.tahap === 'siap' && (
                <div className="flex items-center gap-3">
                    <p className={cn('mr-auto text-sm', lemah ? 'text-amber-700' : 'text-slate-500')}>
                        {lemah
                            ? `Akurasi ±${status.posisi.akurasi_m} m — terlalu kabur. Pindah ke dekat jendela lalu perbarui.`
                            : `Akurasi ±${status.posisi.akurasi_m} m. Posisi dicek server saat kamu menekan Mulai.`}
                    </p>
                    <Tombol varian="outline" ukuran="sm" ikonKiri={<RotateCw className="size-4" />} onClick={onCari}>
                        Perbarui
                    </Tombol>
                </div>
            )}

            {status.tahap === 'galat' && (
                <div className="space-y-2">
                    <p className="text-sm text-coral-600">{PESAN_LOKASI_PERANGKAT[status.kode]}</p>
                    {status.kode === 'DITOLAK' && <p className="text-xs text-slate-500">{petunjukIzin()}</p>}
                    {status.kode !== 'TIDAK_DIDUKUNG' && (
                        <Tombol varian="outline" ukuran="sm" ikonKiri={<RotateCw className="size-4" />} onClick={onCari}>
                            Coba lagi
                        </Tombol>
                    )}
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
