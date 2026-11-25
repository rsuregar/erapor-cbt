import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { menghalangi, periksa } from './kesiapan'

describe('kesiapan perangkat — multi-monitor', () => {
    const dokumenAsli = globalThis.document

    beforeEach(() => {
        // @ts-expect-error mock minimal document in node environment
        globalThis.document = { fullscreenElement: null, fullscreenEnabled: true }
    })

    afterEach(() => {
        globalThis.document = dokumenAsli
        vi.unstubAllGlobals()
    })

    it('menampilkan peringatan non-blocking saat desktop memiliki lebih dari 1 layar', () => {
        const daftar = periksa('ketat', {
            pembaruanTersedia: false,
            ruangBebas: null,
            baterai: null,
            jumlahMonitor: 2,
        })

        const monitor = daftar.find((i) => i.kunci === 'monitor')
        expect(monitor).toBeDefined()
        expect(monitor?.hasil).toBe('peringatan')
        expect(menghalangi(daftar, 'ketat').some((i) => i.kunci === 'monitor')).toBe(false)
    })

    it('tidak menampilkan peringatan layar tambahan saat hanya 1 monitor', () => {
        const daftar = periksa('lockdown', {
            pembaruanTersedia: false,
            ruangBebas: null,
            baterai: null,
            jumlahMonitor: 1,
        })

        expect(daftar.find((i) => i.kunci === 'monitor')).toBeUndefined()
    })

    it('memperlakukan Exam Browser Tauri sebagai aplikasi terpasang tanpa syarat fullscreen browser', () => {
        const winAsli = globalThis.window
        // @ts-expect-error mock Tauri internals
        globalThis.window = { __TAURI_INTERNALS__: {} }
        try {
            const daftar = periksa('lockdown', {
                pembaruanTersedia: false,
                ruangBebas: null,
                baterai: null,
            })

            const tampilan = daftar.find((i) => i.kunci === 'tampilan')
            expect(tampilan?.hasil).toBe('lulus')
            expect(tampilan?.judul).toBe('Cara membuka aplikasi')
            expect(daftar.find((i) => i.kunci === 'kunci_os')).toBeUndefined()
        } finally {
            globalThis.window = winAsli
        }
    })
})
