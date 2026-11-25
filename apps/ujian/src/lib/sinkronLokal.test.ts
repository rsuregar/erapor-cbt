import { GalatApi, Outbox, PenyimpananMemori, type SinkronRespons } from '@erapor-cbt/exam-core'
import { describe, expect, it, vi } from 'vitest'
import { daftarOutboxTertunda, sinkronSemuaTertunda } from './sinkronLokal'
import type { SesiUjian } from './ujian'

function buatSesi(attemptId: number, ujianId: number, nama: string, pemilik = 'murid-1'): SesiUjian {
    return {
        pemilik,
        selisihJam: 0,
        ujian: { id: ujianId, nama, mapel: 'Matematika', level_keamanan: 'ketat' },
        mulai: {
            attempt_id: attemptId,
            kunci: 'kunci',
            waktu_server: '2026-11-25T08:00:00+08:00',
            mulai_pada: '2026-11-25T07:00:00+08:00',
            berakhir_pada: '2026-11-25T08:30:00+08:00',
            minimal_kumpul_pada: null,
            ambang_pelanggaran: 3,
            level_keamanan: 'ketat',
            lokasi_wajib: false,
            jawaban_tersimpan: {},
        },
    }
}

describe('sinkronLokal', () => {
    it('mendeteksi outbox tertunda hanya untuk pemilik sesi saat ini', async () => {
        const simpan = new PenyimpananMemori()
        await simpan.simpan('attempt:11:sesi', buatSesi(11, 101, 'Matematika', 'murid-1'))
        await simpan.simpan('attempt:22:sesi', buatSesi(22, 102, 'Fisika', 'murid-lain'))

        const o1 = new Outbox(simpan, 11)
        await o1.catat(1, 'o2', false, 10_000)
        const o2 = new Outbox(simpan, 22)
        await o2.catat(2, 'o1', false, 10_000)

        const daftar = await daftarOutboxTertunda({ simpan, pemilik: 'murid-1' })
        expect(daftar).toEqual([
            {
                attemptId: 11,
                ujianId: 101,
                namaUjian: 'Matematika',
                jumlahTertunda: 1,
                kumpulTertunda: false,
            },
        ])
    })

    it('mengirim jawaban tertunda walau status server sudah selesai lalu membersihkan sesi lokal', async () => {
        const simpan = new PenyimpananMemori()
        await simpan.simpan('attempt:11:sesi', buatSesi(11, 101, 'Matematika'))
        const o = new Outbox(simpan, 11)
        await o.catat(501, 'o2', false, 50_000)
        await o.catat(502, 'o3', false, 60_000)

        const bersihkanAttempt = vi.fn(async (attemptId: number) => {
            for (const k of await simpan.daftarKunci(`attempt:${attemptId}:`)) await simpan.hapus(k)
        })
        const klienApi = {
            sinkron: vi.fn(async (): Promise<SinkronRespons> => ({
                diakui: { 501: 1, 502: 1 },
                ditolak: [],
                waktu_server: '2026-11-25T09:00:00+08:00',
                berakhir_pada: '2026-11-25T08:30:00+08:00',
                status: 'selesai',
                pesan_pengawas: null,
                pesan_pada: null,
            })),
            kumpul: vi.fn(),
        }

        const hasil = await sinkronSemuaTertunda({ simpan, klienApi, pemilik: 'murid-1', bersihkanAttempt })
        expect(hasil).toEqual([
            {
                attemptId: 11,
                ujianId: 101,
                namaUjian: 'Matematika',
                terkirim: 2,
                ditolak: [],
                sisaTertunda: 0,
                status: 'terkirim',
            },
        ])
        expect(klienApi.kumpul).not.toHaveBeenCalled()
        expect(bersihkanAttempt).toHaveBeenCalledWith(11, 101)
        expect(await daftarOutboxTertunda({ simpan, pemilik: 'murid-1' })).toEqual([])
    })

    it('melanjutkan kumpul tertunda bila status server masih mengerjakan', async () => {
        const simpan = new PenyimpananMemori()
        await simpan.simpan('attempt:12:sesi', buatSesi(12, 102, 'IPA'))
        await simpan.simpan('attempt:12:kumpul', true)
        const o = new Outbox(simpan, 12)
        await o.catat(601, 'o1', false, 45_000)

        const bersihkanAttempt = vi.fn(async (attemptId: number) => {
            for (const k of await simpan.daftarKunci(`attempt:${attemptId}:`)) await simpan.hapus(k)
        })
        const klienApi = {
            sinkron: vi.fn(async (): Promise<SinkronRespons> => ({
                diakui: { 601: 1 },
                ditolak: [],
                waktu_server: '2026-11-25T07:45:00+08:00',
                berakhir_pada: '2026-11-25T08:30:00+08:00',
                status: 'mengerjakan',
                pesan_pengawas: null,
                pesan_pada: null,
            })),
            kumpul: vi.fn(async () => ({ status: 'selesai', jumlah_terjawab: 1 })),
        }

        const hasil = await sinkronSemuaTertunda({ simpan, klienApi, pemilik: 'murid-1', bersihkanAttempt })
        expect(klienApi.kumpul).toHaveBeenCalledWith(12)
        expect(bersihkanAttempt).toHaveBeenCalledWith(12, 102)
        expect(hasil[0]).toMatchObject({ attemptId: 12, terkirim: 1, status: 'terkirim', sisaTertunda: 0 })
    })

    it('melaporkan jawaban yang ditolak server sebagai sebagian_ditolak', async () => {
        const simpan = new PenyimpananMemori()
        await simpan.simpan('attempt:13:sesi', buatSesi(13, 103, 'IPS'))
        const o = new Outbox(simpan, 13)
        await o.catat(701, 'o1', false, 999_000)

        const bersihkanAttempt = vi.fn(async () => {})
        const klienApi = {
            sinkron: vi.fn(async (): Promise<SinkronRespons> => ({
                diakui: { 701: 1 },
                ditolak: [{ soal_id: 701, alasan: 'LEWAT_WAKTU' }],
                waktu_server: '2026-11-25T11:00:00+08:00',
                berakhir_pada: '2026-11-25T08:30:00+08:00',
                status: 'selesai',
                pesan_pengawas: null,
                pesan_pada: null,
            })),
            kumpul: vi.fn(),
        }

        const hasil = await sinkronSemuaTertunda({ simpan, klienApi, pemilik: 'murid-1', bersihkanAttempt })
        expect(hasil[0]).toMatchObject({
            attemptId: 13,
            status: 'sebagian_ditolak',
            ditolak: [{ soalId: 701, alasan: 'LEWAT_WAKTU' }],
        })
    })

    it('mempertahankan data lokal bila masih offline atau konflik perangkat lain', async () => {
        const simpan = new PenyimpananMemori()
        await simpan.simpan('attempt:14:sesi', buatSesi(14, 104, 'PPKn'))
        const o = new Outbox(simpan, 14)
        await o.catat(801, 'o4', false, 15_000)

        const bersihkanAttempt = vi.fn(async () => {})

        const hasilOffline = await sinkronSemuaTertunda({
            simpan,
            pemilik: 'murid-1',
            bersihkanAttempt,
            klienApi: {
                sinkron: vi.fn(async () => {
                    throw new GalatApi('JARINGAN', 'Offline', 0)
                }),
                kumpul: vi.fn(),
            },
        })
        expect(hasilOffline[0]).toMatchObject({ attemptId: 14, status: 'offline', sisaTertunda: 1 })
        expect(bersihkanAttempt).not.toHaveBeenCalled()

        const hasilPerangkatLain = await sinkronSemuaTertunda({
            simpan,
            pemilik: 'murid-1',
            bersihkanAttempt,
            klienApi: {
                sinkron: vi.fn(async () => {
                    throw new GalatApi('PERANGKAT_LAIN', 'Dipakai perangkat lain', 409)
                }),
                kumpul: vi.fn(),
            },
        })
        expect(hasilPerangkatLain[0]).toMatchObject({ attemptId: 14, status: 'perangkat_lain', sisaTertunda: 1 })
        expect(bersihkanAttempt).not.toHaveBeenCalled()
    })
})
