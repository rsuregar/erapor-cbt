import { GalatApi } from '@erapor-cbt/exam-core'
import { describe, expect, it } from 'vitest'
import { adalahGalatSelesai } from './useSesiUjian'

describe('adalahGalatSelesai', () => {
    it('menerima kode terminal eksplisit SUDAH_SELESAI, SELESAI, dan SUDAH_DITUTUP', () => {
        expect(adalahGalatSelesai(new GalatApi('SUDAH_SELESAI', 'Ujian sudah dikumpulkan.', 409))).toBe(true)
        expect(adalahGalatSelesai(new GalatApi('SELESAI', 'Selesai.', 409))).toBe(true)
        expect(adalahGalatSelesai(new GalatApi('SUDAH_DITUTUP', 'Sesi dihentikan.', 410))).toBe(true)
    })

    it('menolak BELUM_MINIMAL, TERKUNCI, 409 generik, atau pesan yang sekadar mengandung kata dikumpulkan/selesai', () => {
        expect(
            adalahGalatSelesai(new GalatApi('BELUM_MINIMAL', 'Ujian baru bisa dikumpulkan setelah 10 menit.', 422)),
        ).toBe(false)
        expect(
            adalahGalatSelesai(new GalatApi('BELUM_MINIMAL', 'Ujian belum bisa dikumpulkan.', 409)),
        ).toBe(false)
        expect(adalahGalatSelesai(new GalatApi('TERKUNCI', 'Ujian terkunci.', 423))).toBe(false)
        expect(adalahGalatSelesai(new GalatApi('TERKUNCI', 'Ujian terkunci.', 409))).toBe(false)
        expect(adalahGalatSelesai(new GalatApi('TIDAK_DIKENAL', 'Belum selesai.', 409))).toBe(false)
    })

    it('hanya menganggap 404 sebagai selesai ketika izinkan404 bernilai true', () => {
        const g404 = new GalatApi('TIDAK_DIKENAL', 'Not found', 404)
        expect(adalahGalatSelesai(g404, false)).toBe(false)
        expect(adalahGalatSelesai(g404, true)).toBe(true)
    })
})
