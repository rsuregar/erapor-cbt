import { describe, expect, it } from 'vitest'
import { pilihPembaruan, type RilisGithub } from './pembaruan'

const rilis = (tag: string, berkas: string[], ekstra: Partial<RilisGithub> = {}): RilisGithub => ({
    tag_name: tag,
    html_url: `https://github.com/x/y/releases/tag/${tag}`,
    draft: false,
    prerelease: false,
    assets: berkas.map((name) => ({ name, browser_download_url: `https://dl/${tag}/${name}` })),
    ...ekstra,
})

describe('pilihPembaruan', () => {
    it('membandingkan nomor versi, bukan urutan daftar atau tanggal (1.10.0 > 1.9.0)', () => {
        const hasil = pilihPembaruan(
            [rilis('release-desktop-1.10.0', ['a.dmg']), rilis('release-desktop-1.9.0', ['b.dmg'])].reverse(),
            'macos',
            '1.9.0',
        )
        expect(hasil?.versi).toBe('1.10.0')
        expect(hasil?.unduh).toBe('https://dl/release-desktop-1.10.0/a.dmg')
    })

    it('null bila app sudah versi terbaru atau lebih baru', () => {
        const r = [rilis('release-desktop-1.2.0', ['a.dmg'])]
        expect(pilihPembaruan(r, 'macos', '1.2.0')).toBeNull()
        expect(pilihPembaruan(r, 'macos', '1.3.0')).toBeNull()
    })

    it('memisahkan tag per platform: win/macos/android/ios tidak saling terlihat, desktop & mobile berlaku ganda', () => {
        const r = [
            rilis('release-win-2.0.0', ['x.exe']),
            rilis('release-macos-3.0.0', ['x.dmg']),
            rilis('release-android-4.0.0', ['x.apk']),
            rilis('release-ios-5.0.0', ['x.xcarchive.zip']),
            rilis('release-desktop-1.5.0', ['x.exe', 'x.dmg']),
            rilis('release-mobile-1.6.0', ['x.apk', 'x.xcarchive.zip']),
        ]
        expect(pilihPembaruan(r, 'windows', '1.0.0')?.tag).toBe('release-win-2.0.0')
        expect(pilihPembaruan(r, 'macos', '1.0.0')?.tag).toBe('release-macos-3.0.0')
        expect(pilihPembaruan(r, 'android', '1.0.0')?.tag).toBe('release-android-4.0.0')
        expect(pilihPembaruan(r, 'ios', '1.0.0')?.tag).toBe('release-ios-5.0.0')
        // Tag spesifik platform lain tidak mencemari: win hanya melihat desktop & win.
        expect(pilihPembaruan(r.filter((x) => x.tag_name !== 'release-win-2.0.0'), 'windows', '1.0.0')?.tag).toBe('release-desktop-1.5.0')
        expect(pilihPembaruan(r.filter((x) => x.tag_name !== 'release-android-4.0.0'), 'android', '1.0.0')?.tag).toBe('release-mobile-1.6.0')
    })

    it('melewati rilis tanpa berkas platform (build platform itu gagal)', () => {
        const r = [rilis('release-desktop-2.0.0', ['x.exe']), rilis('release-desktop-1.1.0', ['x.dmg'])]
        expect(pilihPembaruan(r, 'macos', '1.0.0')?.versi).toBe('1.1.0')
        expect(pilihPembaruan(r, 'macos', '1.1.0')).toBeNull()
    })

    it('melewati draft, pra-rilis, dan tag di luar skema release-*', () => {
        const r = [
            rilis('release-desktop-9.0.0', ['x.dmg'], { draft: true }),
            rilis('release-desktop-8.0.0-staging', ['x.dmg'], { prerelease: true }),
            rilis('v7.0.0', ['x.dmg']),
            rilis('macos-6.0.0', ['x.dmg']),
        ]
        expect(pilihPembaruan(r, 'macos', '1.0.0')).toBeNull()
    })

    it('Windows memilih .exe NSIS dulu, .msi bila exe tidak ada', () => {
        expect(pilihPembaruan([rilis('release-win-1.1.0', ['x.msi', 'x.exe'])], 'windows', '1.0.0')?.unduh).toMatch(/x\.exe$/)
        expect(pilihPembaruan([rilis('release-win-1.1.0', ['x.msi'])], 'windows', '1.0.0')?.unduh).toMatch(/x\.msi$/)
    })

    it('tag "release-win-2" dinormalkan menjadi 2.0.0', () => {
        expect(pilihPembaruan([rilis('release-win-2', ['x.exe'])], 'windows', '1.9.9')?.versi).toBe('2.0.0')
    })
})
