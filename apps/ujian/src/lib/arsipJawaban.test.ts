import { PenyimpananMemori, type SoalPaket } from '@erapor-cbt/exam-core'
import { describe, expect, it } from 'vitest'
import {
    MASA_SIMPAN_ARSIP_MS,
    ambilArsipJawaban,
    bersihkanArsipKadaluarsa,
    buatArsipDariSesi,
    daftarArsipJawaban,
    ringkasJawabanLokal,
    simpanArsipJawaban,
} from './arsipJawaban'
import type { SesiUjian } from './ujian'

function buatSoalUji(): SoalPaket[] {
    const teks = (s: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: s }] }] })
    return [
        {
            id: 1,
            nomor: 1,
            jenis: 'pilihan_ganda',
            stimulus_id: null,
            pertanyaan: teks('RAHASIA-SOAL-1'),
            opsi: [{ id: 'o1' }, { id: 'o2' }, { id: 'o3' }],
            bobot: 2,
        },
        {
            id: 2,
            nomor: 2,
            jenis: 'pg_kompleks',
            stimulus_id: null,
            pertanyaan: teks('RAHASIA-SOAL-2'),
            opsi: [{ id: 'o1' }, { id: 'o2' }, { id: 'o3' }],
            bobot: 2,
        },
        {
            id: 3,
            nomor: 3,
            jenis: 'benar_salah',
            stimulus_id: null,
            pertanyaan: teks('RAHASIA-SOAL-3'),
            opsi: { pernyataan: [{ id: 'p1' }, { id: 'p2' }] },
            bobot: 2,
        },
        {
            id: 4,
            nomor: 4,
            jenis: 'menjodohkan',
            stimulus_id: null,
            pertanyaan: teks('RAHASIA-SOAL-4'),
            opsi: { kiri: [{ id: 'k1' }, { id: 'k2' }], kanan: [{ id: 'n1' }, { id: 'n2' }] },
            bobot: 2,
        },
        {
            id: 5,
            nomor: 5,
            jenis: 'uraian',
            stimulus_id: null,
            pertanyaan: teks('RAHASIA-SOAL-5'),
            opsi: null,
            bobot: 2,
        },
    ]
}

function buatSesi(attemptId: number, pemilik = 'murid-1'): SesiUjian {
    return {
        pemilik,
        selisihJam: 0,
        ujian: { id: 99, nama: 'PAS Matematika', mapel: 'Matematika', level_keamanan: 'ketat' },
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

describe('arsipJawaban', () => {
    it('meringkas semua jenis jawaban dengan format yang serasi dengan server', () => {
        const soal = buatSoalUji()
        expect(ringkasJawabanLokal(soal[0], 'o2')).toEqual({ terjawab: true, ringkasan: 'B' })
        expect(ringkasJawabanLokal(soal[1], ['o3', 'o1'])).toEqual({ terjawab: true, ringkasan: 'A, C' })
        expect(ringkasJawabanLokal(soal[2], { p1: true, p2: false })).toEqual({ terjawab: true, ringkasan: 'B, S' })
        expect(ringkasJawabanLokal(soal[3], { k1: 'n2', k2: '' })).toEqual({ terjawab: true, ringkasan: '1/2 pasangan' })
        expect(ringkasJawabanLokal(soal[4], '  Hukum Newton  ')).toEqual({ terjawab: true, ringkasan: 'Hukum Newton' })
        expect(ringkasJawabanLokal(soal[4], '   ')).toEqual({ terjawab: false, ringkasan: null })
    })

    it('menyimpan arsip selama 48 jam, memisahkan pemilik, dan menghapus yang kedaluwarsa', async () => {
        const simpan = new PenyimpananMemori()
        const t0 = 1_700_000_000_000
        const soal = buatSoalUji()
        const arsip = buatArsipDariSesi({
            sesi: buatSesi(10, 'murid-1'),
            soal,
            jawaban: {
                1: { jawaban: 'o2', ragu: false },
                2: { jawaban: ['o1'], ragu: true },
                5: { jawaban: '   ', ragu: false },
            },
            ditolak: { 2: 'LEWAT_WAKTU' },
            sekarang: t0,
        })

        expect(arsip.totalSoal).toBe(5)
        expect(arsip.jumlahTerjawab).toBe(2)
        expect(JSON.stringify(arsip)).not.toContain('RAHASIA-SOAL')

        await simpanArsipJawaban(arsip, simpan)

        // Dalam 47 jam: tersedia untuk pemiliknya, tersembunyi untuk murid lain.
        expect(await ambilArsipJawaban(10, { simpan, pemilik: 'murid-lain', sekarang: t0 + 1000 })).toBeNull()
        const terbaca = await ambilArsipJawaban(10, { simpan, pemilik: 'murid-1', sekarang: t0 + MASA_SIMPAN_ARSIP_MS - 1000 })
        expect(terbaca?.jumlahTerjawab).toBe(2)
        expect(terbaca?.ditolak).toEqual({ 2: 'LEWAT_WAKTU' })
        expect(await daftarArsipJawaban({ simpan, pemilik: 'murid-1', sekarang: t0 + 1000 })).toHaveLength(1)

        // Setelah melewati 48 jam: otomatis terhapus.
        const kadaluarsa = t0 + MASA_SIMPAN_ARSIP_MS + 1
        expect(await ambilArsipJawaban(10, { simpan, pemilik: 'murid-1', sekarang: kadaluarsa })).toBeNull()
        expect(await simpan.ambil('arsip-jawaban:10')).toBeUndefined()

        // Pastikan bersihkanArsipKadaluarsa membersihkan arsip lewat batas.
        await simpanArsipJawaban(arsip, simpan)
        expect(await bersihkanArsipKadaluarsa({ simpan, sekarang: kadaluarsa })).toBe(1)
        expect(await daftarArsipJawaban({ simpan, pemilik: 'murid-1', sekarang: kadaluarsa })).toEqual([])
    })
})
