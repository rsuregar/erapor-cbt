import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JARAK_PAPAN_KETIK_MS, JENDELA_GABUNG_MS, buatPelapor, perkirakanSumber, pintasanSalin } from './laporProteksi'

describe('pelapor percobaan yang diblokir', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('menggabungkan kejadian sama dalam satu jendela menjadi satu entri berjumlah', () => {
        const kirim = vi.fn()
        const p = buatPelapor(kirim)

        for (let i = 0; i < 30; i++) p.lapor('klik_kanan', { soal: 4 })
        expect(kirim).not.toHaveBeenCalled()

        vi.advanceTimersByTime(JENDELA_GABUNG_MS)
        expect(kirim).toHaveBeenCalledTimes(1)
        expect(kirim).toHaveBeenCalledWith('klik_kanan', { soal: 4, jumlah: 30 })
    })

    it('kejadian setelah jendela berlalu memulai entri baru', () => {
        const kirim = vi.fn()
        const p = buatPelapor(kirim)

        p.lapor('klik_kanan')
        vi.advanceTimersByTime(JENDELA_GABUNG_MS)
        p.lapor('klik_kanan')
        vi.advanceTimersByTime(JENDELA_GABUNG_MS)

        expect(kirim).toHaveBeenCalledTimes(2)
        expect(kirim).toHaveBeenNthCalledWith(1, 'klik_kanan', { jumlah: 1 })
        expect(kirim).toHaveBeenNthCalledWith(2, 'klik_kanan', { jumlah: 1 })
    })

    it('salin dan tempel dilaporkan terpisah, dan meta kejadian pertama dipertahankan', () => {
        const kirim = vi.fn()
        const p = buatPelapor(kirim)

        p.lapor('salin_diblokir', { aksi: 'copy', diblokir: true, soal: 2 })
        p.lapor('salin_diblokir', { aksi: 'paste', diblokir: true, soal: 2 })
        p.lapor('salin_diblokir', { aksi: 'copy', diblokir: true, soal: 9 })
        vi.advanceTimersByTime(JENDELA_GABUNG_MS)

        expect(kirim).toHaveBeenCalledTimes(2)
        expect(kirim).toHaveBeenCalledWith('salin_diblokir', { aksi: 'copy', diblokir: true, soal: 2, jumlah: 2 })
        expect(kirim).toHaveBeenCalledWith('salin_diblokir', { aksi: 'paste', diblokir: true, soal: 2, jumlah: 1 })
    })

    it('siram mengirim yang tertahan segera dan tidak mengirim dua kali', () => {
        const kirim = vi.fn()
        const p = buatPelapor(kirim)

        p.lapor('klik_kanan')
        p.lapor('klik_kanan')
        p.siram()
        expect(kirim).toHaveBeenCalledTimes(1)
        expect(kirim).toHaveBeenCalledWith('klik_kanan', { jumlah: 2 })

        vi.advanceTimersByTime(JENDELA_GABUNG_MS * 2)
        expect(kirim).toHaveBeenCalledTimes(1)
    })

    it('siram tanpa kejadian tidak mengirim apa pun', () => {
        const kirim = vi.fn()
        buatPelapor(kirim).siram()

        expect(kirim).not.toHaveBeenCalled()
    })
})

describe('perkiraan asal perintah salin', () => {
    it('papan_ketik bila pintasan baru saja ditekan, selain itu tidak diketahui', () => {
        expect(perkirakanSumber(1000, 1000 - JARAK_PAPAN_KETIK_MS)).toBe('papan_ketik')
        expect(perkirakanSumber(1000, 1000 - JARAK_PAPAN_KETIK_MS - 1)).toBe('tidak_diketahui')
        expect(perkirakanSumber(1000, null)).toBe('tidak_diketahui')
    })

    it('mengenali pintasan salin/potong/tempel di Windows dan macOS', () => {
        expect(pintasanSalin({ key: 'c', ctrlKey: true, metaKey: false })).toBe(true)
        expect(pintasanSalin({ key: 'V', ctrlKey: false, metaKey: true })).toBe(true)
        expect(pintasanSalin({ key: 'x', ctrlKey: true, metaKey: false })).toBe(true)
        expect(pintasanSalin({ key: 'c', ctrlKey: false, metaKey: false })).toBe(false)
        expect(pintasanSalin({ key: 'a', ctrlKey: true, metaKey: false })).toBe(false)
    })
})
