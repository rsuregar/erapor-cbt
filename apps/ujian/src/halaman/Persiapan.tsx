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
import { ambilPaket, daftarUjian, sesiLokalUjian, simpanPaket, simpanSesi } from '@/lib/ujian'
import { useOnline } from '@/lib/useOnline'
import { terapkanPembaruan, useKesiapan } from '@/lib/useKesiapan'
import { useLokasi, type TahapLokasi } from '@/lib/useLokasi'
import { useUnduhPaket, type TahapUnduh } from '@/lib/useUnduhPaket'
import { cn } from '@/lib/utils'
import { dekripsiPaket, GalatApi, type UjianRingkas } from '@erapor-cbt/exam-core'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, BellOff, CheckCircle2, ChevronDown, ChevronLeft, Clock, DownloadCloud, ListChecks, Loader2, LocateFixed, MapPin, RotateCw, ShieldCheck, Wifi } from 'lucide-react'
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
    // Server membedakan "ujian ditutup" dan "sesi dihentikan pengawas" lewat pesannya.
    if (e.kode === 'SUDAH_DITUTUP') return e.message || PESAN_MULAI.SUDAH_DITUTUP

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
    const ujian = useQuery({
        queryKey: ['ujian'],
        queryFn: daftarUjian,
        select: (d) => ({
            u: d.data.find((u) => u.id === ujianId),
            aplikasi: d.aplikasi,
            // Belum pernah ikut ujian lain: tata tertib dibuka lebar.
            pertama: !d.data.some((x) => x.id !== ujianId && x.status !== 'belum_mulai'),
        }),
        networkMode: 'always',
    })
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
            // Paket bisa hilang setelah kartu "siap" tampil (mis. tab lain menyelesaikan /
            // membersihkan ujian yang sama). Jangan buntu: unduh ulang — paketnya terenkripsi
            // dan kecocokannya diperiksa saat dekripsi di bawah.
            let paket = await ambilPaket(ujianId)
            if (!paket) {
                paket = await api.paket(ujianId)
                await simpanPaket(ujianId, paket)
            }
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
    const melanjutkan = u.status === 'mengerjakan'
    const lockdown = u.level_keamanan === 'lockdown'
    // Lebih dari 30 menit sebelum dibuka: paket pun belum bisa diunduh — tampilkan keadaan tenang.
    const masihLama = !selesai && sekarang < buka - 30 * 60_000
    const lokasiSiap = !wajibLokasi || lokasi.status.tahap === 'siap'
    const perangkatSiap = kesiapan.penghalang.length === 0
    const bisaMulai = online && perangkatSiap && siap && lokasiSiap && dibuka && !selesai && token.length === 6 && !mulai.isPending
    const offlineLokal = !online && !!lokal.data
    const galatMulai = mulai.error ? pesanGalatMulai(mulai.error) : null
    /** Ujian ditutup / sesi dihentikan pengawas (410): tidak ada yang bisa dicoba lagi di layar ini. */
    const sesiDitutup = mulai.error instanceof GalatApi && mulai.error.kode === 'SUDAH_DITUTUP'
    const durasi = u.durasi_menit + u.tambahan_waktu_menit

    /** Yang masih menahan tombol Mulai, masing-masing menunjuk ke barisnya di kartu "Sebelum mulai". */
    const belumSiap: { label: string; ke: string }[] = [
        ...(!siap ? [{ label: 'Paket soal', ke: 'cek-paket' }] : []),
        ...(wajibLokasi && !lokasiSiap ? [{ label: 'Lokasi', ke: 'cek-lokasi' }] : []),
        ...kesiapan.penghalang.map((i) => ({ label: i.judul, ke: 'cek-perangkat' })),
    ]

    const petunjuk: ReactNode = selesai ? (
        'Ujian ini sudah dikumpulkan.'
    ) : sekarang > tutup ? (
        'Ujian sudah ditutup.'
    ) : sekarang < buka ? (
        `Ujian dibuka pukul ${jamMenit(u.dibuka_pada)} WITA (${durasiLengkap(buka - sekarang)}).`
    ) : belumSiap.length ? (
        <>
            Belum bisa mulai — periksa:{' '}
            {belumSiap.map((b, i) => (
                <span key={b.label}>
                    {i > 0 && ', '}
                    <button type="button" className="font-semibold text-primary underline underline-offset-2" onClick={() => tuju(b.ke)}>
                        {b.label}
                    </button>
                </span>
            ))}
        </>
    ) : token.length < 6 ? (
        token.length ? `Token: ${token.length} dari 6 karakter.` : 'Masukkan 6 karakter token dari pengawas.'
    ) : !online ? (
        'Tombol aktif setelah tersambung ke internet.'
    ) : melanjutkan ? (
        'Siap. Tekan tombol untuk kembali ke soalmu.'
    ) : (
        'Siap. Waktu ujian mulai berjalan setelah kamu menekan Mulai.'
    )

    return (
        <div className="min-h-full bg-slate-50/70">
            <header className="permukaan-gelap relative overflow-hidden rounded-b-[1.75rem] bg-gradient-to-br from-[#0B486F] via-[#006195] to-[#004B74] px-4 pb-10 pt-2 text-white shadow-lg sm:rounded-b-[2.5rem] sm:px-6">
                <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-white/5 blur-3xl" aria-hidden="true" />

                <div className="relative mx-auto max-w-xl space-y-3">
                    <div className="flex items-center justify-between gap-3">
                        <button
                            onClick={() => navigate({ to: '/' })}
                            className="-ml-2 inline-flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-semibold text-white transition hover:bg-white/10 active:scale-95"
                        >
                            <ChevronLeft className="size-5" />
                            <span>Kembali</span>
                        </button>
                        <IndikatorKoneksi online={online} tema="gelap" />
                    </div>

                    <div className="space-y-2">
                        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-semibold text-sky-100">
                            {u.mapel && <span className="uppercase tracking-wide">{u.mapel}</span>}
                            {u.mapel && <span aria-hidden>·</span>}
                            <span className="inline-flex items-center gap-1">
                                <ShieldCheck className="size-3.5" />
                                Mode {KEAMANAN[u.level_keamanan]}
                            </span>
                        </p>
                        <h1 className="font-display text-xl font-extrabold tracking-tight text-white sm:text-2xl">{u.nama}</h1>
                        <div className="flex items-center gap-2.5">
                            <FotoMurid nama={u.murid.nama} foto={u.murid.foto} ukuran="sm" className="bg-white ring-white/60" />
                            <p className="min-w-0 text-sm text-sky-50">
                                <span className="block truncate font-semibold text-white">{u.murid.nama}</span>
                                <span>
                                    {u.jumlah_soal} soal · {durasi} menit
                                </span>
                            </p>
                        </div>
                        <ChipWaktu u={u} sekarang={sekarang} />
                    </div>
                </div>
            </header>

            <main className="relative z-10 -mt-6 px-3 sm:px-6">
                <div className="mx-auto max-w-xl space-y-3 pb-4">
                    {!online && (
                        <SpanduOffline>
                            {lokal.data
                                ? 'Ujian ini sudah kamu mulai di perangkat ini — lanjutkan tanpa token; jawaban terkirim otomatis saat tersambung.'
                                : 'Memulai ujian butuh internet untuk memeriksa token. Paket soal yang sudah diunduh tetap tersimpan.'}
                        </SpanduOffline>
                    )}

                    {masihLama && <KartuBelumDibuka u={u} sekarang={sekarang} wajibLokasi={wajibLokasi} onPanduan={() => void navigate({ to: '/panduan' })} />}

                    {/* Satu ringkasan kesiapan: paket, lokasi, perangkat. */}
                    <section aria-labelledby="judul-sebelum" className="space-y-4 rounded-lg border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5">
                        <h2 id="judul-sebelum" className="text-base font-bold text-ink">
                            Sebelum mulai
                        </h2>
                        <KartuUnduh id="cek-paket" ujian={u} status={status} onUnduh={unduh} />
                        {wajibLokasi && <KartuLokasi id="cek-lokasi" status={lokasi.status} radius={u.lokasi.radius_meter} onCari={lokasi.cari} />}
                        <div className="border-t border-slate-100 pt-4">
                            <KartuKesiapan
                                id="cek-perangkat"
                                daftar={kesiapan.daftar}
                                penghalang={kesiapan.penghalang}
                                onAksi={(a) => {
                                    const tautan = platform() !== 'pwa' ? aplikasi?.tautan_pembaruan[platform() as 'android' | 'ios'] : null
                                    if (a === 'perbarui') void (tautan ? location.assign(tautan) : terapkanPembaruan())
                                    else if (a === 'layar_penuh') void masukLayarPenuh()
                                    else if (a === 'panduan') void navigate({ to: '/panduan' })
                                }}
                            />
                        </div>
                    </section>

                    {!offlineLokal && !masihLama && !selesai && (
                        <section aria-labelledby="judul-token" className="space-y-3 rounded-lg border border-slate-200/90 bg-white p-4 text-center shadow-sm sm:p-5">
                            <h2 id="judul-token" className="text-base font-bold text-ink">
                                {melanjutkan ? 'Token untuk melanjutkan' : 'Token ujian'}
                            </h2>
                            <p className="text-sm text-slate-600">
                                {melanjutkan
                                    ? 'Waktumu sudah berjalan sejak kamu mulai. Masukkan token untuk melanjutkan.'
                                    : 'Tanyakan 6 karakter token kepada pengawas di ruangan.'}
                            </p>
                            <div key={goyang} className={cn('pt-1', goyang ? 'animate-goyang motion-reduce:animate-none' : undefined)}>
                                <KotakToken
                                    nilai={token}
                                    onUbah={setToken}
                                    galat={!!galatMulai && token.length === 0}
                                    nonaktif={!siap || mulai.isPending}
                                    fokusOtomatis={siap && dibuka && perangkatSiap && lokasiSiap}
                                />
                            </div>
                            {!siap && <p className="text-xs text-slate-500">Kotak token aktif setelah paket soal selesai diunduh.</p>}

                            {galatMulai && (
                                <div role="alert" className="space-y-2.5 rounded-lg border border-coral-200 bg-coral-50 px-3.5 py-2.5 text-left text-sm font-semibold text-coral-700">
                                    <p className="flex items-start gap-2">
                                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                                        <span>{galatMulai}</span>
                                    </p>
                                    {sesiDitutup && (
                                        <Tombol varian="outline" ukuran="sm" penuh onClick={() => void navigate({ to: '/' })} ikonKiri={<ChevronLeft className="size-4" />}>
                                            Kembali ke Beranda
                                        </Tombol>
                                    )}
                                </div>
                            )}
                        </section>
                    )}

                    <TataTertib terbuka={u.status === 'belum_mulai' && (ujian.data?.pertama ?? false)} lockdown={lockdown} wajibLokasi={wajibLokasi} />

                    <details className="group rounded-lg border border-slate-200/90 bg-white shadow-sm">
                        <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-bold text-ink sm:px-5 [&::-webkit-details-marker]:hidden">
                            <span className="mr-auto">Detail ujian</span>
                            <ChevronDown className="size-4 text-slate-500 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                        </summary>
                        <dl className="grid grid-cols-1 gap-2 px-4 pb-4 sm:grid-cols-2 sm:px-5 sm:pb-5">
                            <Butir ikon={<Clock className="size-3.5 text-primary" />} label="Jadwal" isi={`${hariTanggal(u.dibuka_pada)}, ${jamMenit(u.dibuka_pada)}–${jamMenit(u.ditutup_pada)} WITA`} />
                            <Butir ikon={<ListChecks className="size-3.5 text-primary" />} label="Soal & durasi" isi={`${u.jumlah_soal} soal · ${durasi} menit`} />
                            <Butir ikon={<MapPin className="size-3.5 text-primary" />} label="Sesi & ruang" isi={u.sesi ? `${u.sesi.nama}${u.sesi.ruang ? ` · ${u.sesi.ruang}` : ''}` : '—'} />
                            <Butir
                                ikon={<LocateFixed className="size-3.5 text-primary" />}
                                label="Tempat mengerjakan"
                                isi={wajibLokasi ? `Di sekolah${u.lokasi.radius_meter ? ` (radius ${u.lokasi.radius_meter} m)` : ''}` : 'Dari mana saja'}
                            />
                        </dl>
                    </details>
                </div>

                {/* Tombol Mulai menempel di bawah layar: di HP tetap terlihat walau kartu di atas panjang. */}
                {!masihLama && (
                    <div className="sticky bottom-0 z-20 -mx-3 border-t border-slate-200/80 bg-white/95 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 backdrop-blur sm:-mx-6 sm:px-6">
                        <div className="mx-auto max-w-xl space-y-2">
                            {offlineLokal ? (
                                <Tombol
                                    ukuran="lg"
                                    penuh
                                    onClick={() => {
                                        void masukLayarPenuh()
                                        if (u.level_keamanan !== 'dasar') void kunciLayar()
                                        lanjutLokal()
                                    }}
                                >
                                    Lanjutkan Ujian
                                </Tombol>
                            ) : (
                                !selesai && (
                                    <>
                                        {lockdown && bisaMulai && (
                                            <p className="flex items-start gap-1.5 text-left text-xs font-semibold text-amber-700">
                                                <ShieldCheck className="mt-px size-4 shrink-0" />
                                                Mode Lockdown: menutup atau memuat ulang aplikasi langsung mengunci ujian.
                                            </p>
                                        )}
                                        <Tombol ukuran="lg" penuh disabled={!bisaMulai} aria-describedby="petunjuk-mulai" onClick={() => mulai.mutate(masukLayarPenuh())}>
                                            {mulai.isPending ? 'Memulai…' : melanjutkan ? 'Lanjutkan Ujian' : 'Mulai Ujian'}
                                        </Tombol>
                                    </>
                                )
                            )}
                            <p id="petunjuk-mulai" aria-live="polite" className="text-center text-sm text-slate-600">
                                {offlineLokal ? 'Jawabanmu tersimpan di perangkat ini.' : petunjuk}
                            </p>
                        </div>
                    </div>
                )}
            </main>
        </div>
    )
}

/** Gulir ke baris kesiapan yang belum beres, lalu pindahkan fokus ke sana (pembaca layar ikut). */
function tuju(id: string) {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' })
    el.focus({ preventScroll: true })
}

/** Jam tutup, bukan hitung mundur per detik — sisa waktu baru muncul saat tinggal 15 menit. */
function ChipWaktu({ u, sekarang }: { u: UjianRingkas; sekarang: number }) {
    const buka = Date.parse(u.dibuka_pada)
    const tutup = Date.parse(u.ditutup_pada)
    const kelas = 'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold'

    if (u.status === 'selesai') return <span className={cn(kelas, 'border-white/20 bg-white/10 text-sky-50')}>Ujian sudah dikumpulkan</span>
    if (sekarang > tutup) return <span className={cn(kelas, 'border-white/20 bg-white/10 text-sky-50')}>Jadwal ujian sudah ditutup</span>
    if (sekarang < buka) {
        return (
            <span className={cn(kelas, 'border-amber-300/40 bg-amber-400/15 text-amber-100')}>
                <Clock className="size-3.5" /> Dibuka {hariTanggal(u.dibuka_pada)}, {jamMenit(u.dibuka_pada)} WITA
            </span>
        )
    }
    if (tutup - sekarang < 15 * 60_000) {
        return (
            <span className={cn(kelas, 'border-amber-300/40 bg-amber-400/15 text-amber-100')}>
                <Clock className="size-3.5" /> Jadwal ditutup {durasiLengkap(tutup - sekarang)} (pukul {jamMenit(u.ditutup_pada)})
            </span>
        )
    }

    return (
        <span className={cn(kelas, 'border-green-500/40 bg-green-500/15 text-green-100')}>
            <span className="size-1.5 rounded-full bg-green-500" aria-hidden /> Berlangsung · jadwal ditutup pukul {jamMenit(u.ditutup_pada)} WITA
        </span>
    )
}

/** Lebih dari 30 menit sebelum dibuka: jam buka besar + yang bisa disiapkan sekarang, tanpa tombol mati. */
function KartuBelumDibuka({ u, sekarang, wajibLokasi, onPanduan }: { u: UjianRingkas; sekarang: number; wajibLokasi: boolean; onPanduan: () => void }) {
    const sisa = Date.parse(u.dibuka_pada) - sekarang
    // Tanpa detik: hitung mundur yang berdetak hanya membuat cemas.
    const kasar = sisa >= 60 * 60_000 ? durasiLengkap(sisa - (sisa % (60 * 60_000))).replace(' lagi', '') : `${Math.ceil(sisa / 60_000)} menit`

    return (
        <section aria-labelledby="judul-belum-dibuka" className="space-y-4 rounded-lg border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5">
            <div>
                <h2 id="judul-belum-dibuka" className="text-sm font-semibold text-slate-600">
                    Ujian belum dibuka
                </h2>
                <p className="mt-1 font-display text-h3 font-extrabold text-ink">
                    {hariTanggal(u.dibuka_pada)}, {jamMenit(u.dibuka_pada)} WITA
                </p>
                <p className="text-sm text-slate-600">Sekitar {kasar} lagi. Paket soal bisa diunduh 30 menit sebelumnya.</p>
            </div>
            <div className="space-y-2">
                <p className="text-sm font-bold text-ink">Yang bisa kamu siapkan sekarang</p>
                <ul className="space-y-1.5 text-sm text-slate-700">
                    <li className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> Isi daya baterai sampai penuh.
                    </li>
                    <li className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> Pastikan aplikasi ujian sudah versi terbaru.
                    </li>
                    {wajibLokasi && (
                        <li className="flex gap-2">
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> Ujian ini dikerjakan di sekolah — nyalakan GPS di perangkatmu.
                        </li>
                    )}
                    <li className="flex gap-2">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> Pelajari cara membuka aplikasi dan mengunci layar.
                    </li>
                </ul>
            </div>
            <Tombol varian="outline" ukuran="sm" className="min-h-11" onClick={onPanduan}>
                Buka panduan
            </Tombol>
        </section>
    )
}

/** Tata tertib: terbuka di ujian pertama murid, dilipat sesudahnya. */
function TataTertib({ terbuka, lockdown, wajibLokasi }: { terbuka: boolean; lockdown: boolean; wajibLokasi: boolean }) {
    return (
        <details open={terbuka || undefined} className="group rounded-lg border border-slate-200/90 bg-white shadow-sm">
            <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-bold text-ink sm:px-5 [&::-webkit-details-marker]:hidden">
                <span className="mr-auto">Tata tertib ujian</span>
                <ChevronDown className="size-4 text-slate-500 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
            </summary>
            <div className="space-y-2 px-4 pb-4 sm:px-5 sm:pb-5">
                <Aturan ikon={<BellOff className="size-3.5" />}>Nyalakan mode Jangan Ganggu dan tutup aplikasi lain.</Aturan>
                <Aturan ikon={<ShieldCheck className="size-3.5" />}>Tetap di layar ujian sampai selesai. Keluar aplikasi atau pindah layar akan tercatat.</Aturan>
                {lockdown && <Aturan ikon={<ShieldCheck className="size-3.5" />}>Jangan muat ulang atau menutup aplikasi — ujian Lockdown langsung terkunci.</Aturan>}
                {wajibLokasi && <Aturan ikon={<LocateFixed className="size-3.5" />}>Kerjakan di area sekolah. Posisimu dicek berkala.</Aturan>}
                <Aturan ikon={<Wifi className="size-3.5" />}>Internet putus? Tenang, jawabanmu tetap tersimpan di perangkat.</Aturan>
                <Aturan ikon={<Clock className="size-3.5" />}>Waktu mengikuti jam sekolah (WITA). Jawaban terkumpul otomatis saat waktu habis.</Aturan>
            </div>
        </details>
    )
}

function KartuUnduh({ id, ujian, status, onUnduh }: { id: string; ujian: UjianRingkas; status: TahapUnduh; onUnduh: () => void }) {
    const [lencana, nada] =
        status.tahap === 'siap'
            ? (['Siap', 'green'] as const)
            : status.tahap === 'galat'
              ? (['Gagal', 'red'] as const)
              : status.tahap === 'paket' || status.tahap === 'media' || status.tahap === 'menunggu'
                ? (['Mengunduh', 'sky'] as const)
                : ujian.bisa_unduh
                  ? (['Siap diunduh', 'sky'] as const)
                  : (['Belum tersedia', 'neutral'] as const)

    return (
        <section id={id} tabIndex={-1} aria-labelledby="judul-paket" className="scroll-mt-4 space-y-3 outline-none">
            <div className="flex items-center gap-2 text-sm">
                {status.tahap === 'siap' ? <CheckCircle2 className="size-5 text-green-500" /> : <DownloadCloud className="size-5 text-primary" />}
                <h3 id="judul-paket" className="mr-auto text-sm font-semibold">
                    Paket soal
                </h3>
                <Lencana nada={nada} aria-live="polite">
                    {lencana}
                </Lencana>
            </div>

            {status.tahap === 'belum' && !ujian.bisa_unduh && (
                <p className="text-sm text-slate-600">Paket bisa diunduh 30 menit sebelum ujian dibuka ({jamMenit(ujian.dibuka_pada, true)}).</p>
            )}

            {status.tahap === 'menunggu' && (
                <div className="flex items-center gap-3 text-sm text-slate-600">
                    <span className="mr-auto">Paket diunduh otomatis sebentar lagi.</span>
                    <Tombol varian="secondary" ukuran="sm" className="min-h-11" onClick={onUnduh}>
                        Unduh sekarang
                    </Tombol>
                </div>
            )}

            {status.tahap === 'paket' && (
                <div className="space-y-1.5">
                    <Progres nilai={status.total ? status.diterima / status.total : null} />
                    <p className="flex justify-between text-xs text-slate-600">
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
                    <p className="flex justify-between text-xs text-slate-600">
                        <span>Mengunduh gambar soal…</span>
                        <span className="font-semibold tabular-nums">
                            {status.selesai} / {status.total}
                        </span>
                    </p>
                </div>
            )}


            {status.tahap === 'galat' && (
                <div className="flex items-center gap-3">
                    <p className="mr-auto text-sm text-coral-600">{status.pesan}</p>
                    <Tombol varian="outline" ukuran="sm" className="min-h-11" ikonKiri={<RotateCw className="size-4" />} onClick={onUnduh}>
                        Coba lagi
                    </Tombol>
                </div>
            )}
        </section>
    )
}

function KartuLokasi({ id, status, radius, onCari }: { id: string; status: TahapLokasi; radius: number | null; onCari: () => void }) {
    const lemah = status.tahap === 'siap' && status.posisi.akurasi_m > BATAS_AKURASI_M
    const [lencana, nada] =
        status.tahap === 'siap'
            ? lemah
                ? (['Sinyal lemah', 'amber'] as const)
                : (['Siap', 'green'] as const)
            : status.tahap === 'mencari'
              ? (['Mencari…', 'sky'] as const)
              : status.tahap === 'galat'
                ? (['Belum didapat', 'red'] as const)
                : (['Perlu izin', 'neutral'] as const)

    return (
        <section id={id} tabIndex={-1} aria-labelledby="judul-lokasi" className="scroll-mt-4 space-y-3 border-t border-slate-100 pt-4 outline-none">
            <div className="flex items-center gap-2 text-sm">
                {status.tahap === 'siap' && !lemah ? <CheckCircle2 className="size-5 text-green-500" /> : <LocateFixed className="size-5 text-primary" />}
                <h3 id="judul-lokasi" className="mr-auto text-sm font-semibold">
                    Lokasi
                </h3>
                <Lencana nada={nada} aria-live="polite">
                    {lencana}
                </Lencana>
                {status.tahap === 'siap' && !lemah && (
                    <button type="button" onClick={onCari} aria-label="Perbarui posisi" className="-my-2 -mr-2 inline-flex size-11 items-center justify-center rounded-sm text-primary hover:bg-primary-50">
                        <RotateCw className="size-4" />
                    </button>
                )}
            </div>

            {status.tahap === 'belum' && (
                <div className="flex items-center gap-3">
                    <p className="mr-auto text-sm text-slate-600">
                        Ujian ini dikerjakan di sekolah{radius ? ` (radius ${radius} m)` : ''}. Lokasi belum diizinkan — ketuk Izinkan, lalu pilih Izinkan.
                    </p>
                    <Tombol varian="secondary" ukuran="sm" className="min-h-11" onClick={onCari}>
                        Izinkan
                    </Tombol>
                </div>
            )}

            {status.tahap === 'mencari' && (
                <p className="flex items-center gap-2 text-sm text-slate-600">
                    <Loader2 className="size-4 animate-spin motion-reduce:animate-none" /> Mencari posisi… di dalam gedung bisa butuh beberapa detik.
                </p>
            )}

            {lemah && (
                <div className="flex items-center gap-3">
                    <p className="mr-auto text-sm text-amber-700">Sinyal GPS lemah. Pindah ke dekat jendela, lalu ketuk Perbarui.</p>
                    <Tombol varian="outline" ukuran="sm" className="min-h-11" ikonKiri={<RotateCw className="size-4" />} onClick={onCari}>
                        Perbarui
                    </Tombol>
                </div>
            )}

            {status.tahap === 'galat' && (
                <div className="space-y-2">
                    <p className="text-sm text-coral-600">{PESAN_LOKASI_PERANGKAT[status.kode]}</p>
                    {status.kode === 'DITOLAK' && <p className="text-xs text-slate-600">{petunjukIzin()}</p>}
                    {status.kode !== 'TIDAK_DIDUKUNG' && (
                        <Tombol varian="outline" ukuran="sm" className="min-h-11" ikonKiri={<RotateCw className="size-4" />} onClick={onCari}>
                            Coba lagi
                        </Tombol>
                    )}
                </div>
            )}
        </section>
    )
}

function Butir({ ikon, label, isi }: { ikon: ReactNode; label: string; isi: ReactNode }) {
    return (
        <div className="rounded-sm border border-slate-100 bg-slate-50/80 p-3">
            <dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                {ikon}
                <span>{label}</span>
            </dt>
            <dd className="mt-1 text-sm font-bold leading-snug text-ink">{isi}</dd>
        </div>
    )
}

function Aturan({ ikon, children }: { ikon: ReactNode; children: ReactNode }) {
    return (
        <div className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-sm bg-primary/10 text-primary">{ikon}</span>
            <span className="text-sm leading-relaxed text-slate-700">{children}</span>
        </div>
    )
}
