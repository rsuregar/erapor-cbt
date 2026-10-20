import { api } from '@/lib/api'
import { ambilPosisi, tanpaWaktu, type PosisiDidapat } from '@/lib/lokasi'
import { adaNative, kunciLayar, lepasKunciLayar, statusKunciLayar } from '@/lib/native'
import { PenulisJawaban } from '@/lib/penulisJawaban'
import { bersihkan, muatUjian, penyimpanan, type SesiUjian } from '@/lib/ujian'
import { GalatApi, JamServer, Outbox, Penyinkron, type AlasanDitolak, type AlasanSelesai, type IsiPaket, type Jawaban } from '@erapor-cbt/exam-core'
import { useCallback, useEffect, useRef, useState } from 'react'

export type StatusUjian = 'memuat' | 'mengerjakan' | 'terkunci' | 'mengumpulkan' | 'menunggu_sinkron' | 'selesai' | 'tidak_ada'

export type IsiJawaban = Record<string, { jawaban: Jawaban; ragu: boolean }>

const JEDA_TEKS_MS = 700

/** Kontrak: detak.lokasi = posisi terakhir yang diketahui; GPS tidak perlu dipaksa tiap 15 detik. */
const SELANG_LOKASI_MS = 60_000

/** Alasan dari server bila attempt diakhiri pengawas (kontrak: data.alasan_selesai pada 409 SUDAH_SELESAI). */
function alasanDariGalat(g: GalatApi | null): AlasanSelesai | null {
    const a = g?.data.alasan_selesai

    return a === 'sesi_dihentikan' || a === 'dikumpulkan_pengawas' ? a : null
}

/**
 * Satu sesi mengerjakan: jawaban (outbox lokal dulu, PRD "offline-first"),
 * jam server, sinkron 15 detik, kunci/buka dari pengawas, pesan pengawas,
 * dan kumpul — termasuk kumpul yang tertunda karena offline.
 */
export function useSesiUjian(attemptId: number) {
    const [data, setData] = useState<{ sesi: SesiUjian; isi: IsiPaket } | null>(null)
    const [status, setStatus] = useState<StatusUjian>('memuat')
    const [jawaban, setJawaban] = useState<IsiJawaban>({})
    const [berakhir, setBerakhir] = useState<string | null>(null)
    const [koneksi, setKoneksi] = useState({ online: true, tertunda: 0 })
    const [pesan, setPesan] = useState<{ teks: string; pada: string } | null>(null)
    const [galatKumpul, setGalatKumpul] = useState<string | null>(null)
    /** Jawaban yang gagal ditulis ke perangkat (sedang dicoba ulang). >0 = jangan tutup app. */
    const [gagalSimpan, setGagalSimpan] = useState(0)
    /** Jawaban yang tidak disimpan server (soal id → alasan); dihapus bila kiriman berikutnya diterima. */
    const [ditolak, setDitolak] = useState<Record<string, AlasanDitolak | string>>({})
    /** null = dikumpulkan murid / waktu habis; selain itu diakhiri pengawas. */
    const [alasanSelesai, setAlasanSelesai] = useState<AlasanSelesai | null>(null)

    const outbox = useRef<Outbox>()
    const jam = useRef<JamServer>()
    const penyinkron = useRef<Penyinkron>()
    const soalAktif = useRef<number | null>(null)
    const posisi = useRef<PosisiDidapat | null>(null)
    /** kiosk_aktif di detak: null di PWA (web tidak bisa membaca kunci OS) */
    const kios = useRef<boolean | null>(null)
    const penulis = useRef<PenulisJawaban>()
    const statusRef = useRef<StatusUjian>('memuat')
    statusRef.current = status
    const sedangKumpul = useRef(false)
    const kumpulRef = useRef<() => Promise<void>>(async () => {})

    const msSejakMulai = useCallback(() => {
        if (!jam.current || !data) return undefined

        return Math.max(0, Math.round(jam.current.sekarang() - Date.parse(data.sesi.mulai.mulai_pada)))
    }, [data])

    // Muat sesi + paket dari perangkat, lalu mulai sinkron.
    useEffect(() => {
        let batal = false
        void (async () => {
            const hasil = await muatUjian(attemptId).catch(() => null)
            if (batal) return
            if (!hasil) {
                setStatus('tidak_ada')

                return
            }
            const { sesi } = hasil
            const o = new Outbox(penyimpanan, attemptId)
            await o.muatDariServer(sesi.mulai.jawaban_tersimpan)
            const j = new JamServer(new Date(Date.now() + sesi.selisihJam).toISOString())
            outbox.current = o
            penulis.current = new PenulisJawaban({
                catat: (soalId, isi, ragu, ms) => o.catat(soalId, isi, ragu, ms),
                setelahTulis: () => penyinkron.current?.picu(),
                saatGagalBerubah: setGagalSimpan,
                jedaTeksMs: JEDA_TEKS_MS,
            })
            jam.current = j
            setJawaban(await o.jawaban())
            setBerakhir(sesi.mulai.berakhir_pada)
            setData(hasil)

            const kumpulTertunda = await penyimpanan.ambil<boolean>(`attempt:${attemptId}:kumpul`)
            setStatus(kumpulTertunda ? 'menunggu_sinkron' : 'mengerjakan')

            const p = new Penyinkron({
                api,
                outbox: o,
                attemptId,
                jam: j,
                detak: () => ({
                    soal_aktif: soalAktif.current,
                    kiosk_aktif: kios.current,
                    ...(sesi.mulai.lokasi_wajib && posisi.current ? { lokasi: tanpaWaktu(posisi.current) } : {}),
                }),
                saatRespons: (r) => {
                    setBerakhir(r.berakhir_pada)
                    if (r.pesan_pengawas && r.pesan_pada) setPesan({ teks: r.pesan_pengawas, pada: r.pesan_pada })
                    const tolak = r.ditolak ?? []
                    if (tolak.length > 0 || Object.keys(r.diakui).length > 0) {
                        setDitolak((d) => {
                            const baru = { ...d }
                            for (const id of Object.keys(r.diakui)) delete baru[id]
                            for (const t of tolak) baru[String(t.soal_id)] = t.alasan
                            return baru
                        })
                    }
                    // Diakhiri pengawas / waktu habis: server masih menerima jawaban offline yang
                    // dibuat sebelumnya, jadi kirim habis antrean dulu baru bersihkan data lokal.
                    if (r.status === 'selesai') {
                        setAlasanSelesai(r.alasan_selesai ?? null)
                        void selesaiSetelahTerkirim()
                    }
                    else if (r.status === 'terkunci') setStatus('terkunci')
                    else if (statusRef.current === 'terkunci') setStatus('mengerjakan')
                },
                saatStatusKoneksi: (online, tertunda) => setKoneksi({ online, tertunda }),
                saatGalat: (g) => {
                    const pesan = (g.message || '').toLowerCase()
                    const kode = (g.kode || '').toUpperCase()
                    if (kode === 'TERKUNCI') {
                        setStatus('terkunci')
                    } else if (
                        kode === 'SUDAH_SELESAI' ||
                        kode === 'SELESAI' ||
                        kode === 'SUDAH_DITUTUP' ||
                        g.status === 409 ||
                        pesan.includes('selesai') ||
                        pesan.includes('dikumpulkan')
                    ) {
                        setAlasanSelesai(alasanDariGalat(g))
                        void selesai()
                    }
                },
            })
            const selesaiSetelahTerkirim = async () => {
                await penulis.current?.tulisSemua()
                // Respons sinkron berikutnya memanggil ini lagi sampai antrean kosong.
                if ((await o.jumlahTertunda()) === 0) void selesai()
                else p.picu()
            }
            penyinkron.current = p
            p.mulai()
            if (kumpulTertunda) {
                void kumpulRef.current()
            }
        })()

        const segarkan = () => void penyinkron.current?.kirim()
        // App ke latar / halaman ditutup: OS bisa mematikan app kapan saja, jadi ketikan yang
        // masih ditunda ditulis sekarang dan dikirim selagi bisa.
        const amankan = () => void penulis.current?.tulisSemua().then(segarkan)
        const terlihat = () => (document.visibilityState === 'visible' ? segarkan() : amankan())
        window.addEventListener('online', segarkan)
        window.addEventListener('pagehide', amankan)
        document.addEventListener('visibilitychange', terlihat)

        return () => {
            batal = true
            // Layar ujian ditutup: tulis yang tertunda dulu, baru sinkron dihentikan.
            void penulis.current?.henti()
            penyinkron.current?.henti()
            window.removeEventListener('online', segarkan)
            window.removeEventListener('pagehide', amankan)
            document.removeEventListener('visibilitychange', terlihat)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attemptId])

    // Posisi untuk detak (ujian di sekolah). Gagal membaca GPS bukan galat ujian — coba lagi nanti.
    const lokasiWajib = !!data?.sesi.mulai.lokasi_wajib
    useEffect(() => {
        if (!lokasiWajib || status !== 'mengerjakan') return
        const baca = () =>
            void ambilPosisi({ maksUmurMs: SELANG_LOKASI_MS })
                .then((p) => (posisi.current = p))
                .catch(() => undefined)
        baca()
        const t = setInterval(baca, SELANG_LOKASI_MS)

        return () => clearInterval(t)
    }, [lokasiWajib, status])

    // App native: sematkan layar selama mengerjakan (juga setelah app dibuka ulang), laporkan statusnya.
    const levelUjian = data?.sesi.ujian.level_keamanan
    useEffect(() => {
        if (!adaNative() || status !== 'mengerjakan' || !levelUjian) return
        let batal = false
        const baca = async () => {
            const aktif = await statusKunciLayar()
            if (!batal) kios.current = aktif
        }
        void (async () => {
            if (levelUjian !== 'dasar' && !(await statusKunciLayar())) kios.current = await kunciLayar()
            await baca()
        })()
        const t = setInterval(() => void baca(), 10_000)

        return () => {
            batal = true
            clearInterval(t)
        }
    }, [status, levelUjian])

    const selesai = useCallback(async () => {
        penyinkron.current?.henti()
        penulis.current?.buang()
        await lepasKunciLayar()
        const ujianId = data?.sesi.ujian.id ?? (await muatUjian(attemptId).catch(() => null))?.sesi.ujian.id
        if (ujianId) await bersihkan(attemptId, ujianId)
        setStatus('selesai')
    }, [attemptId, data])

    /** Simpan jawaban: tampil seketika, tulis lokal, kirim. Teks ditunda sebentar (tiap ketukan tidak perlu ditulis). */
    const jawab = useCallback(
        (soalId: number, isi: Jawaban, ragu: boolean, opsi: { teks?: boolean } = {}) => {
            if (statusRef.current === 'selesai') return
            setJawaban((j) => ({ ...j, [soalId]: { jawaban: isi, ragu } }))
            penulis.current?.catat(soalId, isi, ragu, msSejakMulai(), opsi)
        },
        [msSejakMulai],
    )

    /**
     * Kumpul: semua jawaban harus sudah diakui server dulu. Offline → tandai
     * "menunggu sinkron" (tersimpan, bertahan muat ulang) dan coba terus.
     */
    const kumpul = useCallback(async () => {
        if (!outbox.current || !penyinkron.current || sedangKumpul.current) return
        sedangKumpul.current = true
        try {
            setGalatKumpul(null)
            setStatus('mengumpulkan')
            // Jawaban yang belum tertulis di perangkat bisa hilang bila app tertutup sebelum terkirim: jangan kumpul dulu.
            if ((await penulis.current?.tulisSemua()) ?? 0) {
                setGalatKumpul('Ada jawaban yang belum tersimpan di perangkat. Jangan tutup aplikasi; panggil pengawas lalu coba kumpulkan lagi.')
                setStatus('mengerjakan')

                return
            }
            await penyimpanan.simpan(`attempt:${attemptId}:kumpul`, true)
            const ms = msSejakMulai()

            for (;;) {
                await penyinkron.current.kirim()
                if ((await outbox.current.jumlahTertunda()) === 0) {
                    try {
                        const hasil = await api.kumpul(attemptId, ms)
                        setAlasanSelesai(hasil.alasan_selesai ?? null)
                        await selesai()

                        return
                    } catch (e) {
                        const g = e instanceof GalatApi ? e : null
                        const pesan = (g?.message || '').toLowerCase()
                        const kode = (g?.kode || '').toUpperCase()
                        if (
                            kode === 'SUDAH_SELESAI' ||
                            kode === 'SELESAI' ||
                            kode === 'SUDAH_DITUTUP' ||
                            g?.status === 409 ||
                            pesan.includes('selesai') ||
                            pesan.includes('dikumpulkan')
                        ) {
                            setAlasanSelesai(alasanDariGalat(g))
                            await selesai()

                            return
                        }
                        if (!g?.sementara) {
                            await penyimpanan.hapus(`attempt:${attemptId}:kumpul`)
                            setGalatKumpul(g?.message ?? 'Gagal mengumpulkan.')
                            setStatus(g?.kode === 'TERKUNCI' ? 'terkunci' : 'mengerjakan')

                            return
                        }
                    }
                }
                setStatus('menunggu_sinkron')
                await new Promise((r) => setTimeout(r, 5000))
            }
        } finally {
            sedangKumpul.current = false
        }
    }, [attemptId, msSejakMulai, selesai])

    kumpulRef.current = kumpul

    // Kumpul yang tertunda sebelum app ditutup: lanjutkan otomatis.
    useEffect(() => {
        if (status === 'menunggu_sinkron' && data && penyinkron.current) {
            void kumpul()
        }
    }, [status, data, kumpul])

    return {
        data,
        status,
        jawaban,
        berakhir,
        koneksi,
        pesan,
        galatKumpul,
        gagalSimpan,
        ditolak,
        alasanSelesai,
        jam: jam.current,
        msSejakMulai,
        jawab,
        kumpul,
        batalKumpul: async () => {
            await penyimpanan.hapus(`attempt:${attemptId}:kumpul`)
            setStatus('mengerjakan')
        },
        /** Kunci dari balasan /pelanggaran; sinkron berikutnya membukanya bila pengawas membuka. */
        tandaiTerkunci: () => {
            if (statusRef.current === 'mengerjakan') setStatus('terkunci')
        },
        setSoalAktif: (id: number) => {
            soalAktif.current = id
        },
    }
}
