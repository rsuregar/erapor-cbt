import { afterEach, describe, expect, it, vi } from 'vitest'
import { deteksiJenisPerangkat, hpMiring, layarDibagi, wajibLayarPenuh } from './perangkat'

describe('deteksiJenisPerangkat', () => {
    it('mengenali platform native Android dan iOS langsung', () => {
        expect(deteksiJenisPerangkat({ platform: 'android', userAgent: 'Mozilla/5.0', maxTouchPoints: 0 })).toBe('android')
        expect(deteksiJenisPerangkat({ platform: 'ios', userAgent: 'Mozilla/5.0', maxTouchPoints: 0 })).toBe('ios')
    })

    it('mengenali tablet Android Chrome Desktop Site (X11; Linux + sentuh) sebagai android', () => {
        expect(
            deteksiJenisPerangkat({
                platform: 'pwa',
                userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
                maxTouchPoints: 5,
            }),
        ).toBe('android')
    })

    it('tidak salah mengenali Chromebook berlayar sentuh (CrOS) sebagai Android', () => {
        expect(
            deteksiJenisPerangkat({
                platform: 'pwa',
                userAgent: 'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
                maxTouchPoints: 10,
            }),
        ).toBe('desktop')
    })

    it('mengenali iPadOS mode desktop (Macintosh + sentuh) sebagai ios dan Windows/macOS sebagai desktop', () => {
        expect(
            deteksiJenisPerangkat({
                platform: 'pwa',
                userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
                maxTouchPoints: 5,
            }),
        ).toBe('ios')

        expect(
            deteksiJenisPerangkat({
                platform: 'pwa',
                userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36',
                maxTouchPoints: 0,
            }),
        ).toBe('desktop')
    })
})

describe('wajibLayarPenuh & layarDibagi', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it('wajibLayarPenuh mengembalikan false di Exam Browser Tauri desktop', () => {
        vi.stubGlobal('window', { __TAURI_INTERNALS__: {} })
        vi.stubGlobal('document', { fullscreenEnabled: true, fullscreenElement: null })
        vi.stubGlobal('navigator', {
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            maxTouchPoints: 0,
        })

        expect(wajibLayarPenuh('ketat')).toBe(false)
        expect(wajibLayarPenuh('lockdown')).toBe(false)
    })

    it('keyboard virtual di HP potret tidak memicu false positive layarDibagi atau hpMiring', () => {
        vi.stubGlobal('navigator', {
            userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Mobile Safari/537.36',
            maxTouchPoints: 5,
        })
        vi.stubGlobal('screen', {
            width: 390,
            height: 844,
            orientation: { type: 'portrait-primary' },
        })
        // Keyboard virtual mengecilkan innerHeight hingga lebih kecil dari innerWidth.
        vi.stubGlobal('innerWidth', 390)
        vi.stubGlobal('innerHeight', 360)

        expect(layarDibagi()).toBe(false)
        expect(hpMiring()).toBe(false)
    })
})
