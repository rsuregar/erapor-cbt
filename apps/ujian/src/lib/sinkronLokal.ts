import { api } from '@/lib/api'
import { buatArsipDariSesi, simpanArsipJawaban } from '@/lib/arsipJawaban'
import { sesi as sesiAkun } from '@/lib/sesi'
import { bersihkan, muatUjian, penyimpanan, type SesiUjian } from '@/lib/ujian'
import { GalatApi, Outbox, type KlienApi, type Penyimpanan } from '@erapor-cbt/exam-core'

export type OutboxTertunda = {
    attemptId: number
    ujianId: number
    namaUjian: string
    jumlahTertunda: number
    kumpulTertunda: boolean
}

export type JawabanDitolakInfo = {
    soalId: number
    alasan: string
}

export type HasilSinkronItem = {
    attemptId: number
    ujianId: number
    namaUjian: string
    terkirim: number
    ditolak: JawabanDitolakInfo[]
    sisaTertunda: number
    status: 'terkirim' | 'sebagian_ditolak' | 'offline' | 'perangkat_lain' | 'galat'
    pesan?: string
}

type DepsSinkronLokal = {
    simpan?: Penyimpanan
    klienApi?: Pick<KlienApi, 'sinkron' | 'kumpul'>
    pemilik?: string | null
    bersihkanAttempt?: (attemptId: number, ujianId: number) => Promise<void>
    simpanArsip?: (attemptId: number, ditolak: JawabanDitolakInfo[]) => Promise<void>
}

/**
 * Daftar ujian yang masih punya antrean jawaban lokal (outbox) atau penanda kumpul
 * tertunda untuk akun murid yang sedang aktif. Berguna agar Beranda bisa memulihkan
 * dan mengirim jawaban offline meskipun status ujian di server sudah berubah `selesai`.
 */
export async function daftarOutboxTertunda(deps: DepsSinkronLokal = {}): Promise<OutboxTertunda[]> {
    const simpan = deps.simpan ?? penyimpanan
    const pemilik = deps.pemilik !== undefined ? deps.pemilik : sesiAkun.uuid()
    const kunciSemua = await simpan.daftarKunci('attempt:')
    const hasil: OutboxTertunda[] = []

    for (const k of kunciSemua) {
        if (!k.endsWith(':sesi')) continue
        const s = await simpan.ambil<SesiUjian>(k)
        if (!s || s.pemilik !== pemilik) continue

        const attemptId = s.mulai.attempt_id
        const o = new Outbox(simpan, attemptId)
        const jumlahTertunda = await o.jumlahTertunda()
        const kumpulTertunda = Boolean(await simpan.ambil<boolean>(`attempt:${attemptId}:kumpul`))

        if (jumlahTertunda > 0 || kumpulTertunda) {
            hasil.push({
                attemptId,
                ujianId: s.ujian.id,
                namaUjian: s.ujian.nama,
                jumlahTertunda,
                kumpulTertunda,
            })
        }
    }

    return hasil
}

/**
 * Kirim semua outbox lokal & kumpul tertunda dari Beranda.
 * Data lokal hanya dibersihkan bila outbox benar-benar kosong (`jumlahTertunda === 0`)
 * dan attempt sudah selesai di server. Tidak pernah menghapus data saat error jaringan
 * sementara atau konflik perangkat.
 */
export async function sinkronSemuaTertunda(deps: DepsSinkronLokal = {}): Promise<HasilSinkronItem[]> {
    const simpan = deps.simpan ?? penyimpanan
    const klienApi = deps.klienApi ?? api
    const hapusSesi = deps.bersihkanAttempt ?? bersihkan
    const arsipkan =
        deps.simpanArsip ??
        (async (attemptId: number, ditolak: JawabanDitolakInfo[]) => {
            if (deps.simpan) return
            const hasilMuat = await muatUjian(attemptId).catch(() => null)
            if (!hasilMuat) return
            const jawabanLokal = await new Outbox(simpan, attemptId).jawaban().catch(() => null)
            if (!jawabanLokal) return
            const petaDitolak = Object.fromEntries(ditolak.map((d) => [String(d.soalId), d.alasan]))
            await simpanArsipJawaban(
                buatArsipDariSesi({
                    sesi: hasilMuat.sesi,
                    soal: hasilMuat.isi.soal,
                    jawaban: jawabanLokal,
                    ditolak: petaDitolak,
                }),
                simpan,
            ).catch(() => undefined)
        })
    const daftar = await daftarOutboxTertunda(deps)
    const hasil: HasilSinkronItem[] = []

    for (const item of daftar) {
        const o = new Outbox(simpan, item.attemptId)
        try {
            const antrean = await o.antrean()
            const r = await klienApi.sinkron(item.attemptId, antrean)
            await o.akui(r.diakui)
            const sisa = await o.jumlahTertunda()
            const terkirim = Math.max(0, antrean.length - sisa)
            const ditolak: JawabanDitolakInfo[] = (r.ditolak ?? []).map((d) => ({
                soalId: d.soal_id,
                alasan: String(d.alasan),
            }))

            if (sisa === 0) {
                if (r.status === 'selesai') {
                    await arsipkan(item.attemptId, ditolak)
                    await hapusSesi(item.attemptId, item.ujianId)
                } else if (item.kumpulTertunda) {
                    try {
                        await klienApi.kumpul(item.attemptId)
                        await arsipkan(item.attemptId, ditolak)
                        await hapusSesi(item.attemptId, item.ujianId)
                    } catch (e) {
                        const g = e instanceof GalatApi ? e : null
                        const kode = (g?.kode || '').toUpperCase()
                        if (kode === 'PERANGKAT_LAIN') {
                            hasil.push({
                                attemptId: item.attemptId,
                                ujianId: item.ujianId,
                                namaUjian: item.namaUjian,
                                terkirim,
                                ditolak,
                                sisaTertunda: sisa,
                                status: 'perangkat_lain',
                                pesan: g?.message,
                            })
                            continue
                        }
                        if (kode === 'SUDAH_SELESAI' || kode === 'SELESAI' || kode === 'SUDAH_DITUTUP') {
                            await arsipkan(item.attemptId, ditolak)
                            await hapusSesi(item.attemptId, item.ujianId)
                        } else if (g?.sementara) {
                            hasil.push({
                                attemptId: item.attemptId,
                                ujianId: item.ujianId,
                                namaUjian: item.namaUjian,
                                terkirim,
                                ditolak,
                                sisaTertunda: sisa,
                                status: 'offline',
                                pesan: g.message,
                            })
                            continue
                        } else {
                            await simpan.hapus(`attempt:${item.attemptId}:kumpul`)
                            hasil.push({
                                attemptId: item.attemptId,
                                ujianId: item.ujianId,
                                namaUjian: item.namaUjian,
                                terkirim,
                                ditolak,
                                sisaTertunda: sisa,
                                status: 'galat',
                                pesan: g?.message ?? 'Gagal mengumpulkan ujian.',
                            })
                            continue
                        }
                    }
                }
            }

            hasil.push({
                attemptId: item.attemptId,
                ujianId: item.ujianId,
                namaUjian: item.namaUjian,
                terkirim,
                ditolak,
                sisaTertunda: sisa,
                status: ditolak.length > 0 ? 'sebagian_ditolak' : 'terkirim',
            })
        } catch (e) {
            const g = e instanceof GalatApi ? e : new GalatApi('JARINGAN', e instanceof Error ? e.message : String(e), 0)
            const kode = (g.kode || '').toUpperCase()
            const sisa = await o.jumlahTertunda()

            if (kode === 'PERANGKAT_LAIN') {
                hasil.push({
                    attemptId: item.attemptId,
                    ujianId: item.ujianId,
                    namaUjian: item.namaUjian,
                    terkirim: 0,
                    ditolak: [],
                    sisaTertunda: sisa,
                    status: 'perangkat_lain',
                    pesan: g.message,
                })
            } else if (g.sementara) {
                hasil.push({
                    attemptId: item.attemptId,
                    ujianId: item.ujianId,
                    namaUjian: item.namaUjian,
                    terkirim: 0,
                    ditolak: [],
                    sisaTertunda: sisa,
                    status: 'offline',
                    pesan: g.message,
                })
            } else if (
                kode === 'SUDAH_SELESAI' ||
                kode === 'SELESAI' ||
                kode === 'SUDAH_DITUTUP' ||
                g.status === 404
            ) {
                // Attempt ditutup/dihapus: jangan loop selamanya bila tidak ada jawaban baru yang tersisa.
                if (sisa === 0) {
                    await arsipkan(item.attemptId, [])
                    await hapusSesi(item.attemptId, item.ujianId)
                }
                hasil.push({
                    attemptId: item.attemptId,
                    ujianId: item.ujianId,
                    namaUjian: item.namaUjian,
                    terkirim: 0,
                    ditolak: [],
                    sisaTertunda: sisa,
                    status: 'galat',
                    pesan: g.message,
                })
            } else {
                hasil.push({
                    attemptId: item.attemptId,
                    ujianId: item.ujianId,
                    namaUjian: item.namaUjian,
                    terkirim: 0,
                    ditolak: [],
                    sisaTertunda: sisa,
                    status: 'galat',
                    pesan: g.message,
                })
            }
        }
    }

    return hasil
}
