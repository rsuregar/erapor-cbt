import { api, platform } from '@/lib/api'
import {
    AMBANG_JEDA_FRAME_IOS_MS,
    BATAS_INTIP_CEPAT,
    bolehDeteksiLayarMatiDariJam,
    DEBOUNCE_LAYAR_DIBAGI_MS,
    evaluasiKepergianSingkat,
    harusCatatKeluarLayarPenuh,
    harusCatatLayarDibagi,
    harusCatatMuatUlang,
    harusKonfirmasiBlur,
    harusPantauBlurWindow,
    harusPantauLayarDibagi,
    INTERVAL_CEK_FOKUS_IOS_MS,
    klasifikasiKepergian,
    KONFIRMASI_BLUR_IOS_MS,
    MIN_INTIP_TERSEMBUNYI_MS,
    MIN_KEPERGIAN_MS,
    TOLERANSI_PERGI_MS,
} from '@/lib/deteksiKepergian'
import { adaNative, apakahLayarMatiNative, dengarStatusLayarNative, isTauri } from '@/lib/native'
import { jenisPerangkat, layarDibagi, type JenisPerangkat } from '@/lib/perangkat'
import { App } from '@capacitor/app'
import { penyimpanan } from '@/lib/ujian'
import { GalatApi, type EntriPelanggaran, type JenisPelanggaran, type UjianRingkas } from '@erapor-cbt/exam-core'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Jenis yang tidak ikut ambang kunci (JenisPelanggaran::tidakDihitung() di
 * server). `muat_ulang` tetap dicatat untuk pengawas tapi tidak dihitung —
 * internet lambat, tarik-untuk-muat-ulang, dan OS yang menutup tab di latar
 * bukan kecurangan; di Lockdown server tetap langsung mengunci.
 * `keluar_lokasi` juga tidak dihitung, tapi hanya dicatat server dari
 * detak.lokasi — app tidak pernah mengirimnya.
 * `klik_kanan` dan `salin_diblokir` (percobaan yang sudah dibatalkan proteksi konten)
 * hanya informasi untuk pengawas.
 */
const TIDAK_DIHITUNG = new Set<JenisPelanggaran>(['offline', 'layar_mati', 'muat_ulang', 'klik_kanan', 'salin_diblokir'])

/** Tinggal sebentar (mis. menarik panel notifikasi atau salah klik < 5 dtk) ditoleransi. */
const MIN_PERGI_MS = MIN_KEPERGIAN_MS

/** Attempt yang layarnya sudah dibuka di muatan JS ini — pembeda muat ulang dari navigasi biasa. */
const dibuka = new Set<number>()

export type Kejadian = { kunci: number; jenis: JenisPelanggaran; durasiMs: number; ke: number }

export type PengawasKepergianOpsi = {
    pakaiNative: boolean
    pakaiTauri: boolean
    pantauBlur: boolean
    jenisPerangkat?: JenisPerangkat
    msSejakMulai: () => number | undefined
    onPergi?: () => void
    onKembali?: () => void
    onKembaliDetail?: (info: {
        durasiMs: number
        selisihDindingMs: number
        selisihMonotonikMs: number
        hasil: JenisPelanggaran | null
        jumlahIntip: number
        batasIntip: number
    }) => void
    onFokusBerubah?: (tidakFokus: boolean) => void
    abaikanCatatSekali?: () => boolean
    konfirmasiBlurMs?: number
    intervalCekFokusMs?: number
    ambangJedaFrameMs?: number
    onJedaFrame?: (jedaMs: number) => void
    onCatat: (jenis: JenisPelanggaran, mulaiMs: number | undefined, durasiMs: number) => void
    bacaPlatform?: () => 'android' | 'ios' | 'pwa'
    imporJendelaTauri?: () => Promise<{
        isFocused: () => Promise<boolean>
        onFocusChanged: (cb: (e: { payload: boolean }) => void) => Promise<() => void>
    }>
}

/** Pasang semua pendengar kepergian layar ujian (visibilitychange, blur/focus, Capacitor, Tauri). */
export function pasangPengawasKepergian(opsi: PengawasKepergianOpsi): () => void {
    let sejakMono: number | null = null
    let sejakDinding = 0
    let mulaiMs: number | undefined
    let pernahLayarMati = false
    let pernahTersembunyi = false
    let jendelaBlurAktif = false
    let fokusTauri = true
    let riwayatSingkat: number[] = []
    let terakhirKembaliDinding = -Infinity
    let timerKonfirmasiBlur: ReturnType<typeof setTimeout> | undefined
    const bacaPlatform = opsi.bacaPlatform ?? platform

    const batalKonfirmasiBlur = () => {
        if (timerKonfirmasiBlur) {
            clearTimeout(timerKonfirmasiBlur)
            timerKonfirmasiBlur = undefined
        }
    }

    const pergi = (awal?: { mono: number; dinding: number; mulai: number | undefined }) => {
        batalKonfirmasiBlur()
        if (document.visibilityState === 'hidden') pernahTersembunyi = true
        if (sejakMono !== null) return
        opsi.onPergi?.()
        opsi.onFokusBerubah?.(true)
        sejakMono = awal?.mono ?? performance.now()
        sejakDinding = awal?.dinding ?? Date.now()
        mulaiMs = awal ? awal.mulai : opsi.msSejakMulai()
        if (opsi.pakaiNative) {
            void apakahLayarMatiNative(false).then((mati) => {
                if (mati && sejakMono !== null) pernahLayarMati = true
            })
        }
    }

    const mulaiBlurTerverifikasi = (sumber: 'event' | 'watchdog') => {
        if (sumber === 'event') jendelaBlurAktif = true
        if (sejakMono !== null || timerKonfirmasiBlur) return
        const jedaKonfirmasi = opsi.konfirmasiBlurMs ?? 0
        if (jedaKonfirmasi <= 0) {
            pergi()
            return
        }
        const awal = { mono: performance.now(), dinding: Date.now(), mulai: opsi.msSejakMulai() }
        timerKonfirmasiBlur = setTimeout(() => {
            timerKonfirmasiBlur = undefined
            if (sumber === 'event') {
                if (!jendelaBlurAktif) return
            } else if (document.visibilityState === 'visible' && document.hasFocus()) {
                return
            }
            pergi(awal)
        }, jedaKonfirmasi)
    }

    const kembali = () => {
        batalKonfirmasiBlur()
        if (sejakMono === null || document.visibilityState !== 'visible') return
        if (opsi.pantauBlur && (jendelaBlurAktif || !document.hasFocus())) return
        if (opsi.pakaiTauri && !fokusTauri) return
        terakhirKembaliDinding = Date.now()
        opsi.onKembali?.()
        opsi.onFokusBerubah?.(false)
        const selisihMonotonikMs = performance.now() - sejakMono
        const selisihDindingMs = Date.now() - sejakDinding
        const layarMatiNative = pernahLayarMati
        const tersembunyiSaatPergi = pernahTersembunyi
        const mulaiSaatPergi = mulaiMs
        sejakMono = null
        mulaiMs = undefined
        pernahLayarMati = false
        pernahTersembunyi = false

        const catatDenganStatus = (mati: boolean) => {
            const durasiMs = Math.round(Math.max(selisihMonotonikMs, selisihDindingMs))
            const pakaiHeuristikJam = bolehDeteksiLayarMatiDariJam(opsi.jenisPerangkat)
            const minPergiMs = tersembunyiSaatPergi ? MIN_INTIP_TERSEMBUNYI_MS : MIN_PERGI_MS
            const bukanLayarMati = !mati && (!pakaiHeuristikJam || selisihDindingMs - selisihMonotonikMs < 2000)
            let paksaCatatSingkat = false
            if (durasiMs >= minPergiMs && durasiMs < TOLERANSI_PERGI_MS && bukanLayarMati) {
                const ev = evaluasiKepergianSingkat(riwayatSingkat, Date.now())
                riwayatSingkat = ev.riwayatBaru
                paksaCatatSingkat = ev.lewatiBatas
            }

            const hasil = klasifikasiKepergian({
                platform: bacaPlatform(),
                jenisPerangkat: opsi.jenisPerangkat,
                layarMatiNative: mati,
                selisihDindingMs,
                selisihMonotonikMs,
                minPergiMs,
                toleransiPergiMs: TOLERANSI_PERGI_MS,
                paksaCatatSingkat,
            })
            if (hasil && !opsi.abaikanCatatSekali?.()) {
                opsi.onCatat(hasil.jenis, mulaiSaatPergi, hasil.durasiMs)
            }
            opsi.onKembaliDetail?.({
                durasiMs,
                selisihDindingMs: Math.round(selisihDindingMs),
                selisihMonotonikMs: Math.round(selisihMonotonikMs),
                hasil: hasil?.jenis ?? null,
                jumlahIntip: paksaCatatSingkat ? BATAS_INTIP_CEPAT : riwayatSingkat.length,
                batasIntip: BATAS_INTIP_CEPAT,
            })
        }

        if (opsi.pakaiNative && !layarMatiNative) {
            void apakahLayarMatiNative(true).then(catatDenganStatus)
        } else {
            if (opsi.pakaiNative) void apakahLayarMatiNative(true)
            catatDenganStatus(layarMatiNative)
        }
    }
    const visibilitas = () => {
        if (document.visibilityState === 'hidden') {
            pernahTersembunyi = true
            pergi()
        } else {
            if (pernahTersembunyi && document.hasFocus()) jendelaBlurAktif = false
            kembali()
        }
    }
    const saatBlur = () => mulaiBlurTerverifikasi('event')
    const saatFocus = () => {
        jendelaBlurAktif = false
        kembali()
    }
    const pulihSaatInteraksi = () => {
        if (document.visibilityState !== 'visible' || !document.hasFocus()) return
        jendelaBlurAktif = false
        batalKonfirmasiBlur()
        if (sejakMono !== null) {
            kembali()
        }
    }

    document.addEventListener('visibilitychange', visibilitas)
    // App native: perpindahan ke latar belakang dan status layar dilaporkan OS.
    const statusApp = opsi.pakaiNative ? App.addListener('appStateChange', ({ isActive }) => (isActive ? kembali() : pergi())) : null
    const statusLayar = opsi.pakaiNative
        ? dengarStatusLayarNative((interaktif) => {
              if (!interaktif) pernahLayarMati = true
          })
        : null
    let lepasFokusTauri: (() => void) | null = null
    let batalTauri = false
    if (opsi.pakaiTauri) {
        const ambilJendela =
            opsi.imporJendelaTauri ?? (() => import('@tauri-apps/api/window').then((m) => m.getCurrentWindow()))
        void ambilJendela()
            .then(async (jendela) => {
                if (batalTauri) return
                fokusTauri = await jendela.isFocused().catch(() => true)
                const lepas = await jendela.onFocusChanged(({ payload: fokus }) => {
                    fokusTauri = fokus
                    if (fokus) kembali()
                    else pergi()
                })
                if (batalTauri) lepas()
                else lepasFokusTauri = lepas
            })
            .catch(() => undefined)
    }
    let timerCekFokus: ReturnType<typeof setInterval> | undefined
    const pakaiCekFokusBerkala = opsi.pantauBlur && (opsi.intervalCekFokusMs ?? 0) > 0
    if (opsi.pantauBlur) {
        window.addEventListener('blur', saatBlur)
        window.addEventListener('focus', saatFocus)
        if (pakaiCekFokusBerkala) {
            window.addEventListener('pointerdown', pulihSaatInteraksi, { capture: true, passive: true })
            window.addEventListener('touchstart', pulihSaatInteraksi, { capture: true, passive: true })
            window.addEventListener('keydown', pulihSaatInteraksi, { capture: true, passive: true })
            if (document.visibilityState === 'visible' && !document.hasFocus()) {
                mulaiBlurTerverifikasi('watchdog')
            }
            timerCekFokus = setInterval(() => {
                if (document.visibilityState !== 'visible') return
                if (!document.hasFocus()) {
                    if (sejakMono === null) mulaiBlurTerverifikasi('watchdog')
                } else if (!jendelaBlurAktif && sejakMono !== null) {
                    kembali()
                }
            }, opsi.intervalCekFokusMs)
        }
    }
    let idRaf: number | undefined
    let batalRaf = false
    const ambangJedaFrame = opsi.ambangJedaFrameMs ?? 0
    if (ambangJedaFrame > 0 && typeof requestAnimationFrame === 'function') {
        let terakhirFrameDinding = Date.now()
        const detakFrame = () => {
            if (batalRaf) return
            const sekarangDinding = Date.now()
            const jedaMs = sekarangDinding - terakhirFrameDinding
            terakhirFrameDinding = sekarangDinding
            if (
                document.visibilityState === 'visible' &&
                sejakMono === null &&
                !jendelaBlurAktif &&
                !timerKonfirmasiBlur &&
                sekarangDinding - terakhirKembaliDinding >= 1500 &&
                jedaMs >= ambangJedaFrame
            ) {
                terakhirKembaliDinding = sekarangDinding
                opsi.onJedaFrame?.(jedaMs)
                let paksaCatatSingkat = false
                if (jedaMs < TOLERANSI_PERGI_MS) {
                    const ev = evaluasiKepergianSingkat(riwayatSingkat, sekarangDinding)
                    riwayatSingkat = ev.riwayatBaru
                    paksaCatatSingkat = ev.lewatiBatas
                }
                const hasil = klasifikasiKepergian({
                    platform: bacaPlatform(),
                    jenisPerangkat: opsi.jenisPerangkat,
                    layarMatiNative: false,
                    selisihDindingMs: jedaMs,
                    selisihMonotonikMs: jedaMs,
                    minPergiMs: ambangJedaFrame,
                    toleransiPergiMs: TOLERANSI_PERGI_MS,
                    paksaCatatSingkat,
                })
                if (hasil && !opsi.abaikanCatatSekali?.()) {
                    opsi.onCatat(hasil.jenis, opsi.msSejakMulai(), hasil.durasiMs)
                }
                opsi.onKembaliDetail?.({
                    durasiMs: Math.round(jedaMs),
                    selisihDindingMs: Math.round(jedaMs),
                    selisihMonotonikMs: Math.round(jedaMs),
                    hasil: hasil?.jenis ?? null,
                    jumlahIntip: paksaCatatSingkat ? BATAS_INTIP_CEPAT : riwayatSingkat.length,
                    batasIntip: BATAS_INTIP_CEPAT,
                })
            }
            idRaf = requestAnimationFrame(detakFrame)
        }
        idRaf = requestAnimationFrame(detakFrame)
    }
    const saatPagehide = () => pergi()
    window.addEventListener('pagehide', saatPagehide)

    return () => {
        batalTauri = true
        batalRaf = true
        if (idRaf !== undefined && typeof cancelAnimationFrame === 'function') {
            cancelAnimationFrame(idRaf)
        }
        batalKonfirmasiBlur()
        if (timerCekFokus) clearInterval(timerCekFokus)
        lepasFokusTauri?.()
        document.removeEventListener('visibilitychange', visibilitas)
        void statusApp?.then((h) => h.remove())
        void statusLayar?.then((h) => h?.remove())
        if (opsi.pantauBlur) {
            window.removeEventListener('blur', saatBlur)
            window.removeEventListener('focus', saatFocus)
            if (pakaiCekFokusBerkala) {
                window.removeEventListener('pointerdown', pulihSaatInteraksi, true)
                window.removeEventListener('touchstart', pulihSaatInteraksi, true)
                window.removeEventListener('keydown', pulihSaatInteraksi, true)
            }
        }
        window.removeEventListener('pagehide', saatPagehide)
    }
}

/** Pasang pemantau fullscreen dengan masa tenggang 5 detik dan pencegahan dobel saat pindah tab. */
export function pasangPengawasLayarPenuh(opsi: {
    msSejakMulai: () => number | undefined
    sedangPergi: () => boolean
    onCatat: (jenis: JenisPelanggaran, mulaiMs: number | undefined, durasiMs: number) => void
}): { batal: () => void; lepas: () => void } {
    let timerLp: ReturnType<typeof setTimeout> | undefined
    const batal = () => {
        if (timerLp) {
            clearTimeout(timerLp)
            timerLp = undefined
        }
    }
    const ubah = () => {
        if (document.fullscreenElement) {
            batal()
            return
        }
        if (timerLp) return
        if (document.visibilityState !== 'visible' || !document.hasFocus() || opsi.sedangPergi()) return
        const mulaiKeluar = opsi.msSejakMulai()
        timerLp = setTimeout(() => {
            timerLp = undefined
            if (
                harusCatatKeluarLayarPenuh({
                    layarPenuhAktif: !!document.fullscreenElement,
                    terlihat: document.visibilityState === 'visible',
                    sedangPergi: opsi.sedangPergi(),
                    punyaFokus: document.hasFocus(),
                })
            ) {
                opsi.onCatat('keluar_layar_penuh', mulaiKeluar, TOLERANSI_PERGI_MS)
            }
        }, TOLERANSI_PERGI_MS)
    }
    document.addEventListener('fullscreenchange', ubah)

    return {
        batal,
        lepas: () => {
            batal()
            document.removeEventListener('fullscreenchange', ubah)
        },
    }
}

export type PengawasLayarDibagiOpsi = {
    cekLayarDibagi: () => boolean
    msSejakMulai: () => number | undefined
    onStatusBerubah?: (terbagi: boolean) => void
    onCatat: (jenis: JenisPelanggaran, mulaiMs: number | undefined, durasiMs: number) => void
    debounceMasukMs?: number
    intervalCekMs?: number
}

/**
 * Pantau Split View, Stage Manager, dan jendela mengambang selama ujian di tablet/HP.
 * Memakai debounce masuk (300 ms) agar rotasi layar tidak berkedip dan masa tenggang 5 detik
 * (+ pencegahan intip cepat berulang) konsisten dengan pindah tab.
 */
export function pasangPengawasLayarDibagi(opsi: PengawasLayarDibagiOpsi): () => void {
    let terbagiAktif = false
    let sejakMono: number | null = null
    let mulaiMs: number | undefined
    let sudahCatatSesiIni = false
    let riwayatSingkat: number[] = []
    let timerDebounce: ReturnType<typeof setTimeout> | undefined
    let timerCatat: ReturnType<typeof setTimeout> | undefined
    const debounceMs = opsi.debounceMasukMs ?? DEBOUNCE_LAYAR_DIBAGI_MS
    const cekMs = opsi.intervalCekMs ?? 1000

    const bersihkanTimer = () => {
        if (timerDebounce) {
            clearTimeout(timerDebounce)
            timerDebounce = undefined
        }
        if (timerCatat) {
            clearTimeout(timerCatat)
            timerCatat = undefined
        }
    }

    const evaluasi = () => {
        const kiniTerbagi = opsi.cekLayarDibagi()
        if (kiniTerbagi) {
            if (terbagiAktif || timerDebounce) return
            timerDebounce = setTimeout(() => {
                timerDebounce = undefined
                if (!opsi.cekLayarDibagi() || terbagiAktif) return
                terbagiAktif = true
                sudahCatatSesiIni = false
                sejakMono = performance.now()
                mulaiMs = opsi.msSejakMulai()
                opsi.onStatusBerubah?.(true)
                timerCatat = setTimeout(() => {
                    timerCatat = undefined
                    if (
                        harusCatatLayarDibagi({
                            layarDibagiAktif: opsi.cekLayarDibagi(),
                            terlihat: document.visibilityState === 'visible',
                        })
                    ) {
                        sudahCatatSesiIni = true
                        opsi.onCatat('ukuran_layar', mulaiMs, TOLERANSI_PERGI_MS)
                    }
                }, TOLERANSI_PERGI_MS)
            }, debounceMs)
            return
        }

        bersihkanTimer()
        if (!terbagiAktif) return
        terbagiAktif = false
        opsi.onStatusBerubah?.(false)
        if (!sudahCatatSesiIni && sejakMono !== null) {
            const durasiMs = Math.round(performance.now() - sejakMono)
            if (durasiMs >= MIN_KEPERGIAN_MS && durasiMs < TOLERANSI_PERGI_MS) {
                const ev = evaluasiKepergianSingkat(riwayatSingkat, Date.now())
                riwayatSingkat = ev.riwayatBaru
                if (ev.lewatiBatas) {
                    opsi.onCatat('ukuran_layar', mulaiMs, durasiMs)
                }
            }
        }
        sejakMono = null
        mulaiMs = undefined
        sudahCatatSesiIni = false
    }

    const win = typeof window !== 'undefined' ? window : undefined
    win?.addEventListener?.('resize', evaluasi)
    win?.addEventListener?.('orientationchange', evaluasi)
    win?.visualViewport?.addEventListener?.('resize', evaluasi)
    const timerInterval = cekMs > 0 ? setInterval(evaluasi, cekMs) : undefined
    evaluasi()

    return () => {
        bersihkanTimer()
        if (timerInterval) clearInterval(timerInterval)
        win?.removeEventListener?.('resize', evaluasi)
        win?.removeEventListener?.('orientationchange', evaluasi)
        win?.visualViewport?.removeEventListener?.('resize', evaluasi)
        if (terbagiAktif) {
            terbagiAktif = false
            opsi.onStatusBerubah?.(false)
        }
    }
}

const dihitung = (e: EntriPelanggaran[]) => e.filter((x) => !TIDAK_DIHITUNG.has(x.jenis)).length

/**
 * Deteksi meninggalkan layar ujian (PRD lapis 3): satu "kepergian" = sejak
 * blur/tersembunyi sampai kembali terlihat + fokus, dicatat sekali dengan
 * durasinya. Entri masuk antrean IndexedDB dulu (bertahan offline/muat
 * ulang), lalu dikirim; jumlah dari server menjadi acuan.
 */
export function usePelanggaran(opsi: {
    attemptId: number
    aktif: boolean
    ambangAwal: number
    level: UjianRingkas['level_keamanan'] | undefined
    msSejakMulai: () => number | undefined
    onTerkunci: () => void
    /** Ketat/Lockdown di laptop: keluar layar penuh = pelanggaran */
    pantauLayarPenuh?: boolean
}) {
    const { attemptId, aktif } = opsi
    const K_JUMLAH = `attempt:${attemptId}:pelanggaran`
    const K_ANTRE = `attempt:${attemptId}:pelanggaran-antre`

    const [server, setServer] = useState(0)
    const [tertunda, setTertunda] = useState(0)
    const [ambang, setAmbang] = useState(opsi.ambangAwal)
    const [kejadian, setKejadian] = useState<Kejadian | null>(null)
    const [layarTerbagi, setLayarTerbagi] = useState(false)
    const [tidakFokus, setTidakFokus] = useState(false)

    const ref = useRef(opsi)
    ref.current = opsi
    const jumlahRef = useRef(0)
    jumlahRef.current = server + tertunda
    const antrean = useRef<Promise<unknown>>(Promise.resolve())
    const mengirim = useRef(false)
    const sedangPergiRef = useRef(false)
    const sudahCatatSplitRef = useRef(false)
    const batalTimerLpRef = useRef<(() => void) | null>(null)

    useEffect(() => setAmbang(opsi.ambangAwal), [opsi.ambangAwal])

    /** Ubah antrean berurutan — catat dan kirim bisa bersamaan. */
    const ubahAntre = useCallback(
        <T>(fn: (antre: EntriPelanggaran[]) => [EntriPelanggaran[], T]): Promise<T> => {
            const p = antrean.current.then(async () => {
                const [baru, hasil] = fn((await penyimpanan.ambil<EntriPelanggaran[]>(K_ANTRE)) ?? [])
                await penyimpanan.simpan(K_ANTRE, baru)
                setTertunda(dihitung(baru))

                return hasil
            })
            antrean.current = p.catch(() => undefined)

            return p
        },
        [K_ANTRE],
    )

    const kirim = useCallback(async () => {
        if (mengirim.current) return
        mengirim.current = true
        try {
            for (;;) {
                const antre = (await penyimpanan.ambil<EntriPelanggaran[]>(K_ANTRE)) ?? []
                if (antre.length === 0) return
                try {
                    const r = await api.pelanggaran(attemptId, antre)
                    await ubahAntre((kini) => [kini.slice(antre.length), null])
                    await penyimpanan.simpan(K_JUMLAH, r.jumlah_dihitung)
                    setServer(r.jumlah_dihitung)
                    setAmbang(r.ambang)
                    if (r.status === 'terkunci') ref.current.onTerkunci()
                } catch (e) {
                    // Ditolak permanen (mis. sudah selesai): jangan diulang terus.
                    if (e instanceof GalatApi && !e.sementara) await ubahAntre(() => [[], null])

                    return
                }
            }
        } finally {
            mengirim.current = false
        }
    }, [K_ANTRE, K_JUMLAH, attemptId, ubahAntre])

    const catat = useCallback(
        async (jenis: JenisPelanggaran, mulaiMs: number | undefined, durasiMs: number, meta?: Record<string, unknown>) => {
            const entri: EntriPelanggaran = { jenis, mulai_ms: mulaiMs ?? 0, durasi_ms: durasiMs, offline: !navigator.onLine, ...(meta ? { meta } : {}) }
            await ubahAntre((a) => [[...a, entri], null])
            if (!TIDAK_DIHITUNG.has(jenis)) setKejadian({ kunci: Date.now(), jenis, durasiMs, ke: jumlahRef.current + 1 })
            void kirim()
        },
        [kirim, ubahAntre],
    )

    // Muat jumlah & antrean yang tersimpan, lalu kirim sisanya.
    useEffect(() => {
        void (async () => {
            setServer((await penyimpanan.ambil<number>(K_JUMLAH)) ?? 0)
            setTertunda(dihitung((await penyimpanan.ambil<EntriPelanggaran[]>(K_ANTRE)) ?? []))
            void kirim()
        })()
        const t = setInterval(() => void kirim(), 15_000)
        window.addEventListener('online', kirim)

        return () => {
            clearInterval(t)
            window.removeEventListener('online', kirim)
        }
    }, [K_ANTRE, K_JUMLAH, kirim])

    // Muat ulang saat mengerjakan: layar ini pernah terbuka di tab ini, tapi tidak di muatan JS ini.
    useEffect(() => {
        if (!aktif || dibuka.has(attemptId)) return
        dibuka.add(attemptId)
        const k = `cbt-kerjakan-${attemptId}`
        try {
            const reloadInternal = sessionStorage.getItem('cbt:reload-internal') === '1'
            if (reloadInternal) sessionStorage.removeItem('cbt:reload-internal')
            if (harusCatatMuatUlang({ pernahDibukaDiTab: Boolean(sessionStorage.getItem(k)), reloadInternal })) {
                void catat('muat_ulang', ref.current.msSejakMulai(), 0)
            }
            sessionStorage.setItem(k, '1')
        } catch {
            // sessionStorage tidak tersedia (mode privat ketat): lewati deteksi ini.
        }
    }, [aktif, attemptId, catat])

    // Pindah tab/aplikasi, layar mati, jendela lain di depan, app ke latar belakang.
    useEffect(() => {
        if (!aktif) {
            setTidakFokus(false)
            return
        }
        const pakaiNative = adaNative()
        const pakaiTauri = isTauri()
        const perangkat = jenisPerangkat()
        const pantauBlur = harusPantauBlurWindow({ adaNative: pakaiNative, isTauri: pakaiTauri, jenisPerangkat: perangkat })
        const konfirmasiBlurMs = pantauBlur && harusKonfirmasiBlur(perangkat) ? KONFIRMASI_BLUR_IOS_MS : 0
        const intervalCekFokusMs = pantauBlur && harusKonfirmasiBlur(perangkat) ? INTERVAL_CEK_FOKUS_IOS_MS : 0
        const ambangJedaFrameMs = pantauBlur && harusKonfirmasiBlur(perangkat) ? AMBANG_JEDA_FRAME_IOS_MS : 0

        const lepas = pasangPengawasKepergian({
            pakaiNative,
            pakaiTauri,
            pantauBlur,
            jenisPerangkat: perangkat,
            konfirmasiBlurMs,
            intervalCekFokusMs,
            ambangJedaFrameMs,
            msSejakMulai: () => ref.current.msSejakMulai(),
            onPergi: () => {
                sedangPergiRef.current = true
                batalTimerLpRef.current?.()
            },
            onKembali: () => {
                sedangPergiRef.current = false
            },
            onFokusBerubah: setTidakFokus,
            abaikanCatatSekali: () => {
                if (!sudahCatatSplitRef.current) return false
                sudahCatatSplitRef.current = false
                return true
            },
            onCatat: (jenis, mulaiMs, durasiMs) => void catat(jenis, mulaiMs, durasiMs),
        })

        return () => {
            sedangPergiRef.current = false
            setTidakFokus(false)
            lepas()
        }
    }, [aktif, catat])

    // Split View / Stage Manager / jendela mengambang di iPad & HP/tablet.
    useEffect(() => {
        if (!aktif) {
            setLayarTerbagi(false)
            sudahCatatSplitRef.current = false
            return
        }
        const pakaiTauri = isTauri()
        if (!harusPantauLayarDibagi({ isTauri: pakaiTauri, jenisPerangkat: jenisPerangkat() })) return

        const lepas = pasangPengawasLayarDibagi({
            cekLayarDibagi: layarDibagi,
            msSejakMulai: () => ref.current.msSejakMulai(),
            onStatusBerubah: (terbagi) => {
                setLayarTerbagi(terbagi)
                if (terbagi || !sedangPergiRef.current) {
                    sudahCatatSplitRef.current = false
                }
            },
            onCatat: (jenis, mulaiMs, durasiMs) => {
                sudahCatatSplitRef.current = true
                void catat(jenis, mulaiMs, durasiMs)
            },
        })

        return () => {
            setLayarTerbagi(false)
            sudahCatatSplitRef.current = false
            lepas()
        }
    }, [aktif, catat])

    // Keluar layar penuh (Esc, F11, gestur) — beri masa tenggang 5 detik dan hindari dobel dengan pindah tab.
    const pantauLayarPenuh = !!opsi.pantauLayarPenuh
    useEffect(() => {
        if (!aktif || !pantauLayarPenuh) return
        const lp = pasangPengawasLayarPenuh({
            msSejakMulai: () => ref.current.msSejakMulai(),
            sedangPergi: () => sedangPergiRef.current,
            onCatat: (jenis, mulaiMs, durasiMs) => void catat(jenis, mulaiMs, durasiMs),
        })
        batalTimerLpRef.current = lp.batal

        return () => {
            batalTimerLpRef.current = null
            lp.lepas()
        }
    }, [aktif, pantauLayarPenuh, catat])

    /** Catat percobaan yang diblokir proteksi konten (informasi; tidak memicu banner dan tidak dihitung). */
    const laporInfo = useCallback(
        (jenis: 'klik_kanan' | 'salin_diblokir', meta: Record<string, unknown>) => {
            void catat(jenis, ref.current.msSejakMulai(), 0, meta)
        },
        [catat],
    )

    const level = opsi.level ?? 'ketat'
    const mengunci = level !== 'dasar' && ambang > 0
    const jumlah = server + tertunda

    return {
        jumlah,
        ambang,
        /** Ujian ini terkunci otomatis di ambang (Ketat/Lockdown); Dasar hanya mencatat. */
        mengunci,
        tingkat: !mengunci || jumlah === 0 ? 'tenang' : jumlah >= ambang ? 'batas' : jumlah === ambang - 1 ? 'waspada' : 'tenang',
        kejadian,
        layarTerbagi,
        tidakFokus,
        tutupKejadian: () => setKejadian(null),
        kirim,
        laporInfo,
    } as const
}
