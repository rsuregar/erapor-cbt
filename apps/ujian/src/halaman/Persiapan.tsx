import { IndikatorKoneksi } from '@/komponen/IndikatorKoneksi'
import { KepalaFitur } from '@/komponen/KepalaFitur'
import { KartuKesiapan } from '@/komponen/KartuKesiapan'
import { FotoMurid } from '@/komponen/FotoMurid'
import { KotakToken } from '@/komponen/KotakToken'
import { Lencana } from '@/komponen/Lencana'
import { Progres } from '@/komponen/Progres'
import { SpanduOffline } from '@/komponen/SpanduOffline'
import { Tombol } from '@/komponen/Tombol'
import { api, platform } from '@/lib/api'
import { ukuranBerkas } from '@/lib/format'
import { kunciLayar, lepasKunciLayar, statusKunciLayar } from '@/lib/native'
import { masukLayarPenuh, wajibLayarPenuh } from '@/lib/perangkat'
import { BATAS_AKURASI_M, kodeGalatLokasi, petunjukIzin, tanpaWaktu } from '@/lib/lokasi'
import { sesi } from '@/lib/sesi'
import { durasiLengkap, hariTanggal, jamMenit } from '@/lib/tanggal'
import { ambilPaket, daftarUjian, sesiLokalUjian, simpanSesi } from '@/lib/ujian'
import { useOnline } from '@/lib/useOnline'
import { terapkanPembaruan, useKesiapan } from '@/lib/useKesiapan'
import { useLokasi, type TahapLokasi } from '@/lib/useLokasi'
import { useUnduhPaket, type TahapUnduh } from '@/lib/useUnduhPaket'
import { cn } from '@/lib/utils'
import { dekripsiPaket, GalatApi, type UjianRingkas } from '@erapor-cbt/exam-core'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, BellOff, CheckCircle2, ChevronLeft, Clock, DownloadCloud, ListChecks, Loader2, LocateFixed, MapPin, RotateCw, ShieldCheck, Wifi } from 'lucide-react'
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
    VERSI_USANG: 'Versi aplikasi sudah usang. Perbarui aplikasi lalu coba lagi.',
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
    if (e.kode === 'VERSI_USANG' && e.data.versi_minimum) {
        return `Versi aplikasi ${__VERSI_APP__} sudah usang (minimum ${String(e.data.versi_minimum)}). Perbarui aplikasi lalu coba lagi.`
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
    const ujian = useQuery({ queryKey: ['ujian'], queryFn: daftarUjian, select: (d) => ({ u: d.data.find((u) => u.id === ujianId), aplikasi: d.aplikasi }), networkMode: 'always' })
    // Sudah dimulai di perangkat ini? Offline tetap bisa dilanjutkan tanpa /mulai.
    const lokal = useQuery({ queryKey: ['sesi-lokal', ujianId], queryFn: () => sesiLokalUjian(ujianId), networkMode: 'always' })
    const lanjutLokal = () => lokal.data && navigate({ to: '/kerjakan/$attemptId', params: { attemptId: lokal.data.mulai.attempt_id }, replace: true })
    const u = ujian.data?.u
    const aplikasi = ujian.data?.aplikasi
    const { status, unduh } = useUnduhPaket(u)
    const wajibLokasi = !!u?.lokasi?.wajib
    const lokasi = useLokasi(wajibLokasi)
    const kesiapan = useKesiapan(u?.level_keamanan, aplikasi)

    const mulai = useMutation({
        mutationFn: async (layarPenuh: Promise<boolean>) => {
            // Ketat/Lockdown di laptop: tanpa layar penuh tidak boleh mulai.
            if (!(await layarPenuh) && u && wajibLayarPenuh(u.level_keamanan)) {
                throw new Error('Ujian ini wajib layar penuh. Izinkan layar penuh saat diminta browser, lalu tekan Mulai lagi.')
            }
            // Posisi baru dicek server di /mulai — juga saat melanjutkan atau pindah perangkat.
            const posisi = wajibLokasi ? tanpaWaktu(await lokasi.posisiSegar()) : undefined
            // App native, Ketat/Lockdown: sematkan layar dulu supaya kiosk_aktif yang dilaporkan benar.
            const kios = u && u.level_keamanan !== 'dasar' ? await kunciLayar() : await statusKunciLayar()
            let r
            try {
                r = await api.mulai(
                    ujianId,
                    token,
                    await sesi.perangkatId(),
                    {
                        platform: platform(),
                        versi_app: __VERSI_APP__,
                        // PWA tidak bisa membaca status kunci OS (null); pengawas memverifikasi manual.
                        kiosk_aktif: kios,
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
            // Belum jadi mulai: jangan biarkan murid tersemat di halaman persiapan.
            void lepasKunciLayar()
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
        <div className="min-h-full bg-slate-50/70 pb-16">
            {/* Header Hero Section */}
            <header className="relative overflow-hidden rounded-b-[1.75rem] sm:rounded-b-[2.5rem] bg-gradient-to-br from-[#0B486F] via-[#006195] to-[#004B74] px-4 pt-4 pb-12 sm:pb-14 text-white shadow-lg sm:px-6">
                {/* Decorative Ambient Backgrounds */}
                <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-white/5 blur-3xl" aria-hidden="true" />
                <div className="pointer-events-none absolute -left-16 bottom-0 size-72 rounded-full bg-sky-400/10 blur-2xl" aria-hidden="true" />

                <div className="relative mx-auto max-w-xl space-y-3.5">
                    {/* Top Bar: Back & Status */}
                    <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                        <button
                            onClick={() => navigate({ to: '/' })}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
                            aria-label="Kembali ke beranda"
                        >
                            <ChevronLeft className="size-4" />
                            <span>Kembali</span>
                        </button>

                        <div className="flex items-center gap-2">
                            <IndikatorKoneksi online={online} tema="gelap" />
                        </div>
                    </div>

                    {/* Subject Tags & Exam Title */}
                    <div className="space-y-1.5 pt-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                            {u.mapel && (
                                <span className="inline-flex items-center rounded-md bg-white/15 px-2.5 py-0.5 text-[11px] font-extrabold uppercase tracking-wide text-sky-100 backdrop-blur-md border border-white/15">
                                    {u.mapel}
                                </span>
                            )}
                            <span className="inline-flex items-center gap-1 rounded-md bg-white/15 px-2.5 py-0.5 text-[11px] font-bold text-sky-100 backdrop-blur-md border border-white/15">
                                <ShieldCheck className="size-3" />
                                <span>Mode {KEAMANAN[u.level_keamanan]}</span>
                            </span>
                        </div>

                        <h1 className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-white drop-shadow-sm">
                            {u.nama}
                        </h1>

                        {/* Status Chip */}
                        <div className="pt-0.5">
                            {dibuka && !selesai ? (
                                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-200 backdrop-blur-md border border-emerald-400/30">
                                    <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    <span>Sedang Berlangsung · Sisa {durasiLengkap(tutup - sekarang)} (s/d {jamMenit(u.ditutup_pada)} WITA)</span>
                                </div>
                            ) : sekarang < buka ? (
                                <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-semibold text-amber-200 backdrop-blur-md border border-amber-300/30">
                                    <Clock className="size-3 text-amber-300" />
                                    <span>Dibuka dalam {durasiLengkap(buka - sekarang)} (mulai {jamMenit(u.dibuka_pada)} WITA)</span>
                                </div>
                            ) : (
                                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200 backdrop-blur-md border border-white/15">
                                    <span>Ujian Telah Selesai</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            <main className="relative z-10 -mt-5 sm:-mt-6 mx-auto max-w-xl space-y-4 px-3 sm:px-4">
                {/* Student & Exam Details Card */}
                <div className="rounded-lg border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm space-y-3.5">
                    <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                        <FotoMurid nama={u.murid.nama} foto={u.murid.foto} ukuran="md" className="ring-2 ring-primary/20 bg-white" />
                        <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Peserta Ujian</p>
                            <p className="font-bold text-ink text-sm sm:text-base leading-snug truncate">{u.murid.nama}</p>
                        </div>
                    </div>

                    <dl className="grid grid-cols-2 gap-2 sm:gap-3">
                        <Butir
                            ikon={<Clock className="size-3.5 text-primary" />}
                            label="Jadwal (WITA)"
                            isi={`${hariTanggal(u.dibuka_pada)}, ${jamMenit(u.dibuka_pada)}–${jamMenit(u.ditutup_pada)} WITA`}
                        />
                        <Butir
                            ikon={<ListChecks className="size-3.5 text-primary" />}
                            label="Soal &amp; Durasi"
                            isi={`${u.jumlah_soal} Soal · ${u.durasi_menit + u.tambahan_waktu_menit} Menit`}
                        />
                        <Butir
                            ikon={<MapPin className="size-3.5 text-primary" />}
                            label="Sesi &amp; Ruang"
                            isi={u.sesi ? `${u.sesi.nama}${u.sesi.ruang ? ` · ${u.sesi.ruang}` : ''}` : '—'}
                        />
                        <Butir
                            ikon={<LocateFixed className="size-3.5 text-primary" />}
                            label="Ketentuan Lokasi"
                            isi={wajibLokasi ? `Sekolah (${u.lokasi.radius_meter ? `${u.lokasi.radius_meter}m` : 'area'})` : 'Dari mana saja'}
                        />
                    </dl>
                </div>

                {/* Tata Tertib Card */}
                <div className="rounded-lg border border-slate-200/90 bg-white p-4 sm:p-5 shadow-sm space-y-3">
                    <h2 className="text-sm sm:text-base font-bold text-ink">Tata Tertib &amp; Peraturan Ujian</h2>
                    <div className="space-y-2">
                        <Aturan ikon={<BellOff className="size-3.5" />}>Nyalakan mode Jangan Ganggu dan tutup semua aplikasi lain.</Aturan>
                        <Aturan ikon={<ShieldCheck className="size-3.5" />}>Jangan keluar dari aplikasi atau berpindah layar — tercatat sebagai pelanggaran.</Aturan>
                        {u.level_keamanan === 'lockdown' && (
                            <Aturan ikon={<ShieldCheck className="size-3.5" />}>Ujian Lockdown: memuat ulang atau menutup aplikasi langsung mengunci ujian.</Aturan>
                        )}
                        {wajibLokasi && (
                            <Aturan ikon={<LocateFixed className="size-3.5" />}>Ujian wajib di area sekolah. Posisimu dicek berkala via GPS.</Aturan>
                        )}
                        <Aturan ikon={<Wifi className="size-3.5" />}>Jawaban tersimpan otomatis di perangkat walau internet putus.</Aturan>
                        <Aturan ikon={<Clock className="size-3.5" />}>Waktu mengikuti jam server WITA; ujian terkumpul otomatis saat waktu habis.</Aturan>
                    </div>
                </div>

                {/* Kesiapan Perangkat */}
                <KartuKesiapan
                    daftar={kesiapan.daftar}
                    penghalang={kesiapan.penghalang}
                    onAksi={(a) => {
                        const tautan = platform() !== 'pwa' ? aplikasi?.tautan_pembaruan[platform() as 'android' | 'ios'] : null
                        if (a === 'perbarui') void (tautan ? location.assign(tautan) : terapkanPembaruan())
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
                    <div className="rounded-lg border border-slate-200/90 bg-white p-5 shadow-sm">
                        <Tombol
                            ukuran="lg"
                            penuh
                            className="rounded-lg font-bold py-3.5 shadow-md shadow-primary/25"
                            onClick={() => {
                                void masukLayarPenuh()
                                if (u.level_keamanan !== 'dasar') void kunciLayar()
                                lanjutLokal()
                            }}
                        >
                            Lanjutkan Ujian
                        </Tombol>
                    </div>
                ) : (
                    <div className="rounded-lg border border-slate-200/90 bg-white p-4 sm:p-6 shadow-sm space-y-4">
                        <KartuUnduh ujian={u} status={status} onUnduh={unduh} />

                        {wajibLokasi && <KartuLokasi status={lokasi.status} radius={u.lokasi.radius_meter} onCari={lokasi.cari} />}

                        <div className={cn('space-y-2 text-center pt-3 border-t border-slate-100', !siap && 'opacity-50')}>
                            <p className="text-sm font-bold text-ink">Masukkan Token Ujian</p>
                            <p className="text-xs text-slate-500">Tanyakan 6 karakter token kepada guru/pengawas di ruangan</p>
                            <div key={goyang} className={cn('pt-1', goyang ? 'animate-goyang' : undefined)}>
                                <KotakToken nilai={token} onUbah={setToken} galat={!!galatMulai && token.length === 0} nonaktif={!siap || selesai || mulai.isPending} />
                            </div>
                        </div>

                        {galatMulai && (
                            <p role="alert" className="flex items-center gap-2 rounded-lg bg-coral-50 border border-coral-200 px-3.5 py-2.5 text-xs font-semibold text-coral-700">
                                <AlertTriangle className="size-4 shrink-0" />
                                <span>{galatMulai}</span>
                            </p>
                        )}

                        <Tombol
                            ukuran="lg"
                            penuh
                            disabled={!bisaMulai}
                            className="rounded-lg font-bold py-3.5 shadow-md shadow-primary/25 transition active:scale-[0.98]"
                            onClick={() => mulai.mutate(masukLayarPenuh())}
                        >
                            {mulai.isPending ? 'Memulai Ujian…' : u.status === 'mengerjakan' ? 'Lanjutkan Ujian Sekarang' : 'Mulai Ujian Sekarang'}
                        </Tombol>

                        <p className="text-center text-xs text-slate-500">
                            {selesai
                                ? 'Ujian ini sudah dikumpulkan.'
                                : sekarang < buka
                                  ? `Ujian dibuka dalam ${durasiLengkap(buka - sekarang)}.`
                                  : sekarang > tutup
                                    ? 'Ujian sudah ditutup.'
                                    : !siap
                                      ? 'Tombol aktif setelah paket soal selesai diunduh.'
                                      : !perangkatSiap
                                        ? `Perbaiki dulu: ${kesiapan.penghalang.map((i) => i.judul.toLowerCase()).join(', ')}.`
                                        : !lokasiSiap
                                        ? 'Tombol aktif setelah posisimu didapat.'
                                        : token.length < 6
                                        ? 'Masukkan 6 karakter token ujian.'
                                        : !online
                                          ? 'Tombol aktif setelah tersambung ke internet.'
                                          : 'Siap. Waktu ujian mulai berjalan setelah kamu menekan tombol Mulai.'}
                        </p>
                    </div>
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
                <p className="text-sm text-slate-500">Paket bisa diunduh 30 menit sebelum ujian dibuka ({jamMenit(ujian.dibuka_pada, true)}).</p>
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
        <div className="rounded-lg bg-slate-50/80 p-2.5 sm:p-3 border border-slate-100 flex flex-col justify-between">
            <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                {ikon}
                <span>{label}</span>
            </dt>
            <dd className="mt-1 font-bold text-ink text-xs sm:text-sm leading-snug">{isi}</dd>
        </div>
    )
}

function Aturan({ ikon, children }: { ikon: ReactNode; children: ReactNode }) {
    return (
        <div className="flex items-start gap-2.5 rounded-lg bg-slate-50/60 p-2.5 border border-slate-100/80">
            <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{ikon}</span>
            <span className="text-xs text-slate-600 leading-relaxed">{children}</span>
        </div>
    )
}
