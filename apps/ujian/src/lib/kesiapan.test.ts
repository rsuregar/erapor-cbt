import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { menghalangi, periksa } from './kesiapan'

describe('kesiapan perangkat — multi-monitor', () => {
    const dokumenAsli = globalThis.document

    beforeEach(() => {
        // @ts-expect-error mock minimal document in node environment
        globalThis.document = { fullscreenElement: null, fullscreenEnabled: true }
    })

    afterEach(() => {
        globalThis.document = dokumenAsli
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
})
