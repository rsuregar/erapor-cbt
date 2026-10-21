import type { Jawaban } from '@erapor-cbt/exam-core'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PenulisJawaban } from './penulisJawaban'

type Tulisan = { soalId: number; isi: Jawaban; ragu: boolean }

function buat(opsi: { gagal?: () => boolean } = {}) {
    const tertulis: Tulisan[] = []
    const laporan: number[] = []
    let sinkron = 0
    const p = new PenulisJawaban({
        catat: async (soalId, isi, ragu) => {
            if (opsi.gagal?.()) throw new Error('SQLITE_GAGAL')
            tertulis.push({ soalId, isi, ragu })
        },
        setelahTulis: () => sinkron++,
        saatGagalBerubah: (n) => laporan.push(n),
        jedaTeksMs: 700,
        jedaUlangMs: 3000,
    })

    return { p, tertulis, laporan, sinkron: () => sinkron }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('PenulisJawaban', () => {
    it('pilihan langsung ditulis; teks ditunda lalu hanya versi terakhir yang ditulis', async () => {
        const { p, tertulis, sinkron } = buat()
        p.catat(1, 'A', false, 10)
        p.catat(2, 'Jak', false, 11, { teks: true })
        p.catat(2, 'Jakarta', false, 12, { teks: true })
        await vi.advanceTimersByTimeAsync(0)
        expect(tertulis).toEqual([{ soalId: 1, isi: 'A', ragu: false }])

        await vi.advanceTimersByTimeAsync(700)
        expect(tertulis.map((t) => t.isi)).toEqual(['A', 'Jakarta'])
        expect(sinkron()).toBe(2)
    })

    it('tulisSemua memaksa ketikan yang masih ditunda (app ke latar / ditutup / kumpul)', async () => {
        const { p, tertulis } = buat()
        p.catat(3, 'uraian setengah jadi', false, 1, { teks: true })
        expect(await p.tulisSemua()).toBe(0)
        expect(tertulis).toEqual([{ soalId: 3, isi: 'uraian setengah jadi', ragu: false }])

        // Timer lama sudah dibatalkan: tidak ada tulisan ganda.
        await vi.advanceTimersByTimeAsync(1000)
        expect(tertulis).toHaveLength(1)
    })

    it('tulisan gagal dilaporkan, dicoba ulang otomatis, lalu laporan kembali 0', async () => {
        let rusak = true
        const { p, tertulis, laporan } = buat({ gagal: () => rusak })
        p.catat(1, 'B', true, 5)
        await vi.advanceTimersByTimeAsync(0)
        expect(p.jumlahGagal).toBe(1)
        expect(laporan).toEqual([1])

        await vi.advanceTimersByTimeAsync(3000)
        expect(p.jumlahGagal).toBe(1)

        rusak = false
        await vi.advanceTimersByTimeAsync(3000)
        expect(tertulis).toEqual([{ soalId: 1, isi: 'B', ragu: true }])
        expect(p.jumlahGagal).toBe(0)
        expect(laporan).toEqual([1, 0])
    })

    it('tulisSemua mengembalikan jumlah yang masih gagal (dipakai menahan kumpul)', async () => {
        const { p } = buat({ gagal: () => true })
        p.catat(1, 'C', false, 1)
        await vi.advanceTimersByTimeAsync(0)
        expect(await p.tulisSemua()).toBe(1)
    })

    it('galat versi lama tidak menimpa jawaban yang lebih baru', async () => {
        let panggilan = 0
        const { p, tertulis } = buat({ gagal: () => ++panggilan === 1 })
        p.catat(1, 'lama', false, 1) // gagal
        p.catat(1, 'baru', false, 2) // berhasil
        await vi.advanceTimersByTimeAsync(0)
        expect(p.jumlahGagal).toBe(0)

        // Tidak ada coba ulang yang menulis ulang "lama" di atas "baru".
        await vi.advanceTimersByTimeAsync(10_000)
        expect(tertulis.map((t) => t.isi)).toEqual(['baru'])
    })

    it('buang: setelah attempt selesai tidak ada tulisan yang muncul lagi', async () => {
        const { p, tertulis } = buat()
        p.catat(1, 'ketik', false, 1, { teks: true })
        p.buang()
        await vi.advanceTimersByTimeAsync(10_000)
        expect(await p.tulisSemua()).toBe(0)
        expect(tertulis).toEqual([])
    })

    it('henti: yang masih ditunda tetap ditulis (layar ujian ditutup)', async () => {
        const { p, tertulis } = buat()
        p.catat(4, 'x', false, 1, { teks: true })
        await p.henti()
        expect(tertulis).toEqual([{ soalId: 4, isi: 'x', ragu: false }])
    })
})
