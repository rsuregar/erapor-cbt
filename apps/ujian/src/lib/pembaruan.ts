import { STAGING } from '@/lib/lingkungan'
import { bandingkanVersi } from '@/lib/versi'
import { Capacitor } from '@capacitor/core'

/**
 * Cek pembaruan app dari GitHub Releases (repo rilis PUBLIK, bukan repo kode).
 *
 * Tag rilis (dibuat CI, lihat docs/panduan-build-dan-cicd.md):
 *   release-desktop-X.Y.Z  → Windows + macOS
 *   release-win-X.Y.Z / release-macos-X.Y.Z
 *   release-mobile-X.Y.Z   → Android + iOS
 *   release-android-X.Y.Z / release-ios-X.Y.Z
 *
 * Build STAGING (VITE_LINGKUNGAN=staging) memakai saluran terpisah: hanya pra-rilis
 * staging-X.Y.Z-bN (scripts/publish-staging.mjs), dibandingkan versi lalu nomor build.
 * App produksi tidak pernah menawarkan rilis staging, dan sebaliknya.
 */

export type PlatformRilis = 'windows' | 'macos' | 'android' | 'ios'

export type InfoPembaruan = {
    /** Versi terbaru, dinormalkan ke X.Y.Z. */
    versi: string
    tag: string
    /** Tautan langsung ke berkas pemasang platform ini. */
    unduh: string
    /** Halaman rilis di GitHub (catatan rilis). */
    halaman: string
    /** Manifes updater Tauri (`*-updater.json`) untuk pasang di dalam app; hanya desktop & bila CI menandatangani build. */
    manifes?: string
}

export type RilisGithub = {
    tag_name: string
    html_url: string
    draft: boolean
    prerelease: boolean
    assets: { name: string; browser_download_url: string }[]
}

const REPO_RILIS = (import.meta.env.VITE_UPDATE_REPO as string | undefined) || 'rsuregar/erapor-cbt-releases'

/**
 * Jeda antar cek. API GitHub tanpa token dibatasi 60 permintaan/jam per IP dan lab
 * sekolah berbagi IP; 1 jam tetap di bawah batas untuk satu lab, dan rilis baru
 * terlihat paling lambat 1 jam. Bila batas terlampaui, cek gagal diam-diam.
 */
export const TTL_CEK_PEMBARUAN_MS = 60 * 60 * 1000
const KUNCI_CACHE = STAGING ? 'cbt:cek-pembaruan:staging' : 'cbt:cek-pembaruan'

const JENIS_TAG: Record<PlatformRilis, string[]> = {
    windows: ['desktop', 'win'],
    macos: ['desktop', 'macos'],
    android: ['mobile', 'android'],
    ios: ['mobile', 'ios'],
}

/** Urutan = prioritas pemasang bila rilis memuat lebih dari satu berkas. */
const BERKAS: Record<PlatformRilis, RegExp[]> = {
    windows: [/\.exe$/i, /\.msi$/i],
    macos: [/\.dmg$/i],
    android: [/\.apk$/i],
    ios: [/\.xcarchive\.zip$/i],
}

/** Manifes updater Tauri per platform, diunggah CI bila kunci tanda tangan updater tersedia. */
const MANIFES: Partial<Record<PlatformRilis, RegExp>> = {
    windows: /windows.*-updater\.json$/i,
    macos: /macos.*-updater\.json$/i,
}

const POLA_TAG = /^release-(desktop|win|macos|mobile|android|ios)-v?(\d+(?:\.\d+){0,2})(?:-.+)?$/
/** Satu tag staging memuat berkas semua platform yang dibuild pada nomor build itu. */
const POLA_STAGING = /^staging-(\d+\.\d+\.\d+)-b(\d+)$/

export type Saluran = { staging: boolean; buildApp: number }

function asetPlatform(r: RilisGithub, platform: PlatformRilis) {
    for (const pola of BERKAS[platform]) {
        const aset = r.assets.find((a) => pola.test(a.name))
        if (aset) return aset
    }

    return undefined
}

/** Info pembaruan dari satu rilis; `manifes` hanya diisi bila rilis memuatnya. */
function infoRilis(r: RilisGithub, platform: PlatformRilis, versi: string, unduh: string): InfoPembaruan {
    const pola = MANIFES[platform]
    const manifes = pola && r.assets.find((a) => pola.test(a.name))?.browser_download_url

    return { versi, tag: r.tag_name, unduh, halaman: r.html_url, ...(manifes ? { manifes } : {}) }
}

/** Saluran staging: tag staging-X.Y.Z-bN terbaru yang memuat berkas platform ini, bila lebih baru dari app. */
function pilihPembaruanStaging(rilis: RilisGithub[], platform: PlatformRilis, versiApp: string, buildApp: number): InfoPembaruan | null {
    let terbaik: (InfoPembaruan & { build: number; dasar: string }) | null = null
    const lebihBaru = (v: string, b: number, v2: string, b2: number) => {
        const banding = bandingkanVersi(v, v2) ?? 0

        return banding > 0 || (banding === 0 && b > b2)
    }

    for (const r of rilis) {
        if (r.draft) continue
        const m = POLA_STAGING.exec(r.tag_name)
        if (!m) continue
        const [dasar, build] = [m[1], Number(m[2])]
        if (terbaik && !lebihBaru(dasar, build, terbaik.dasar, terbaik.build)) continue
        const aset = asetPlatform(r, platform)
        if (!aset) continue
        terbaik = { ...infoRilis(r, platform, `${dasar}-b${build}`, aset.browser_download_url), build, dasar }
    }
    if (!terbaik || !lebihBaru(terbaik.dasar, terbaik.build, versiApp.replace(/-.*$/, ''), buildApp)) return null
    const { build: _build, dasar: _dasar, ...info } = terbaik

    return info
}

/** Platform pemasang untuk app ini; null = PWA/Linux (tidak ada pembaruan lewat rilis). */
export function platformRilis(): PlatformRilis | null {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        const ua = navigator.userAgent
        if (/Windows/i.test(ua)) return 'windows'
        if (/Macintosh|Mac OS X/i.test(ua)) return 'macos'

        return null
    }
    const p = Capacitor.getPlatform()

    return p === 'android' || p === 'ios' ? p : null
}

function normalkan(versi: string): string {
    const bagian = versi.split('.')
    while (bagian.length < 3) bagian.push('0')

    return bagian.join('.')
}

/**
 * Rilis terbaru (menurut nomor versi pada tag, bukan tanggal) yang memuat berkas
 * pemasang untuk `platform`, bila lebih baru dari `versiApp`. Draft dan pra-rilis
 * (mis. staging) dilewati. Rilis tanpa berkas platform ini (build platform itu
 * gagal) juga dilewati supaya tidak menawarkan unduhan yang tidak ada.
 */
export function pilihPembaruan(
    rilis: RilisGithub[],
    platform: PlatformRilis,
    versiApp: string,
    saluran: Saluran = { staging: false, buildApp: 0 },
): InfoPembaruan | null {
    if (saluran.staging) return pilihPembaruanStaging(rilis, platform, versiApp, saluran.buildApp)
    let terbaik: InfoPembaruan | null = null

    for (const r of rilis) {
        if (r.draft || r.prerelease) continue
        const m = POLA_TAG.exec(r.tag_name)
        if (!m || !JENIS_TAG[platform].includes(m[1])) continue
        const versi = normalkan(m[2])
        if (terbaik && (bandingkanVersi(versi, terbaik.versi) ?? 0) <= 0) continue

        const aset = asetPlatform(r, platform)
        if (!aset) continue

        terbaik = infoRilis(r, platform, versi, aset.browser_download_url)
    }

    return terbaik && (bandingkanVersi(terbaik.versi, versiApp) ?? 0) > 0 ? terbaik : null
}

type IsiCache = { pada: number; versiApp: string; info: InfoPembaruan | null }

function bacaCache(): IsiCache | null {
    try {
        const c = JSON.parse(localStorage.getItem(KUNCI_CACHE) ?? 'null') as IsiCache | null
        if (c && c.versiApp === __VERSI_APP__ && Date.now() - c.pada < TTL_CEK_PEMBARUAN_MS) return c
    } catch {
        // cache rusak / localStorage tidak tersedia: lanjut cek ke jaringan
    }

    return null
}

/** null = sudah versi terbaru atau platform ini tidak dicek. Melempar galat bila jaringan/GitHub gagal. */
export async function cekPembaruan(): Promise<InfoPembaruan | null> {
    const platform = platformRilis()
    if (!platform) return null

    const cache = bacaCache()
    if (cache) return cache.info

    const res = await fetch(`https://api.github.com/repos/${REPO_RILIS}/releases?per_page=30`, {
        headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) throw new Error(`Cek pembaruan gagal (HTTP ${res.status})`)

    const info = pilihPembaruan((await res.json()) as RilisGithub[], platform, __VERSI_APP__, { staging: STAGING, buildApp: __BUILD_APP__ })
    try {
        localStorage.setItem(KUNCI_CACHE, JSON.stringify({ pada: Date.now(), versiApp: __VERSI_APP__, info } satisfies IsiCache))
    } catch {
        // abaikan: hanya mengurangi efektivitas cache
    }

    return info
}
