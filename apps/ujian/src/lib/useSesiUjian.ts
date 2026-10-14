import { api } from '@/lib/api'
import { bersihkan, muatUjian, penyimpanan, type SesiUjian } from '@/lib/ujian'
import { GalatApi, JamServer, Outbox, Penyinkron, type IsiPaket, type Jawaban } from '@erapor-cbt/exam-core'
import { useCallback, useEffect, useRef, useState } from 'react'

export type StatusUjian = 'memuat' | 'mengerjakan' | 'terkunci' | 'mengumpulkan' | 'menunggu_sinkron' | 'selesai' | 'tidak_ada'

export type IsiJawaban = Record<string, { jawaban: Jawaban; ragu: boolean }>

const JEDA_TEKS_MS = 700

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

    const outbox = useRef<Outbox>()
    const jam = useRef<JamServer>()
    const penyinkron = useRef<Penyinkron>()
    const soalAktif = useRef<number | null>(null)
    const tundaTeks = useRef(new Map<number, ReturnType<typeof setTimeout>>())
    const statusRef = useRef<StatusUjian>('memuat')
    statusRef.current = status

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
                detak: () => ({ soal_aktif: soalAktif.current, kiosk_aktif: null }),
                saatRespons: (r) => {
                    setBerakhir(r.berakhir_pada)
                    if (r.pesan_pengawas && r.pesan_pada) setPesan({ teks: r.pesan_pengawas, pada: r.pesan_pada })
                    if (r.status === 'selesai') void selesai()
                    else if (r.status === 'terkunci') setStatus('terkunci')
                    else if (statusRef.current === 'terkunci') setStatus('mengerjakan')
                },
                saatStatusKoneksi: (online, tertunda) => setKoneksi({ online, tertunda }),
                saatGalat: (g) => {
                    if (g.kode === 'TERKUNCI') setStatus('terkunci')
                    else if (g.kode === 'SUDAH_SELESAI') void selesai()
                },
            })
            penyinkron.current = p
            p.mulai()
        })()

        const segarkan = () => void penyinkron.current?.kirim()
        const terlihat = () => document.visibilityState === 'visible' && segarkan()
        window.addEventListener('online', segarkan)
        document.addEventListener('visibilitychange', terlihat)

        return () => {
            batal = true
            penyinkron.current?.henti()
            window.removeEventListener('online', segarkan)
            document.removeEventListener('visibilitychange', terlihat)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [attemptId])

    const selesai = useCallback(async () => {
        penyinkron.current?.henti()
        const ujianId = data?.sesi.ujian.id ?? (await muatUjian(attemptId).catch(() => null))?.sesi.ujian.id
        if (ujianId) await bersihkan(attemptId, ujianId)
        setStatus('selesai')
    }, [attemptId, data])

    /** Simpan jawaban: tampil seketika, tulis lokal, kirim. Teks ditunda sebentar (tiap ketukan tidak perlu ditulis). */
    const jawab = useCallback(
        (soalId: number, isi: Jawaban, ragu: boolean, opsi: { teks?: boolean } = {}) => {
            setJawaban((j) => ({ ...j, [soalId]: { jawaban: isi, ragu } }))
            const tulis = async () => {
                tundaTeks.current.delete(soalId)
                await outbox.current?.catat(soalId, isi, ragu, msSejakMulai())
                penyinkron.current?.picu()
            }
            const lama = tundaTeks.current.get(soalId)
            if (lama) clearTimeout(lama)
            if (opsi.teks) tundaTeks.current.set(soalId, setTimeout(() => void tulis(), JEDA_TEKS_MS))
            else void tulis()
        },
        [msSejakMulai],
    )

    const tulisSemuaTertunda = useCallback(async () => {
        for (const [soalId, t] of tundaTeks.current) {
            clearTimeout(t)
            const j = jawaban[soalId]
            if (j) await outbox.current?.catat(soalId, j.jawaban, j.ragu, msSejakMulai())
        }
        tundaTeks.current.clear()
    }, [jawaban, msSejakMulai])

    /**
     * Kumpul: semua jawaban harus sudah diakui server dulu. Offline → tandai
     * "menunggu sinkron" (tersimpan, bertahan muat ulang) dan coba terus.
     */
    const kumpul = useCallback(async () => {
        if (!outbox.current || !penyinkron.current) return
        setGalatKumpul(null)
        setStatus('mengumpulkan')
        await tulisSemuaTertunda()
        await penyimpanan.simpan(`attempt:${attemptId}:kumpul`, true)
        const ms = msSejakMulai()

        for (;;) {
            await penyinkron.current.kirim()
            if ((await outbox.current.jumlahTertunda()) === 0) {
                try {
                    await api.kumpul(attemptId, ms)
                    await selesai()

                    return
                } catch (e) {
                    const g = e instanceof GalatApi ? e : null
                    if (g?.kode === 'SUDAH_SELESAI') {
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
    }, [attemptId, msSejakMulai, selesai, tulisSemuaTertunda])

    // Kumpul yang tertunda sebelum app ditutup: lanjutkan otomatis.
    useEffect(() => {
        if (status === 'menunggu_sinkron' && data && penyinkron.current) void kumpul()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data])

    return {
        data,
        status,
        jawaban,
        berakhir,
        koneksi,
        pesan,
        galatKumpul,
        jam: jam.current,
        msSejakMulai,
        jawab,
        kumpul,
        /** Kunci dari balasan /pelanggaran; sinkron berikutnya membukanya bila pengawas membuka. */
        tandaiTerkunci: () => {
            if (statusRef.current === 'mengerjakan') setStatus('terkunci')
        },
        setSoalAktif: (id: number) => {
            soalAktif.current = id
        },
    }
}
