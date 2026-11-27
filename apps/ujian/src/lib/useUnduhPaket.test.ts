import type { PaketTerenkripsi } from '@erapor-cbt/exam-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tiruan = vi.hoisted(() => ({
    paketRespons: null as unknown as PaketTerenkripsi,
    simpanPaket: vi.fn(),
    unduhMedia: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
    api: {
        paket: vi.fn(async () => tiruan.paketRespons),
    },
}))

vi.mock('@/lib/ujian', () => ({
    GalatMedia: class GalatMedia extends Error {},
    ambilPaket: vi.fn(),
    simpanPaket: tiruan.simpanPaket,
    unduhMedia: tiruan.unduhMedia,
}))

const { paketUsang, unduhDanSimpanPaket } = await import('./useUnduhPaket')

function contohPaket(versiPaket?: string): PaketTerenkripsi {
    return {
        versi: 'sha256:abc',
        ...(versiPaket !== undefined ? { versi_paket: versiPaket } : {}),
        algoritma: 'AES-256-GCM',
        iv: 'iv',
        aad: 'aad',
        isi: 'isi',
        media: ['https://erapor.test/storage/cbt-soal/a.webp'],
    }
}

beforeEach(() => {
    tiruan.paketRespons = contohPaket('rev:baru')
    tiruan.simpanPaket.mockReset()
    tiruan.unduhMedia.mockReset()
})

describe('paketUsang', () => {
    it('mengembalikan true saat online dan versi_paket server berbeda atau belum ada di lokal', () => {
        expect(paketUsang(contohPaket('rev:lama'), 'rev:baru', true)).toBe(true)
        expect(paketUsang(contohPaket(undefined), 'rev:baru', true)).toBe(true)
    })

    it('mengembalikan false saat versi cocok, offline, atau server lama tanpa versi_paket', () => {
        expect(paketUsang(contohPaket('rev:baru'), 'rev:baru', true)).toBe(false)
        expect(paketUsang(contohPaket('rev:lama'), 'rev:baru', false)).toBe(false)
        expect(paketUsang(contohPaket('rev:lama'), undefined, true)).toBe(false)
        expect(paketUsang(contohPaket('rev:lama'), '', true)).toBe(false)
    })
})

describe('unduhDanSimpanPaket', () => {
    it('tidak menyimpan paket ke lokal jika unduhMedia gagal', async () => {
        tiruan.unduhMedia.mockRejectedValueOnce(new Error('Gagal mengunduh media (403).'))

        await expect(unduhDanSimpanPaket(37, () => undefined)).rejects.toThrow('Gagal mengunduh media (403).')
        expect(tiruan.simpanPaket).not.toHaveBeenCalled()
    })

    it('menyimpan paket setelah semua media berhasil diunduh', async () => {
        const urutan: string[] = []
        tiruan.unduhMedia.mockImplementationOnce(async () => {
            urutan.push('media')
        })
        tiruan.simpanPaket.mockImplementationOnce(async () => {
            urutan.push('paket')
        })

        const hasil = await unduhDanSimpanPaket(37, () => undefined)

        expect(hasil.versi_paket).toBe('rev:baru')
        expect(urutan).toEqual(['media', 'paket'])
        expect(tiruan.simpanPaket).toHaveBeenCalledWith(37, tiruan.paketRespons)
    })
})
