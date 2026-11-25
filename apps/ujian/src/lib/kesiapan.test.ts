import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { menghalangi, periksa } from './kesiapan'

describe('kesiapan perangkat — multi-monitor & wajib app desktop', () => {
    const dokumenAsli = globalThis.document
    const windowAsli = globalThis.window
    const navigatorAsli = globalThis.navigator
    const secureAsli = globalThis.isSecureContext
    const idbAsli = globalThis.indexedDB

    beforeEach(() => {
        // @ts-expect-error mock minimal browser globals in node environment
        globalThis.document = { fullscreenElement: null, fullscreenEnabled: true }
        Object.defineProperty(globalThis, 'isSecureContext', { value: true, configurable: true })
        // @ts-expect-error mock minimal indexedDB presence
        globalThis.indexedDB = {}
    })

    afterEach(() => {
        globalThis.document = dokumenAsli
        globalThis.window = windowAsli
        if (navigatorAsli) {
            Object.defineProperty(globalThis, 'navigator', { value: navigatorAsli, configurable: true })
        }
        Object.defineProperty(globalThis, 'isSecureContext', { value: secureAsli, configurable: true })
        globalThis.indexedDB = idbAsli
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

    it('memblokir browser desktop saat wajib_app_desktop aktif di semua level keamanan', () => {
        const aplikasi = {
            versi_minimum: { android: null, ios: null, windows: null, macos: null },
            tautan_pembaruan: { android: null, ios: null, windows: null, macos: null },
            wajib_app_desktop: true,
        }
        const daftar = periksa('dasar', {
            pembaruanTersedia: false,
            ruangBebas: null,
            baterai: null,
            aplikasi,
        })

        const tampilan = daftar.find((i) => i.kunci === 'tampilan')
        expect(tampilan?.hasil).toBe('gagal')
        expect(tampilan?.wajib).toBe(true)
        expect(menghalangi(daftar, 'dasar').some((i) => i.kunci === 'tampilan')).toBe(true)
        expect(menghalangi(daftar, 'ketat').some((i) => i.kunci === 'tampilan')).toBe(true)
    })

    it('mengizinkan Tauri Desktop Windows saat wajib_app_desktop aktif dan memeriksa versi_minimum.windows', () => {
        // @ts-expect-error mock tauri internals in node environment
        globalThis.window = { __TAURI_INTERNALS__: {} }
        Object.defineProperty(globalThis, 'navigator', {
            value: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', maxTouchPoints: 0 },
            configurable: true,
        })

        const aplikasiLolos = {
            versi_minimum: { android: null, ios: null, windows: '0.1.0', macos: null },
            tautan_pembaruan: { android: null, ios: null, windows: 'https://contoh.test/win.exe', macos: null },
            wajib_app_desktop: true,
        }
        const lolos = periksa('ketat', {
            pembaruanTersedia: false,
            ruangBebas: null,
            baterai: null,
            aplikasi: aplikasiLolos,
        })
        expect(lolos.find((i) => i.kunci === 'tampilan')?.hasil).toBe('lulus')
        expect(menghalangi(lolos, 'ketat')).toHaveLength(0)

        const usang = periksa('dasar', {
            pembaruanTersedia: false,
            ruangBebas: null,
            baterai: null,
            aplikasi: {
                ...aplikasiLolos,
                versi_minimum: { android: null, ios: null, windows: '9.0.0', macos: null },
            },
        })
        const itemVersi = usang.find((i) => i.kunci === 'versi')
        expect(itemVersi?.hasil).toBe('gagal')
        expect(itemVersi?.wajib).toBe(true)
        expect(itemVersi?.aksi).toBe('perbarui')
        expect(menghalangi(usang, 'dasar').some((i) => i.kunci === 'versi')).toBe(true)
    })
})
