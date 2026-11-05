import { describe, expect, it, beforeEach, vi } from 'vitest'

const memori: Record<string, string> = {}

vi.mock('@capacitor/preferences', () => ({
    Preferences: {
        get: vi.fn(async ({ key }: { key: string }) => ({
            value: memori[key] ?? null,
        })),
        set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
            memori[key] = value
        }),
        remove: vi.fn(async ({ key }: { key: string }) => {
            delete memori[key]
        }),
    },
}))

import { sesi } from './sesi'

describe('Sesi Murid', () => {
    beforeEach(async () => {
        for (const k of Object.keys(memori)) {
            delete memori[k]
        }
        await sesi.keluar()
    })

    it('menyimpan dan mengembalikan profil lengkap murid (nama, NIS, kelas, NISN, sekolah)', async () => {
        await sesi.masuk(
            'token-abc',
            'Ahmad Fauzan Hidayat',
            'uuid-123',
            '2024001',
            'Kelas 8A',
            '0081234567',
            'https://contoh.sch.id/foto.jpg',
            'SMP Islam Al Akhyar',
        )

        expect(sesi.token()).toBe('token-abc')
        expect(sesi.nama()).toBe('Ahmad Fauzan Hidayat')
        expect(sesi.nis()).toBe('2024001')
        expect(sesi.kelas()).toBe('Kelas 8A')
        expect(sesi.nisn()).toBe('0081234567')
        expect(sesi.foto()).toBe('https://contoh.sch.id/foto.jpg')
        expect(sesi.sekolah()).toBe('SMP Islam Al Akhyar')
    })

    it('dapat memperbarui data profil tanpa menghapus token atau NIS', async () => {
        await sesi.masuk(
            'token-abc',
            'Ahmad Fauzan Hidayat',
            'uuid-123',
            '2024001',
        )

        expect(sesi.kelas()).toBeNull()

        await sesi.perbaruiProfil({
            kelas: 'Kelas 9B',
            nisn: '0089999999',
            sekolah: 'SMP Islam Al Akhyar',
        })

        expect(sesi.nama()).toBe('Ahmad Fauzan Hidayat')
        expect(sesi.nis()).toBe('2024001')
        expect(sesi.kelas()).toBe('Kelas 9B')
        expect(sesi.nisn()).toBe('0089999999')
        expect(sesi.sekolah()).toBe('SMP Islam Al Akhyar')
    })

    it('membersihkan seluruh data murid saat keluar', async () => {
        await sesi.masuk(
            'token-abc',
            'Ahmad Fauzan Hidayat',
            'uuid-123',
            '2024001',
            'Kelas 8A',
        )

        await sesi.keluar()

        expect(sesi.token()).toBeNull()
        expect(sesi.nama()).toBeNull()
        expect(sesi.nis()).toBeNull()
        expect(sesi.kelas()).toBeNull()
        expect(sesi.nisn()).toBeNull()
        expect(sesi.foto()).toBeNull()
        expect(sesi.sekolah()).toBeNull()
    })
})
