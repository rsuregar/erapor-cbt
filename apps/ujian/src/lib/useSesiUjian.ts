import { api } from '@/lib/api'
import { buatArsipDariSesi, simpanArsipJawaban } from '@/lib/arsipJawaban'
import { ambilPosisi, tanpaWaktu, type PosisiDidapat } from '@/lib/lokasi'
import { adaNative, kunciLayar, lepasKunciLayar, statusKunciLayar } from '@/lib/native'
import { PenulisJawaban } from '@/lib/penulisJawaban'
import { bersihkan, muatUjian, penyimpanan, type PetaMedia, type SesiUjian } from '@/lib/ujian'
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

/** Hanya kode terminal eksplisit yang menandakan sesi sudah selesai di server (bukan 409/BELUM_MINIMAL/TERKUNCI). */
export function adalahGalatSelesai(g: GalatApi | null, izinkan404 = false): boolean {
    if (!g) return false
    const kode = (g.kode || '').toUpperCase()

    return kode === 'SUDAH_SELESAI' || kode === 'SELESAI' || kode === 'SUDAH_DITUTUP' || (izinkan404 && g.status === 404)
}

/**
 * Satu sesi mengerjakan: jawaban (outbox lokal dulu, PRD "offline-first"),
 * jam server, sinkron 15 detik, kunci/buka dari pengawas, pesan pengawas,
 * dan kumpul — termasuk kumpul yang tertunda karena offline.
 */
export function useSesiUjian(attemptId: number) {
    const [data, setData] = useState<{ sesi: SesiUjian; isi: IsiPaket; media: PetaMedia } | null>(null)
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
    /** Server menolak karena attempt ini sudah dipegang perangkat lain (akun dipakai bersama / pindah perangkat). */
    const [perangkatLain, setPerangkatLain] = useState(false)
    /** Jumlah soal terjawab yang dikonfirmasi server saat kumpul berhasil. */
    const [jumlahTerjawabServer, setJumlahTerjawabServer] = useState<number | null>(null)
    /** Murid sudah melepas kios lewat "Ganti Wi-Fi / Hotspot" saat menunggu sinkron — tidak boleh kembali mengedit soal. */
    const [kumpulFinal, setKumpulFinal] = useState(false)

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
    const ditolakRef = useRef<Record<string, AlasanDitolak | string>>({})
    ditolakRef.current = ditolak
    const batalKumpulRef = useRef(false)
    const kumpulFinalRef = useRef(false)
    const bangunTungguRef = useRef<(() => void) | null>(null)
    const kumpulRef = useRef<() => Promise<void>>(async () => {})

    const tungguDenganBangun = useCallback((ms: number) => {
        return new Promise<void>((resolve) => {
            const timer = setTimeout(() => {
                bangunTungguRef.current = null
                resolve()
            }, ms)
            bangunTungguRef.current = () => {
                clearTimeout(timer)
                bangunTungguRef.current = null
                resolve()
            }
        })
    }, [])

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
            const kumpulTerkunci = Boolean(await penyimpanan.ambil<boolean>(`attempt:${attemptId}:kumpul_final`))
            kumpulFinalRef.current = kumpulTerkunci
            setKumpulFinal(kumpulTerkunci)
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
                        const baru = { ...ditolakRef.current }
                        for (const id of Object.keys(r.diakui)) delete baru[id]
                        for (const t of tolak) baru[String(t.soal_id)] = t.alasan
                        ditolakRef.current = baru
                        setDitolak(baru)
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
                    const kode = (g.kode || '').toUpperCase()
                    if (kode === 'PERANGKAT_LAIN') {
                        // Ujian sudah dibuka di perangkat lain: hentikan kirim, jangan dianggap selesai (409).
                        setPerangkatLain(true)
                        p.henti()

                        return
                    }
                    if (kode === 'TERKUNCI') {
                        setStatus('terkunci')
                    } else if (adalahGalatSelesai(g, true)) {
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

        const segarkan = () => {
            bangunTungguRef.current?.()
            void penyinkron.current?.kirim()
        }
        // App ke latar / halaman ditutup: OS bisa mematikan app kapan saja, jadi ketikan yang
        // masih ditunda ditulis sekarang dan dikirim selagi bisa.
        const amankan = () => void penulis.current?.tulisSemua().then(segarkan)
        const terlihat = () => (document.visibilityState === 'visible' ? segarkan() : amankan())
        window.addEventListener('online', segarkan)
        window.addEventListener('pagehide', amankan)
        document.addEventListener('visibilitychange', terlihat)

        return () => {
            batal = true
            batalKumpulRef.current = true
            bangunTungguRef.current?.()
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
        const muatLokal = data ? null : await muatUjian(attemptId).catch(() => null)
        const sesiArsip = data?.sesi ?? muatLokal?.sesi
        const soalArsip = data?.isi.soal ?? muatLokal?.isi.soal
        const jawabanArsip =
            (await outbox.current?.jawaban().catch(() => undefined)) ??
            (await new Outbox(penyimpanan, attemptId).jawaban().catch(() => undefined))
        if (sesiArsip && soalArsip && jawabanArsip) {
            await simpanArsipJawaban(
                buatArsipDariSesi({
                    sesi: sesiArsip,
                    soal: soalArsip,
                    jawaban: jawabanArsip,
                    ditolak: ditolakRef.current,
                }),
            ).catch(() => undefined)
        }
        const ujianId = sesiArsip?.ujian.id
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
        if (!outbox.current || !penyinkron.current) return
        if (sedangKumpul.current) {
            setStatus('mengumpulkan')
            bangunTungguRef.current?.()

            return
        }
        sedangKumpul.current = true
        batalKumpulRef.current = false
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
                const sudahSelesai = () => statusRef.current === 'selesai'
                if (batalKumpulRef.current || sudahSelesai()) return
                setStatus('mengumpulkan')
                await penyinkron.current.kirim()
                if (batalKumpulRef.current || sudahSelesai()) return
                if ((await outbox.current.jumlahTertunda()) === 0) {
                    try {
                        const hasil = await api.kumpul(attemptId, ms)
                        if (typeof hasil.jumlah_terjawab === 'number') setJumlahTerjawabServer(hasil.jumlah_terjawab)
                        setAlasanSelesai(hasil.alasan_selesai ?? null)
                        await selesai()

                        return
                    } catch (e) {
                        const g = e instanceof GalatApi ? e : null
                        const kode = (g?.kode || '').toUpperCase()
                        if (kode === 'PERANGKAT_LAIN') {
                            await penyimpanan.hapus(`attempt:${attemptId}:kumpul`)
                            setPerangkatLain(true)
                            setStatus('mengerjakan')

                            return
                        }
                        if (kode === 'TERKUNCI') {
                            await penyimpanan.hapus(`attempt:${attemptId}:kumpul`)
                            setStatus('terkunci')

                            return
                        }
                        if (adalahGalatSelesai(g, false)) {
                            setAlasanSelesai(alasanDariGalat(g))
                            await selesai()

                            return
                        }
                        if (!g?.sementara) {
                            await penyimpanan.hapus(`attempt:${attemptId}:kumpul`)
                            setGalatKumpul(g?.message ?? 'Gagal mengumpulkan.')
                            setStatus('mengerjakan')

                            return
                        }
                    }
                }
                if (batalKumpulRef.current || sudahSelesai()) return
                setStatus('menunggu_sinkron')
                await tungguDenganBangun(5000)
                if (batalKumpulRef.current || sudahSelesai()) return
            }
        } finally {
            sedangKumpul.current = false
        }
    }, [attemptId, msSejakMulai, selesai, tungguDenganBangun])

    kumpulRef.current = kumpul

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
        perangkatLain,
        jumlahTerjawabServer,
        kumpulFinal,
        jam: jam.current,
        msSejakMulai,
        jawab,
        kumpul,
        tandaiKumpulFinal: async () => {
            kumpulFinalRef.current = true
            setKumpulFinal(true)
            await penyimpanan.simpan(`attempt:${attemptId}:kumpul_final`, true)
        },
        batalKumpul: async () => {
            if (kumpulFinalRef.current) return
            batalKumpulRef.current = true
            bangunTungguRef.current?.()
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
