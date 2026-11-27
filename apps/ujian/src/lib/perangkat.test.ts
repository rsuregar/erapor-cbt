import { afterEach, describe, expect, it, vi } from 'vitest'
import { deteksiJenisPerangkat, deteksiLayarDibagi, hpMiring, layarDibagi, wajibLayarPenuh } from './perangkat'

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

    it('mendeteksi Split View 2/3, 1/2, 1/3 di iPad lanskap meski screen.orientation tidak ada dan screen.width < screen.height', () => {
        const dasarIpad = {
            jenisPerangkat: 'ios' as const,
            screenWidth: 820,
            screenHeight: 1180,
            standalone: true,
            fokusIsian: false,
        }

        // Layar penuh lanskap (tanpa screen.orientation, khas WebKit iPadOS) -> false
        expect(deteksiLayarDibagi({ ...dasarIpad, innerWidth: 1180, innerHeight: 820 })).toBe(false)

        // Split View 2/3 lanskap (780px / 1180px = 0.66) -> harus terbaca true!
        expect(deteksiLayarDibagi({ ...dasarIpad, innerWidth: 780, innerHeight: 820 })).toBe(true)

        // Split View 1/2 lanskap (585px) & 1/3 (375px) -> true
        expect(deteksiLayarDibagi({ ...dasarIpad, innerWidth: 585, innerHeight: 820 })).toBe(true)
        expect(deteksiLayarDibagi({ ...dasarIpad, innerWidth: 375, innerHeight: 820 })).toBe(true)
    })

    it('mendeteksi Split View 1/2 di iPad potret dan Stage Manager / jendela mengambang', () => {
        const dasarIpad = {
            jenisPerangkat: 'ios' as const,
            screenWidth: 820,
            screenHeight: 1180,
            standalone: true,
            fokusIsian: false,
        }

        // Layar penuh potret -> false
        expect(deteksiLayarDibagi({ ...dasarIpad, innerWidth: 820, innerHeight: 1180, orientationType: 'portrait-primary' })).toBe(false)

        // Split View 1/2 potret (405px / 820px) -> true
        expect(deteksiLayarDibagi({ ...dasarIpad, innerWidth: 405, innerHeight: 1180, orientationType: 'portrait-primary' })).toBe(true)

        // Stage Manager: lebar 82% (968/1180) -> true
        expect(deteksiLayarDibagi({ ...dasarIpad, innerWidth: 968, innerHeight: 820, orientationType: 'landscape-primary' })).toBe(true)

        // Stage Manager: tinggi menyusut 70% tanpa fokus isian -> true
        expect(deteksiLayarDibagi({ ...dasarIpad, innerWidth: 1180, innerHeight: 574, orientationType: 'landscape-primary' })).toBe(true)

        // Keyboard virtual iPad saat fokus isian (tinggi menyusut, lebar penuh) -> TIDAK false positive
        expect(
            deteksiLayarDibagi({
                ...dasarIpad,
                innerWidth: 1180,
                innerHeight: 420,
                orientationType: 'landscape-primary',
                fokusIsian: true,
            }),
        ).toBe(false)
    })

    it('tidak false positive di iPad Safari tab (toolbar atas) dalam layar penuh', () => {
        expect(
            deteksiLayarDibagi({
                jenisPerangkat: 'ios',
                screenWidth: 820,
                screenHeight: 1180,
                innerWidth: 1180,
                innerHeight: 710, // ~86.6% tinggi karena toolbar Safari
                orientationType: 'landscape-primary',
                standalone: false,
                fokusIsian: false,
            }),
        ).toBe(false)
    })
})
