import { describe, expect, it } from 'vitest'
import type { UjianRingkas } from '@erapor-cbt/exam-core'

describe('Kelayakan Ujian (Exam Eligibility)', () => {
    const ujianHarian: UjianRingkas = {
        id: 1,
        nama: 'Ulangan Harian Matematika Bab 1',
        mapel: 'Matematika',
        jenis_penilaian: 'harian',
        eligible: true,
        murid: { id: 1, nama: 'Budi Santoso', foto: null, nis: '2024001', kelas: '8A' },
        dibuka_pada: '2026-11-05T08:00:00+08:00',
        ditutup_pada: '2026-11-05T10:00:00+08:00',
        durasi_menit: 60,
        tambahan_waktu_menit: 0,
        jumlah_soal: 20,
        level_keamanan: 'dasar',
        sesi: null,
        lokasi: { wajib: false, radius_meter: null },
        status: 'belum_mulai',
        attempt_id: null,
        bisa_unduh: true,
        hasil_tersedia: false,
    }

    const ujianPasTidakEligible: UjianRingkas = {
        id: 2,
        nama: 'Penilaian Akhir Semester (PAS) Ganjil',
        mapel: 'Bahasa Indonesia',
        jenis_penilaian: 'pas',
        eligible: false,
        keterangan_eligibility: 'Belum memenuhi batas minimum pembayaran SPP/iuran semester.',
        murid: { id: 1, nama: 'Budi Santoso', foto: null, nis: '2024001', kelas: '8A' },
        dibuka_pada: '2026-12-01T08:00:00+08:00',
        ditutup_pada: '2026-12-01T10:00:00+08:00',
        durasi_menit: 90,
        tambahan_waktu_menit: 0,
        jumlah_soal: 30,
        level_keamanan: 'ketat',
        sesi: null,
        lokasi: { wajib: true, radius_meter: 150 },
        status: 'belum_mulai',
        attempt_id: null,
        bisa_unduh: false,
        hasil_tersedia: false,
    }

    const ujianPasDispensasi: UjianRingkas = {
        ...ujianPasTidakEligible,
        id: 3,
        eligible: true,
        keterangan_eligibility: 'Dispensasi aktif',
    }

    it('mengizinkan ujian non-semester (harian/PTS) tanpa batasan eligibility', () => {
        expect(ujianHarian.eligible).toBe(true)
        expect(ujianHarian.bisa_unduh).toBe(true)
    })

    it('menandai ujian semester (PAS/PAT/UAS) sebagai tidak eligible jika belum memenuhi syarat', () => {
        expect(ujianPasTidakEligible.eligible).toBe(false)
        expect(ujianPasTidakEligible.keterangan_eligibility).toContain('SPP/iuran')
        expect(ujianPasTidakEligible.bisa_unduh).toBe(false)
    })

    it('mengizinkan ujian semester jika murid memiliki dispensasi aktif dari kepsek/admin', () => {
        expect(ujianPasDispensasi.eligible).toBe(true)
        expect(ujianPasDispensasi.keterangan_eligibility).toBe('Dispensasi aktif')
    })
})
