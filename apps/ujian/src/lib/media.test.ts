import { PenyimpananMemori } from '@erapor-cbt/exam-core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const tiruan = vi.hoisted(() => ({
    penyimpanan: null as unknown as PenyimpananMemori,
    berkas: new Map<string, string>(),
    gagal: new Set<string>(),
    unduhan: [] as string[],
    dihapus: [] as string[],
}))

vi.mock('@/lib/penyimpanan', () => ({
    get penyimpanan() {
        return tiruan.penyimpanan
    },
}))
vi.mock('@/lib/api', () => ({ api: {}, URL_API: 'https://erapor.test/api' }))
vi.mock('@/lib/sesi', () => ({ sesi: { uuid: () => 'murid-1' } }))
vi.mock('@/lib/native', () => ({
    adaMediaNative: () => true,
    unduhMediaNative: async (url: string) => {
        if (tiruan.gagal.has(url)) throw new Error('Gagal mengunduh media. Periksa internet lalu coba lagi.')
        tiruan.unduhan.push(url)
        const path = `/data/media/${encodeURIComponent(url)}`
        tiruan.berkas.set(path, url)
        return path
    },
    hapusMediaNative: async (path: string[]) => {
        tiruan.dihapus.push(...path)
    },
    srcMediaNative: async (path: string) => `asset://localhost${path}`,
}))

const { GalatMedia, hapusMediaUjian, srcLokal, srcMediaUjian, unduhMedia } = await import('./ujian')

beforeEach(() => {
    tiruan.penyimpanan = new PenyimpananMemori()
    tiruan.berkas.clear()
    tiruan.gagal.clear()
    tiruan.unduhan.length = 0
    tiruan.dihapus.length = 0
})

describe('Media soal di penyimpanan app native', () => {
    it('mengunduh semua media, melaporkan progres, dan memetakan URL soal ke src lokal', async () => {
        const progres: number[] = []
        await unduhMedia(1, ['https://erapor.test/storage/a.png', '/storage/b.jpg'], (s) => progres.push(s))

        expect(progres).toEqual([0, 1, 2])
        // URL relatif diselesaikan terhadap server e-Rapor, bukan origin WebView.
        expect(tiruan.unduhan).toContain('https://erapor.test/storage/b.jpg')
        const src = await srcMediaUjian(1)
        expect(src['https://erapor.test/storage/a.png']).toMatch(/^asset:\/\/localhost\/data\/media\//)
        expect(src['/storage/b.jpg']).toMatch(/^asset:\/\/localhost\/data\/media\//)
    })

    it('gagal sebagian: GalatMedia berpesan, dan media yang berhasil tetap tercatat', async () => {
        tiruan.gagal.add('https://erapor.test/storage/rusak.png')
        await expect(
            unduhMedia(1, ['https://erapor.test/storage/ok.png', 'https://erapor.test/storage/rusak.png'], () => undefined),
        ).rejects.toBeInstanceOf(GalatMedia)

        expect(Object.keys(await srcMediaUjian(1))).toEqual(['https://erapor.test/storage/ok.png'])
    })

    it('srcLokal: cocok untuk URL relatif maupun absolut, selain itu src asli', async () => {
        await unduhMedia(1, ['/storage/b.jpg'], () => undefined)
        const peta = await srcMediaUjian(1)

        expect(srcLokal(peta, '/storage/b.jpg')).toMatch(/^asset:/)
        expect(srcLokal(peta, 'https://erapor.test/storage/b.jpg')).toMatch(/^asset:/)
        expect(srcLokal(peta, 'https://erapor.test/storage/lain.png')).toBe('https://erapor.test/storage/lain.png')
        expect(srcLokal(undefined, '/storage/b.jpg')).toBe('/storage/b.jpg')
    })

    it('hapus media ujian: berkas yang juga dipakai ujian lain dibiarkan', async () => {
        await unduhMedia(1, ['https://erapor.test/storage/sama.png', 'https://erapor.test/storage/hanya1.png'], () => undefined)
        await unduhMedia(2, ['https://erapor.test/storage/sama.png'], () => undefined)

        await hapusMediaUjian(1)

        expect(tiruan.dihapus).toEqual([`/data/media/${encodeURIComponent('https://erapor.test/storage/hanya1.png')}`])
        expect(await srcMediaUjian(1)).toEqual({})
        expect(Object.keys(await srcMediaUjian(2))).toEqual(['https://erapor.test/storage/sama.png'])
    })

    it('tanpa media: langsung selesai tanpa menyentuh penyimpanan', async () => {
        const progres: number[] = []
        await unduhMedia(1, [], (s, t) => progres.push(s, t))
        expect(progres).toEqual([0, 0])
        expect(await tiruan.penyimpanan.daftarKunci('media:')).toEqual([])
    })
})
