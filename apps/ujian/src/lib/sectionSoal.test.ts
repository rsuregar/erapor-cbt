import type { SoalPaket } from '@erapor-cbt/exam-core'
import { describe, expect, it } from 'vitest'
import { kelompokkanPerSection } from './sectionSoal'

const soal = (nomor: number, section?: string | null): SoalPaket => ({
    id: nomor * 10,
    nomor,
    jenis: 'pilihan_ganda',
    section,
    stimulus_id: null,
    pertanyaan: { type: 'doc', content: [] },
    opsi: null,
    bobot: 1,
})

describe('kelompokkanPerSection', () => {
    it('paket lama tanpa section tetap satu grid tanpa judul', () => {
        const k = kelompokkanPerSection([soal(1), soal(2, null), soal(3, '  ')])
        expect(k).toHaveLength(1)
        expect(k[0]).toMatchObject({ section: null, nomorAwal: 1, nomorAkhir: 3 })
    })

    it('mengelompokkan soal berurutan dengan rentang nomor dan indeks paket', () => {
        const k = kelompokkanPerSection([soal(1, 'Bagian I: PG'), soal(2, 'Bagian I: PG'), soal(3, 'Bagian II: Isian')])
        expect(k.map((g) => [g.section, g.nomorAwal, g.nomorAkhir])).toEqual([
            ['Bagian I: PG', 1, 2],
            ['Bagian II: Isian', 3, 3],
        ])
        expect(k[1].butir[0].indeks).toBe(2)
    })

    it('section yang muncul lagi setelah section lain menjadi kelompok baru (urutan paket dipertahankan)', () => {
        const k = kelompokkanPerSection([soal(1, 'A'), soal(2, null), soal(3, 'A')])
        expect(k.map((g) => g.section)).toEqual(['A', null, 'A'])
    })
})
