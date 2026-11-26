import { describe, expect, it } from 'vitest'
import { adalahPerangkatMobileUntukManifes, apakahPwaDesktopTerpasang } from './pwaDesktop'

describe('pwaDesktop', () => {
    describe('adalahPerangkatMobileUntukManifes', () => {
        it('mengembalikan false untuk semua browser desktop (termasuk laptop Windows & Chromebook touchscreen)', () => {
            expect(
                adalahPerangkatMobileUntukManifes(
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
                    0,
                ),
            ).toBe(false)
            expect(
                adalahPerangkatMobileUntukManifes(
                    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
                    10,
                ),
            ).toBe(false)
            expect(
                adalahPerangkatMobileUntukManifes(
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
                    0,
                ),
            ).toBe(false)
            expect(
                adalahPerangkatMobileUntukManifes(
                    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
                    0,
                ),
            ).toBe(false)
            expect(
                adalahPerangkatMobileUntukManifes(
                    'Mozilla/5.0 (X11; CrOS x86_64 14541.0.0) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
                    10,
                ),
            ).toBe(false)
        })

        it('mengembalikan true untuk iPhone, iPad (Desktop UA + touch), Android, dan tablet Android Desktop Site', () => {
            expect(
                adalahPerangkatMobileUntukManifes(
                    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
                    5,
                ),
            ).toBe(true)
            expect(
                adalahPerangkatMobileUntukManifes(
                    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
                    5,
                ),
            ).toBe(true)
            expect(
                adalahPerangkatMobileUntukManifes(
                    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36',
                    5,
                ),
            ).toBe(true)
            expect(
                adalahPerangkatMobileUntukManifes(
                    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
                    5,
                ),
            ).toBe(true)
        })
    })

    describe('apakahPwaDesktopTerpasang', () => {
        it('hanya bernilai true saat bukan app native, perangkat desktop, dan berjalan standalone', () => {
            expect(apakahPwaDesktopTerpasang({ native: false, perangkat: 'desktop', standalone: true })).toBe(true)
            expect(apakahPwaDesktopTerpasang({ native: true, perangkat: 'desktop', standalone: true })).toBe(false)
            expect(apakahPwaDesktopTerpasang({ native: true, perangkat: 'android', standalone: true })).toBe(false)
            expect(apakahPwaDesktopTerpasang({ native: false, perangkat: 'ios', standalone: true })).toBe(false)
            expect(apakahPwaDesktopTerpasang({ native: false, perangkat: 'desktop', standalone: false })).toBe(false)
        })
    })
})
