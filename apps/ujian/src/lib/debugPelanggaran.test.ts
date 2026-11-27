import { describe, expect, it } from 'vitest'
import {
    bolehTampilDebugStaging,
    buatCeklisAwal,
    perbaruiCeklis,
    tambahLogDebug,
} from './debugPelanggaran'

describe('debugPelanggaran (khusus PWA Staging)', () => {
    it('hanya mengizinkan tampil saat staging = true dan native = false', () => {
        expect(bolehTampilDebugStaging({ staging: true, native: false })).toBe(true)
        expect(bolehTampilDebugStaging({ staging: false, native: false })).toBe(false)
        expect(bolehTampilDebugStaging({ staging: true, native: true })).toBe(false)
        expect(bolehTampilDebugStaging({ staging: false, native: true })).toBe(false)
    })

    it('membuat 9 item ceklis awal berstatus belum dengan jumlah 0', () => {
        const daftar = buatCeklisAwal()
        expect(daftar).toHaveLength(9)
        expect(daftar.every((i) => i.status === 'belum' && i.jumlah === 0)).toBe(true)
    })

    it('menaikkan status ceklis secara monotonik dan tidak pernah menurunkan tercatat ke sinyal', () => {
        const awal = buatCeklisAwal()
        const setelahSinyal = perbaruiCeklis(awal, 'split_view', 'sinyal', 'Mulai split', '12:00:01')
        const item1 = setelahSinyal.find((i) => i.kunci === 'split_view')
        expect(item1).toMatchObject({ status: 'sinyal', jumlah: 1, detail: 'Mulai split', waktu: '12:00:01' })

        const setelahTercatat = perbaruiCeklis(setelahSinyal, 'split_view', 'tercatat', 'ukuran_layar 5 dtk', '12:00:06')
        const item2 = setelahTercatat.find((i) => i.kunci === 'split_view')
        expect(item2).toMatchObject({ status: 'tercatat', jumlah: 2, detail: 'ukuran_layar 5 dtk', waktu: '12:00:06' })

        // Sinyal baru setelah sudah tercatat tidak boleh menurunkan status dari 'tercatat'
        const sinyalLagi = perbaruiCeklis(setelahTercatat, 'split_view', 'sinyal', 'Split lagi', '12:00:20')
        const item3 = sinyalLagi.find((i) => i.kunci === 'split_view')
        expect(item3).toMatchObject({ status: 'tercatat', jumlah: 3, detail: 'Split lagi', waktu: '12:00:20' })
    })

    it('menambahkan log terbaru di urutan atas dan membatasi panjang maksimum', () => {
        let log = tambahLogDebug([], 'Proteksi', 'copy diblokir', '12:00:01', 1, 2)
        log = tambahLogDebug(log, 'Pelanggaran', 'pindah_tab', '12:00:05', 2, 2)
        log = tambahLogDebug(log, 'Split View', 'ukuran_layar', '12:00:10', 3, 2)

        expect(log).toHaveLength(2)
        expect(log[0]).toMatchObject({ id: 3, kategori: 'Split View' })
        expect(log[1]).toMatchObject({ id: 2, kategori: 'Pelanggaran' })
    })
})
