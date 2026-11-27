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

import { buatUuid, sesi } from './sesi'

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

    it('menghapus atribut opsional murid sebelumnya saat akun baru tidak memilikinya', async () => {
        await sesi.masuk(
            'token-1',
            'Murid Lama',
            'uuid-1',
            '1001',
            'Kelas 9A',
            '009111',
            'https://contoh.sch.id/1.jpg',
            'SMP Al Akhyar',
        )

        await sesi.masuk('token-2', 'Murid Baru', 'uuid-2', '1002', null, null, null, null)

        expect(sesi.kelas()).toBeNull()
        expect(sesi.nisn()).toBeNull()
        expect(sesi.foto()).toBeNull()
        expect(sesi.sekolah()).toBeNull()
        expect(memori['kelas']).toBeUndefined()
        expect(memori['nisn']).toBeUndefined()
        expect(memori['foto']).toBeUndefined()
        expect(memori['sekolah']).toBeUndefined()
    })

    it('menghasilkan UUID v4 valid saat crypto.randomUUID tidak tersedia (iOS 15.0–15.3)', () => {
        const asli = globalThis.crypto
        vi.stubGlobal('crypto', {
            getRandomValues: (arr: Uint8Array) => {
                for (let i = 0; i < arr.length; i++) arr[i] = (i * 17 + 3) & 0xff
                return arr
            },
        })
        try {
            const id = buatUuid()
            expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
        } finally {
            vi.stubGlobal('crypto', asli)
        }
    })
})
