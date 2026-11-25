import { api, platform } from '@/lib/api'
import { harusPantauBlurWindow, klasifikasiKepergian } from '@/lib/deteksiKepergian'
import { adaNative, apakahLayarMatiNative, dengarStatusLayarNative } from '@/lib/native'
import { jenisPerangkat } from '@/lib/perangkat'
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

/** Tinggal sebentar (mis. menarik panel notifikasi) tidak dihitung. */
const MIN_PERGI_MS = 1000

/** Attempt yang layarnya sudah dibuka di muatan JS ini — pembeda muat ulang dari navigasi biasa. */
const dibuka = new Set<number>()

export type Kejadian = { kunci: number; jenis: JenisPelanggaran; durasiMs: number; ke: number }

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

    const ref = useRef(opsi)
    ref.current = opsi
    const jumlahRef = useRef(0)
    jumlahRef.current = server + tertunda
    const antrean = useRef<Promise<unknown>>(Promise.resolve())
    const mengirim = useRef(false)

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
            if (sessionStorage.getItem(k)) void catat('muat_ulang', ref.current.msSejakMulai(), 0)
            sessionStorage.setItem(k, '1')
        } catch {
            // sessionStorage tidak tersedia (mode privat ketat): lewati deteksi ini.
        }
    }, [aktif, attemptId, catat])

    // Pindah tab/aplikasi, layar mati, jendela lain di depan, app ke latar belakang.
    useEffect(() => {
        if (!aktif) return
        let sejakMono: number | null = null
        let sejakDinding = 0
        let mulaiMs: number | undefined
        let pernahLayarMati = false
        const pakaiNative = adaNative()
        const pantauBlur = harusPantauBlurWindow({ adaNative: pakaiNative, jenisPerangkat: jenisPerangkat() })

        const pergi = () => {
            if (sejakMono !== null) return
            sejakMono = performance.now()
            sejakDinding = Date.now()
            mulaiMs = ref.current.msSejakMulai()
            if (pakaiNative) {
                void apakahLayarMatiNative().then((mati) => {
                    if (mati && sejakMono !== null) pernahLayarMati = true
                })
            }
        }
        const kembali = () => {
            if (sejakMono === null || document.visibilityState !== 'visible') return
            if (pantauBlur && !document.hasFocus()) return
            const selisihMonotonikMs = performance.now() - sejakMono
            const selisihDindingMs = Date.now() - sejakDinding
            const layarMatiNative = pernahLayarMati
            sejakMono = null
            pernahLayarMati = false

            const catatDenganStatus = (mati: boolean) => {
                const hasil = klasifikasiKepergian({
                    platform: platform(),
                    layarMatiNative: mati,
                    selisihDindingMs,
                    selisihMonotonikMs,
                    minPergiMs: MIN_PERGI_MS,
                })
                if (hasil) void catat(hasil.jenis, mulaiMs, hasil.durasiMs)
            }

            if (pakaiNative && !layarMatiNative) {
                void apakahLayarMatiNative().then(catatDenganStatus)
            } else {
                catatDenganStatus(layarMatiNative)
            }
        }
        const visibilitas = () => (document.visibilityState === 'hidden' ? pergi() : kembali())

        document.addEventListener('visibilitychange', visibilitas)
        // App native: perpindahan ke latar belakang dan status layar dilaporkan OS.
        const statusApp = pakaiNative ? App.addListener('appStateChange', ({ isActive }) => (isActive ? kembali() : pergi())) : null
        const statusLayar = pakaiNative
            ? dengarStatusLayarNative((interaktif) => {
                  if (!interaktif) pernahLayarMati = true
              })
            : null
        if (pantauBlur) {
            window.addEventListener('blur', pergi)
            window.addEventListener('focus', kembali)
        }
        window.addEventListener('pagehide', pergi)

        return () => {
            document.removeEventListener('visibilitychange', visibilitas)
            void statusApp?.then((h) => h.remove())
            void statusLayar?.then((h) => h?.remove())
            if (pantauBlur) {
                window.removeEventListener('blur', pergi)
                window.removeEventListener('focus', kembali)
            }
            window.removeEventListener('pagehide', pergi)
        }
    }, [aktif, catat])

    // Keluar layar penuh (Esc, F11, gestur) — tidak selalu memicu blur, jadi dipantau sendiri.
    const pantauLayarPenuh = !!opsi.pantauLayarPenuh
    useEffect(() => {
        if (!aktif || !pantauLayarPenuh) return
        const ubah = () => {
            if (!document.fullscreenElement) void catat('keluar_layar_penuh', ref.current.msSejakMulai(), 0)
        }
        document.addEventListener('fullscreenchange', ubah)

        return () => document.removeEventListener('fullscreenchange', ubah)
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
        tutupKejadian: () => setKejadian(null),
        kirim,
        laporInfo,
    } as const
}
