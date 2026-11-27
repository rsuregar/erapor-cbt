import {
    bolehTampilDebugStaging,
    buatCeklisAwal,
    formatWaktuDebug,
    perbaruiCeklis,
    tambahLogDebug,
    TEKS_CONTOH_SOAL_DEBUG,
    type EntriLogDebug,
    type ItemCeklisDebug,
    type KunciCeklisDebug,
    type StatusCeklisDebug,
} from '@/lib/debugPelanggaran'
import {
    harusKonfirmasiBlur,
    harusPantauBlurWindow,
    harusPantauLayarDibagi,
    INTERVAL_CEK_FOKUS_IOS_MS,
    KONFIRMASI_BLUR_IOS_MS,
} from '@/lib/deteksiKepergian'
import { STAGING } from '@/lib/lingkungan'
import { isNative } from '@/lib/native'
import { jenisPerangkat, layarDibagi, masukLayarPenuh, standalone } from '@/lib/perangkat'
import { adalahPintasanCopas, terdeteksiTempel } from '@/lib/proteksiSalin'
import {
    pasangPengawasKepergian,
    pasangPengawasLayarDibagi,
    pasangPengawasLayarPenuh,
} from '@/lib/usePelanggaran'
import { pasangProteksiKonten } from '@/lib/useProteksiKonten'
import { cn } from '@/lib/utils'
import { useRouterState } from '@tanstack/react-router'
import { AlertTriangle, CheckCircle2, FlaskConical, Maximize, RotateCcw, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'

const KUNCI_SIMPAN_AKTIF = 'cbt:staging:debug-pelanggaran'

type TelemetriLayar = {
    perangkat: string
    standalone: boolean
    screen: string
    inner: string
    vv: string
    orientasi: string
    visibility: string
    hasFocus: boolean
    layarDibagi: boolean
    pantauBlur: boolean
}

function bacaTelemetri(): TelemetriLayar {
    const jenis = jenisPerangkat()
    const pantauBlur = harusPantauBlurWindow({ adaNative: false, isTauri: false, jenisPerangkat: jenis })
    const vv = typeof visualViewport !== 'undefined' ? visualViewport : null
    const winOrient =
        typeof window !== 'undefined' ? (window as Window & { orientation?: number }).orientation : undefined
    const orientasi =
        (typeof screen !== 'undefined' ? screen.orientation?.type : undefined) ??
        (typeof winOrient === 'number' ? `win:${winOrient}` : '-')

    return {
        perangkat: jenis,
        standalone: standalone(),
        screen: typeof screen !== 'undefined' ? `${screen.width}×${screen.height}` : '-',
        inner: `${innerWidth}×${innerHeight}`,
        vv: vv ? `${Math.round(vv.width)}×${Math.round(vv.height)} (${vv.scale.toFixed(2)}x)` : '-',
        orientasi,
        visibility: document.visibilityState,
        hasFocus: document.hasFocus(),
        layarDibagi: layarDibagi(),
        pantauBlur,
    }
}

function bacaStatusAwal(): boolean {
    try {
        return localStorage.getItem(KUNCI_SIMPAN_AKTIF) === '1'
    } catch {
        return false
    }
}

export function DebugPelanggaranStaging() {
    if (!bolehTampilDebugStaging({ staging: STAGING, native: isNative() })) return null

    return <PanelDebugStaging />
}

function PanelDebugStaging() {
    const pathname = useRouterState({ select: (s) => s.location.pathname })
    const diHalamanSoal = pathname.startsWith('/kerjakan')

    const [aktif, setAktif] = useState<boolean>(bacaStatusAwal)
    const [buka, setBuka] = useState(false)
    const [tampilkanTirai, setTampilkanTirai] = useState(true)
    const [ceklis, setCeklis] = useState<ItemCeklisDebug[]>(buatCeklisAwal)
    const [log, setLog] = useState<EntriLogDebug[]>([])
    const [layarTerbagi, setLayarTerbagi] = useState(false)
    const [tidakFokus, setTidakFokus] = useState(false)
    const [pesanProteksi, setPesanProteksi] = useState<string | null>(null)
    const [jawabanUji, setJawabanUji] = useState('')
    const [telemetri, setTelemetri] = useState<TelemetriLayar>(() => bacaTelemetri())

    const mulaiRef = useRef(Date.now())
    const logIdRef = useRef(0)
    const timerToastRef = useRef<ReturnType<typeof setTimeout>>()
    const sedangPergiRef = useRef(false)
    const sudahCatatSplitRef = useRef(false)
    const sumberPergiRef = useRef<'hidden' | 'blur' | null>(null)
    const laporTempelRef = useRef<((alasan?: 'salin_soal' | 'tempel_massal') => void) | null>(null)
    const terakhirUndoRef = useRef(-Infinity)
    const sedangKomposisiRef = useRef(false)
    const terakhirKomposisiRef = useRef(-Infinity)

    const tandaiCeklis = useCallback(
        (
            kunci: KunciCeklisDebug,
            status: Exclude<StatusCeklisDebug, 'belum'>,
            kategori: string,
            pesan: string,
        ) => {
            const waktu = formatWaktuDebug()
            setCeklis((prev) => perbaruiCeklis(prev, kunci, status, pesan, waktu))
            logIdRef.current += 1
            const id = logIdRef.current
            setLog((prev) => tambahLogDebug(prev, kategori, pesan, waktu, id))
        },
        [],
    )

    const kabari = useCallback((teks: string) => {
        setPesanProteksi(teks)
        clearTimeout(timerToastRef.current)
        timerToastRef.current = setTimeout(() => setPesanProteksi(null), 3000)
    }, [])

    useEffect(() => () => clearTimeout(timerToastRef.current), [])

    const ubahAktif = (nilai: boolean) => {
        setAktif(nilai)
        try {
            localStorage.setItem(KUNCI_SIMPAN_AKTIF, nilai ? '1' : '0')
        } catch {
            // Abaikan bila localStorage dibatasi
        }
    }

    const resetUji = () => {
        setCeklis(buatCeklisAwal())
        setLog([])
        setJawabanUji('')
        setPesanProteksi(null)
    }

    // Telemetri layar & fokus live saat panel terbuka atau mode pengawasan aktif.
    useEffect(() => {
        if (!buka && !aktif) return
        const segarkan = () => setTelemetri(bacaTelemetri())
        segarkan()
        window.addEventListener('resize', segarkan)
        window.addEventListener('orientationchange', segarkan)
        window.addEventListener('focus', segarkan)
        window.addEventListener('blur', segarkan)
        document.addEventListener('visibilitychange', segarkan)
        window.visualViewport?.addEventListener('resize', segarkan)
        const interval = setInterval(segarkan, 500)

        return () => {
            window.removeEventListener('resize', segarkan)
            window.removeEventListener('orientationchange', segarkan)
            window.removeEventListener('focus', segarkan)
            window.removeEventListener('blur', segarkan)
            document.removeEventListener('visibilitychange', segarkan)
            window.visualViewport?.removeEventListener('resize', segarkan)
            clearInterval(interval)
        }
    }, [buka, aktif])

    // Pasang seluruh pengawas & proteksi asli (hanya lokal, tidak pernah mengirim ke API).
    useEffect(() => {
        if (!aktif || diHalamanSoal) {
            setLayarTerbagi(false)
            setTidakFokus(false)
            sedangPergiRef.current = false
            sudahCatatSplitRef.current = false
            sumberPergiRef.current = null
            return
        }

        mulaiRef.current = Date.now()
        const perangkat = jenisPerangkat()
        const pantauBlur = harusPantauBlurWindow({ adaNative: false, isTauri: false, jenisPerangkat: perangkat })
        const konfirmasiBlurMs = pantauBlur && harusKonfirmasiBlur(perangkat) ? KONFIRMASI_BLUR_IOS_MS : 0
        const intervalCekFokusMs = pantauBlur && harusKonfirmasiBlur(perangkat) ? INTERVAL_CEK_FOKUS_IOS_MS : 0

        const lepasPergi = pasangPengawasKepergian({
            pakaiNative: false,
            pakaiTauri: false,
            pantauBlur,
            jenisPerangkat: perangkat,
            konfirmasiBlurMs,
            intervalCekFokusMs,
            msSejakMulai: () => Date.now() - mulaiRef.current,
            onPergi: () => {
                sedangPergiRef.current = true
                if (document.visibilityState === 'hidden') {
                    sumberPergiRef.current = 'hidden'
                    tandaiCeklis('pindah_tab', 'sinyal', 'Kepergian', 'visibilityState → hidden')
                }
            },
            onKembali: () => {
                sedangPergiRef.current = false
            },
            onKembaliDetail: (info) => {
                if (info.hasil !== null) return
                const sumber = sumberPergiRef.current
                sumberPergiRef.current = null
                const dtk = `${(info.durasiMs / 1000).toFixed(1)} dtk`
                const infoLog = `${dtk} (dinding=${info.selisihDindingMs}ms, mono=${info.selisihMonotonikMs}ms, intip ${info.jumlahIntip}/${info.batasIntip})`
                if (info.jumlahIntip > 0) {
                    const target = sumber === 'blur' ? 'slide_over_floating' : 'pindah_tab'
                    tandaiCeklis(target, 'sinyal', 'Kembali (Toleransi)', infoLog)
                } else {
                    const w = formatWaktuDebug()
                    logIdRef.current += 1
                    setLog((prev) => tambahLogDebug(prev, 'Kembali (Abaikan)', infoLog, w, logIdRef.current))
                }
            },
            onFokusBerubah: (hilang) => {
                setTidakFokus(hilang)
                if (hilang && document.visibilityState === 'visible') {
                    sumberPergiRef.current = 'blur'
                    tandaiCeklis(
                        'slide_over_floating',
                        'sinyal',
                        'Fokus Hilang',
                        'Blur / !hasFocus saat halaman tetap visible (Slide Over / Floating Menu)',
                    )
                }
            },
            abaikanCatatSekali: () => {
                if (!sudahCatatSplitRef.current) return false
                sudahCatatSplitRef.current = false
                return true
            },
            onCatat: (jenis, _, durasiMs) => {
                const sumber = sumberPergiRef.current
                sumberPergiRef.current = null
                const dtk = `${(durasiMs / 1000).toFixed(1)} dtk`
                if (jenis === 'pindah_tab' || jenis === 'latar_belakang') {
                    if (sumber === 'blur') {
                        tandaiCeklis('slide_over_floating', 'tercatat', 'Pelanggaran', `${jenis} via blur (${dtk})`)
                    } else {
                        tandaiCeklis('pindah_tab', 'tercatat', 'Pelanggaran', `${jenis} (${dtk})`)
                    }
                    return
                }
                const w = formatWaktuDebug()
                logIdRef.current += 1
                setLog((prev) => tambahLogDebug(prev, 'Pelanggaran', `${jenis} (${dtk})`, w, logIdRef.current))
            },
        })

        const lepasSplit = harusPantauLayarDibagi({ isTauri: false, jenisPerangkat: perangkat })
            ? pasangPengawasLayarDibagi({
                  cekLayarDibagi: layarDibagi,
                  msSejakMulai: () => Date.now() - mulaiRef.current,
                  onStatusBerubah: (terbagi) => {
                      setLayarTerbagi(terbagi)
                      if (terbagi) {
                          tandaiCeklis('split_view', 'sinyal', 'Split View', `Viewport menyusut (${innerWidth}×${innerHeight})`)
                      } else if (!sedangPergiRef.current) {
                          sudahCatatSplitRef.current = false
                      }
                  },
                  onCatat: (jenis, _, durasiMs) => {
                      sudahCatatSplitRef.current = true
                      tandaiCeklis(
                          'split_view',
                          'tercatat',
                          'Pelanggaran',
                          `${jenis} (${(durasiMs / 1000).toFixed(1)} dtk)`,
                      )
                  },
              })
            : () => undefined

        const lp = pasangPengawasLayarPenuh({
            msSejakMulai: () => Date.now() - mulaiRef.current,
            sedangPergi: () => sedangPergiRef.current,
            onCatat: (jenis, _, durasiMs) => {
                tandaiCeklis(
                    'layar_penuh',
                    'tercatat',
                    'Pelanggaran',
                    `${jenis} (${(durasiMs / 1000).toFixed(1)} dtk)`,
                )
            },
        })

        let terakhirEventProteksi: { tipe: string; sumber: 'papan_ketik' | 'lain'; pada: number } | null = null
        const catatEventSebelumBlokir = (e: Event) => {
            if (e.type === 'keydown') {
                const ke = e as KeyboardEvent
                const aksi = adalahPintasanCopas(ke)
                if (aksi) {
                    terakhirEventProteksi = { tipe: aksi, sumber: 'papan_ketik', pada: performance.now() }
                }
                return
            }
            if (e.type === 'copy' || e.type === 'cut' || e.type === 'paste' || e.type === 'contextmenu') {
                const baruSajaKey =
                    terakhirEventProteksi?.sumber === 'papan_ketik' &&
                    performance.now() - terakhirEventProteksi.pada < 100
                terakhirEventProteksi = {
                    tipe: e.type,
                    sumber: baruSajaKey ? 'papan_ketik' : 'lain',
                    pada: performance.now(),
                }
            }
        }

        const kabariDenganCeklis = (teks: string) => {
            kabari(teks)
            const ev =
                terakhirEventProteksi && performance.now() - terakhirEventProteksi.pada < 150
                    ? terakhirEventProteksi
                    : null
            if (teks.includes('Klik kanan')) {
                tandaiCeklis('blokir_klik_kanan', 'tercatat', 'Proteksi', 'Klik kanan / tekan-lama diblokir')
                return
            }
            if (teks.includes('Menempel teks') || teks.includes('menyalin pertanyaan') || ev?.tipe === 'paste') {
                tandaiCeklis('blokir_paste', 'tercatat', 'Proteksi', teks)
                if (ev?.sumber === 'papan_ketik') {
                    tandaiCeklis('blokir_pintasan', 'tercatat', 'Pintasan', 'Pintasan paste diblokir')
                }
                return
            }
            if (ev?.tipe === 'copy' || ev?.tipe === 'cut') {
                tandaiCeklis('blokir_copy_cut', 'tercatat', 'Proteksi', `Aksi ${ev.tipe} diblokir`)
                if (ev.sumber === 'papan_ketik') {
                    tandaiCeklis('blokir_pintasan', 'tercatat', 'Pintasan', `Pintasan ${ev.tipe} diblokir`)
                }
            }
        }

        const eventPrabaca = ['keydown', 'copy', 'cut', 'paste', 'contextmenu'] as const
        eventPrabaca.forEach((n) => window.addEventListener(n, catatEventSebelumBlokir, true))

        const kontrol = pasangProteksiKonten({
            soalAktif: () => 0,
            teksSoalAktif: () => TEKS_CONTOH_SOAL_DEBUG,
            kabari: kabariDenganCeklis,
            onCatatUndo: () => {
                terakhirUndoRef.current = performance.now()
            },
            onKomposisiMulai: () => {
                sedangKomposisiRef.current = true
            },
            onKomposisiSelesai: () => {
                sedangKomposisiRef.current = false
                terakhirKomposisiRef.current = performance.now()
            },
            pakaiTauri: false,
            pakaiNative: false,
        })
        laporTempelRef.current = kontrol.laporTempelDiblokir

        const observasiSeleksi = (e: Event) => {
            if (e.defaultPrevented) {
                tandaiCeklis('blokir_seleksi_seret', 'tercatat', 'Proteksi', `${e.type} diblokir`)
            }
        }
        const observasiKeydown = (e: KeyboardEvent) => {
            if (e.defaultPrevented && !adalahPintasanCopas(e)) {
                tandaiCeklis('blokir_pintasan', 'tercatat', 'Pintasan', `Tombol ${e.key} diblokir`)
            }
        }
        document.addEventListener('selectstart', observasiSeleksi)
        document.addEventListener('dragstart', observasiSeleksi)
        document.addEventListener('drop', observasiSeleksi)
        document.addEventListener('keydown', observasiKeydown)

        return () => {
            lepasPergi()
            lepasSplit()
            lp.lepas()
            eventPrabaca.forEach((n) => window.removeEventListener(n, catatEventSebelumBlokir, true))
            document.removeEventListener('selectstart', observasiSeleksi)
            document.removeEventListener('dragstart', observasiSeleksi)
            document.removeEventListener('drop', observasiSeleksi)
            document.removeEventListener('keydown', observasiKeydown)
            laporTempelRef.current = null
            kontrol.lepas()
        }
    }, [aktif, diHalamanSoal, kabari, tandaiCeklis])

    const sedangAmanInput = () =>
        performance.now() - terakhirUndoRef.current < 800 ||
        sedangKomposisiRef.current ||
        performance.now() - terakhirKomposisiRef.current < 800

    const jumlahTercatat = ceklis.filter((c) => c.status === 'tercatat').length

    return (
        <>
            {/* Tombol toggle mengambang di seluruh halaman staging */}
            <div className="fixed bottom-4 right-4 z-[90] flex items-center gap-2">
                <button
                    type="button"
                    onClick={() => setBuka((v) => !v)}
                    aria-expanded={buka}
                    aria-label="Toggle menu debug pelanggaran staging"
                    className={cn(
                        'inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-extrabold shadow-lg transition active:scale-95',
                        aktif
                            ? 'border-amber-400 bg-ink text-white'
                            : 'border-amber-300 bg-amber-100 text-amber-950 hover:bg-amber-200',
                    )}
                >
                    <FlaskConical className="size-4 text-amber-500" />
                    <span>Debug Uji</span>
                    <span
                        className={cn(
                            'size-2 rounded-full',
                            aktif ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400',
                        )}
                    />
                    <span className="rounded-full bg-white/15 px-1.5 py-0.5 text-[11px] tabular-nums">
                        {jumlahTercatat}/{ceklis.length}
                    </span>
                </button>
            </div>

            {/* Panel Drawer Debug */}
            {buka && (
                <aside
                    role="dialog"
                    aria-label="Panel debug ceklis pelanggaran staging"
                    className="fixed inset-x-3 bottom-16 z-[95] max-h-[82vh] overflow-y-auto rounded-xl border border-amber-300 bg-white p-4 text-slate-800 shadow-2xl sm:left-auto sm:right-4 sm:w-[27rem]"
                >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                            <FlaskConical className="size-4 text-amber-600" />
                            <h2 className="text-sm font-extrabold text-ink">Debug Ceklis Pelanggaran (Staging)</h2>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={resetUji}
                                className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                                title="Reset ceklis dan log"
                            >
                                <RotateCcw className="size-3.5" /> Reset
                            </button>
                            <button
                                type="button"
                                onClick={() => setBuka(false)}
                                aria-label="Tutup panel debug"
                                className="inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100"
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                    </div>

                    <div className="mt-3 space-y-2.5">
                        {/* Toggle Mode Pengawasan Global */}
                        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5">
                            <div className="min-w-0">
                                <p className="text-xs font-bold text-ink">Mode Pengawasan Aktif (Semua Halaman)</p>
                                <p className="text-[11px] text-slate-600">
                                    Tanpa masuk soal &amp; tanpa kirim laporan ke server.
                                </p>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={aktif}
                                onClick={() => ubahAktif(!aktif)}
                                className={cn(
                                    'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition',
                                    aktif ? 'bg-emerald-600' : 'bg-slate-300',
                                )}
                            >
                                <span
                                    className={cn(
                                        'inline-block size-5 transform rounded-full bg-white shadow-xs transition',
                                        aktif ? 'translate-x-5' : 'translate-x-0.5',
                                    )}
                                />
                            </button>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                            <label className="inline-flex cursor-pointer items-center gap-2 font-medium text-slate-700">
                                <input
                                    type="checkbox"
                                    checked={tampilkanTirai}
                                    onChange={(e) => setTampilkanTirai(e.target.checked)}
                                    className="size-4 rounded border-slate-300"
                                />
                                Tampilkan tirai penutup saat Split/Blur
                            </label>
                            {typeof document !== 'undefined' && document.fullscreenEnabled && (
                                <button
                                    type="button"
                                    onClick={() => void masukLayarPenuh()}
                                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                                >
                                    <Maximize className="size-3" /> Uji Fullscreen
                                </button>
                            )}
                        </div>

                        {diHalamanSoal && (
                            <p role="note" className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                                Kamu sedang berada di halaman soal asli. Listener debug otomatis dijeda agar tidak bentrok.
                            </p>
                        )}

                        {/* Telemetri Live */}
                        <div className="rounded-lg border border-slate-200 bg-slate-900 p-2.5 font-mono text-[11px] leading-relaxed text-slate-100">
                            <p>
                                dev=<b>{telemetri.perangkat}</b> | standalone=<b>{String(telemetri.standalone)}</b> | blurWatch=
                                <b>{String(telemetri.pantauBlur)}</b>
                            </p>
                            <p>
                                screen=<b>{telemetri.screen}</b> | inner=<b>{telemetri.inner}</b> | orient=
                                <b>{telemetri.orientasi}</b>
                            </p>
                            <p>
                                vv=<b>{telemetri.vv}</b> | vis=<b>{telemetri.visibility}</b> | focus=
                                <b>{String(telemetri.hasFocus)}</b> | split=
                                <b className={telemetri.layarDibagi ? 'text-amber-300' : 'text-emerald-300'}>
                                    {String(telemetri.layarDibagi)}
                                </b>
                            </p>
                        </div>

                        {/* Daftar Ceklis */}
                        <div className="space-y-1.5">
                            <p className="text-xs font-bold text-ink">
                                Ceklis Deteksi ({jumlahTercatat}/{ceklis.length} terdeteksi)
                            </p>
                            <ul className="space-y-1.5">
                                {ceklis.map((item) => (
                                    <li
                                        key={item.kunci}
                                        className={cn(
                                            'rounded-lg border px-2.5 py-2 text-xs',
                                            item.status === 'tercatat'
                                                ? 'border-emerald-200 bg-emerald-50/70'
                                                : item.status === 'sinyal'
                                                  ? 'border-amber-200 bg-amber-50/70'
                                                  : 'border-slate-200 bg-slate-50/60',
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="inline-flex items-center gap-1.5 font-bold text-ink">
                                                <CheckCircle2
                                                    className={cn(
                                                        'size-3.5 shrink-0',
                                                        item.status === 'tercatat'
                                                            ? 'text-emerald-600'
                                                            : item.status === 'sinyal'
                                                              ? 'text-amber-600'
                                                              : 'text-slate-300',
                                                    )}
                                                />
                                                {item.label}
                                            </span>
                                            <span
                                                className={cn(
                                                    'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase',
                                                    item.status === 'tercatat'
                                                        ? 'bg-emerald-100 text-emerald-800'
                                                        : item.status === 'sinyal'
                                                          ? 'bg-amber-100 text-amber-800'
                                                          : 'bg-slate-200 text-slate-600',
                                                )}
                                            >
                                                {item.status === 'tercatat'
                                                    ? `Terdeteksi (${item.jumlah}×)`
                                                    : item.status === 'sinyal'
                                                      ? `Sinyal (${item.jumlah}×)`
                                                      : 'Belum'}
                                            </span>
                                        </div>
                                        <p className="mt-0.5 text-[11px] text-slate-600">{item.deskripsi}</p>
                                        {item.detail && (
                                            <p className="mt-1 truncate font-mono text-[10px] text-slate-500">
                                                [{item.waktu}] {item.detail}
                                            </p>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Mini Sandbox Uji Copy-Paste */}
                        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                            <p className="text-xs font-bold text-ink">Area Uji Copy-Paste &amp; Tekan-Lama</p>
                            <div className="konten-soal flex items-center gap-2.5 rounded border border-slate-200 bg-white p-2 text-xs text-slate-700">
                                <img
                                    src="/brand/staging/ikon-192.png"
                                    alt="Contoh gambar soal"
                                    draggable={false}
                                    className="size-9 shrink-0 rounded"
                                />
                                <p>{TEKS_CONTOH_SOAL_DEBUG}</p>
                            </div>
                            <textarea
                                rows={2}
                                data-isian-jawaban
                                autoComplete="off"
                                autoCorrect="off"
                                spellCheck={false}
                                value={jawabanUji}
                                placeholder="Coba paste / QuickType ke kolom uji ini…"
                                onChange={(e) => {
                                    const isi = e.target.value
                                    if (!sedangAmanInput()) {
                                        const cek = terdeteksiTempel({
                                            sebelum: jawabanUji,
                                            sesudah: isi,
                                            teksSoal: TEKS_CONTOH_SOAL_DEBUG,
                                        })
                                        if (cek.diblokir) {
                                            laporTempelRef.current?.(cek.alasan)
                                            return
                                        }
                                    }
                                    setJawabanUji(isi)
                                }}
                                className="w-full rounded-md border border-slate-300 bg-white p-2 text-xs text-slate-800 placeholder-slate-400 focus:border-primary focus:outline-none"
                            />
                        </div>

                        {/* Log Kejadian */}
                        {log.length > 0 && (
                            <div className="space-y-1">
                                <p className="text-xs font-bold text-ink">Log Kejadian Terbaru</p>
                                <ul className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 p-2 font-mono text-[10px] text-slate-700">
                                    {log.map((l) => (
                                        <li key={l.id}>
                                            <span className="text-slate-400">[{l.waktu}]</span> <b>{l.kategori}:</b> {l.pesan}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                </aside>
            )}

            {/* Tirai Simulasi saat Split View / Slide Over / Floating Menu aktif di luar halaman soal */}
            {aktif && !diHalamanSoal && tampilkanTirai && (layarTerbagi || tidakFokus) && (
                <div
                    role="alertdialog"
                    aria-modal
                    onClick={() => window.focus()}
                    className="fixed inset-0 z-[85] flex items-center justify-center bg-ink/85 p-6 backdrop-blur-md"
                >
                    <div className="max-w-sm rounded-lg bg-white p-6 text-center shadow-lg">
                        <span className="mx-auto inline-flex size-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                            {layarTerbagi ? <Maximize className="size-7" /> : <AlertTriangle className="size-7" />}
                        </span>
                        <h2 className="mt-3 text-title">
                            {layarTerbagi ? 'Layar sedang dibagi (Debug)' : 'Layar ujian tidak aktif (Debug)'}
                        </h2>
                        <p className="mt-1 text-sm text-slate-600">
                            {layarTerbagi
                                ? 'Split View / jendela mengambang terdeteksi. Kembalikan ke satu layar penuh.'
                                : 'Slide Over, menu mengambang, atau aplikasi lain terdeteksi. Ketuk layar ini setelah menutupnya.'}
                        </p>
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation()
                                ubahAktif(false)
                            }}
                            className="mt-4 inline-flex items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                        >
                            Matikan Mode Debug
                        </button>
                    </div>
                </div>
            )}

            {/* Toast Proteksi Konten */}
            {pesanProteksi && (
                <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[92] flex justify-center px-4">
                    <p role="status" className="animate-turun rounded-full bg-ink/90 px-4 py-2 text-xs font-semibold text-white shadow-md">
                        {pesanProteksi}
                    </p>
                </div>
            )}
        </>
    )
}
