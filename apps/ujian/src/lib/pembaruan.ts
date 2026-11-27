import { STAGING } from '@/lib/lingkungan'
import { bandingkanVersi } from '@/lib/versi'
import { UNDUHAN_TERBARU } from '@/lib/dataUnduhan'
import { Capacitor } from '@capacitor/core'

/**
 * Cek pembaruan app dari GitHub Releases (repo rilis PUBLIK, bukan repo kode).
 *
 * Tag rilis (dibuat CI, lihat docs/panduan-build-dan-cicd.md):
 *   vX.Y.Z / release-all-X.Y.Z / release-universal-X.Y.Z → Semua platform
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
export type ArchRilis = 'arm64' | 'x64'

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
    assets: { name: string; browser_download_url: string; size?: number }[]
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
    windows: ['all', 'universal', 'desktop', 'win'],
    macos: ['all', 'universal', 'desktop', 'macos'],
    android: ['all', 'universal', 'mobile', 'android'],
    ios: ['all', 'universal', 'mobile', 'ios'],
}

/** Urutan = prioritas pemasang bila rilis memuat lebih dari satu berkas. */
const BERKAS: Record<PlatformRilis, RegExp[]> = {
    windows: [/\.msi$/i, /\.exe$/i],
    macos: [/arm64\.dmg$/i, /universal\.dmg$/i, /\.dmg$/i],
    android: [/\.apk$/i],
    ios: [/\.xcarchive\.zip$/i],
}

/** Manifes updater Tauri per platform, diunggah CI bila kunci tanda tangan updater tersedia. */
const MANIFES: Partial<Record<PlatformRilis, RegExp>> = {
    windows: /windows.*-updater\.json$/i,
    macos: /macos.*-updater\.json$/i,
}

const POLA_SEMVER_TAG = /^v(\d+(?:\.\d+){0,2})(?:-.+)?$/
const POLA_RELEASE_TAG = /^release-(?:(all|universal|desktop|win|macos|mobile|android|ios)-)?v?(\d+(?:\.\d+){0,2})(?:-.+)?$/
/** Satu tag staging memuat berkas semua platform yang dibuild pada nomor build itu. */
const POLA_STAGING = /^staging-(\d+\.\d+\.\d+)-b(\d+)$/

export type Saluran = { staging: boolean; buildApp: number; arch?: ArchRilis }

function asetPlatform(r: RilisGithub, platform: PlatformRilis, arch?: ArchRilis) {
    if (platform === 'macos') {
        const polaPrioritas =
            arch === 'x64'
                ? [/x64\.dmg$/i, /x86_64\.dmg$/i, /universal\.dmg$/i]
                : [/arm64\.dmg$/i, /universal\.dmg$/i]
        for (const pola of polaPrioritas) {
            const aset = r.assets.find((a) => pola.test(a.name))
            if (aset) return aset
        }
        const polaLain = arch === 'x64' ? /(?:arm64|aarch64)\.dmg$/i : /(?:x64|x86_64)\.dmg$/i
        return r.assets.find((a) => /\.dmg$/i.test(a.name) && !polaLain.test(a.name))
    }

    for (const pola of BERKAS[platform]) {
        const aset = r.assets.find((a) => pola.test(a.name))
        if (aset) return aset
    }

    return undefined
}

function manifesPlatform(r: RilisGithub, platform: PlatformRilis, arch?: ArchRilis): string | undefined {
    if (platform === 'macos') {
        const polaArch =
            arch === 'x64' ? /macos.*(?:x64|x86_64)-updater\.json$/i : /macos.*(?:arm64|aarch64)-updater\.json$/i
        const cocokArch = r.assets.find((a) => polaArch.test(a.name))
        if (cocokArch) return cocokArch.browser_download_url
        const polaSalahArch = /(?:arm64|aarch64|x64|x86_64)-updater\.json$/i
        return r.assets.find((a) => /macos.*-updater\.json$/i.test(a.name) && !polaSalahArch.test(a.name))
            ?.browser_download_url
    }

    const pola = MANIFES[platform]
    return pola ? r.assets.find((a) => pola.test(a.name))?.browser_download_url : undefined
}

/** Info pembaruan dari satu rilis; `manifes` hanya diisi bila rilis memuatnya. */
function infoRilis(r: RilisGithub, platform: PlatformRilis, versi: string, unduh: string, arch?: ArchRilis): InfoPembaruan {
    const manifes = manifesPlatform(r, platform, arch)

    return { versi, tag: r.tag_name, unduh, halaman: r.html_url, ...(manifes ? { manifes } : {}) }
}

/** Saluran staging: tag staging-X.Y.Z-bN terbaru yang memuat berkas platform ini, bila lebih baru dari app. */
function pilihPembaruanStaging(
    rilis: RilisGithub[],
    platform: PlatformRilis,
    versiApp: string,
    buildApp: number,
    arch?: ArchRilis,
): InfoPembaruan | null {
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
        const aset = asetPlatform(r, platform, arch)
        if (!aset) continue
        terbaik = { ...infoRilis(r, platform, `${dasar}-b${build}`, aset.browser_download_url, arch), build, dasar }
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

function uraiTagProduksi(tag: string): { jenis: string; versi: string } | null {
    const t = tag.trim()
    const mSemver = POLA_SEMVER_TAG.exec(t)
    if (mSemver) return { jenis: 'all', versi: normalkan(mSemver[1]) }

    const mRelease = POLA_RELEASE_TAG.exec(t)
    if (mRelease) return { jenis: mRelease[1] || 'all', versi: normalkan(mRelease[2]) }

    return null
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
    if (saluran.staging) return pilihPembaruanStaging(rilis, platform, versiApp, saluran.buildApp, saluran.arch)
    let terbaik: InfoPembaruan | null = null

    for (const r of rilis) {
        if (r.draft || r.prerelease) continue
        const u = uraiTagProduksi(r.tag_name)
        if (!u || !JENIS_TAG[platform].includes(u.jenis)) continue
        const versi = u.versi
        if (terbaik && (bandingkanVersi(versi, terbaik.versi) ?? 0) <= 0) continue

        const aset = asetPlatform(r, platform, saluran.arch)
        if (!aset) continue

        terbaik = infoRilis(r, platform, versi, aset.browser_download_url, saluran.arch)
    }

    return terbaik && (bandingkanVersi(terbaik.versi, versiApp) ?? 0) > 0 ? terbaik : null
}

async function ambilArsitekturDesktop(): Promise<ArchRilis | undefined> {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) return undefined
    try {
        const { invoke } = await import('@tauri-apps/api/core')
        const arch = await invoke<string>('arsitektur_aplikasi')
        if (arch === 'x86_64') return 'x64'
        if (arch === 'aarch64') return 'arm64'
    } catch {
        // abaikan jika runtime lama belum menyediakan command ini
    }
    return undefined
}

async function fetchGithub(url: string, init?: RequestInit): Promise<Response> {
    if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
        try {
            const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
            return await tauriFetch(url, init)
        } catch {
            // fallback ke fetch web biasa bila plugin tidak tersedia
        }
    }
    return globalThis.fetch(url, init)
}

type IsiCache = { pada: number; versiApp: string; arch?: ArchRilis; info: InfoPembaruan | null }

function bacaCache(arch?: ArchRilis): IsiCache | null {
    try {
        const c = JSON.parse(localStorage.getItem(KUNCI_CACHE) ?? 'null') as IsiCache | null
        if (c && c.versiApp === __VERSI_APP__ && c.arch === arch && Date.now() - c.pada < TTL_CEK_PEMBARUAN_MS) return c
    } catch {
        // cache rusak / localStorage tidak tersedia: lanjut cek ke jaringan
    }

    return null
}

/** null = sudah versi terbaru atau platform ini tidak dicek. Melempar galat bila jaringan/GitHub gagal. */
export async function cekPembaruan(): Promise<InfoPembaruan | null> {
    const platform = platformRilis()
    if (!platform) return null

    const arch = await ambilArsitekturDesktop()
    const cache = bacaCache(arch)
    if (cache) return cache.info

    const res = await fetchGithub(`https://api.github.com/repos/${REPO_RILIS}/releases?per_page=30`, {
        headers: { Accept: 'application/vnd.github+json' },
    })
    if (!res.ok) throw new Error(`Cek pembaruan gagal (HTTP ${res.status})`)

    const info = pilihPembaruan((await res.json()) as RilisGithub[], platform, __VERSI_APP__, {
        staging: STAGING,
        buildApp: __BUILD_APP__,
        arch,
    })
    try {
        localStorage.setItem(KUNCI_CACHE, JSON.stringify({ pada: Date.now(), versiApp: __VERSI_APP__, arch, info } satisfies IsiCache))
    } catch {
        // abaikan: hanya mengurangi efektivitas cache
    }

    return info
}

/** Berkas pemasang terbaru per platform untuk tautan unduh di halaman Masuk (web/PWA). */
export type UnduhanPlatform = { versi: string; unduh: string; halaman: string; ukuran?: number }
export type KunciUnduhan = Exclude<PlatformRilis, 'ios'> | 'macos_intel'
export type DaftarUnduhan = Partial<Record<KunciUnduhan, UnduhanPlatform>>

/**
 * Rilis terbaru tiap platform berpemasang (Windows, macOS, Android) — memakai aturan
 * yang sama dengan cek pembaruan (tag sesuai platform, lewati draft/pra-rilis, lewati
 * rilis tanpa berkas). iOS tidak punya berkas unduhan: murid memasang PWA.
 */
export function pilihUnduhan(rilis: RilisGithub[], saluran: Saluran = { staging: false, buildApp: 0 }): DaftarUnduhan {
    const hasil: DaftarUnduhan = {}
    for (const p of ['windows', 'macos', 'android'] as const) {
        const info = pilihPembaruan(rilis, p, '0.0.0', { staging: saluran.staging, buildApp: -1 })
        if (!info) continue
        const ukuran = rilis.find((r) => r.tag_name === info.tag)?.assets.find((a) => a.browser_download_url === info.unduh)?.size
        hasil[p] = { versi: info.versi, unduh: info.unduh, halaman: info.halaman, ...(ukuran ? { ukuran } : {}) }
    }

    // Ekstrak rilis macOS Intel (x64) bila tersedia berdampingan dengan Apple Silicon
    let terbaikIntel: (UnduhanPlatform & { build?: number; dasar?: string }) | null = null
    for (const r of rilis) {
        if (r.draft) continue
        const asetIntel = r.assets?.find((a) => /x64\.dmg$/i.test(a.name) || /x86_64\.dmg$/i.test(a.name))
        if (!asetIntel) continue

        if (saluran.staging) {
            const m = POLA_STAGING.exec(r.tag_name)
            if (!m) continue
            const [dasar, build] = [m[1], Number(m[2])]
            const banding = terbaikIntel ? (bandingkanVersi(dasar, terbaikIntel.dasar!) ?? 0) : 1
            if (terbaikIntel && !(banding > 0 || (banding === 0 && build > (terbaikIntel.build ?? 0)))) continue
            terbaikIntel = {
                versi: `${dasar}-b${build}`,
                unduh: asetIntel.browser_download_url,
                halaman: r.html_url,
                ...(asetIntel.size ? { ukuran: asetIntel.size } : {}),
                dasar,
                build,
            }
            continue
        }

        if (r.prerelease) continue
        const u = uraiTagProduksi(r.tag_name)
        if (!u || !JENIS_TAG.macos.includes(u.jenis)) continue
        if (terbaikIntel && (bandingkanVersi(u.versi, terbaikIntel.versi) ?? 0) <= 0) continue

        terbaikIntel = {
            versi: u.versi,
            unduh: asetIntel.browser_download_url,
            halaman: r.html_url,
            ...(asetIntel.size ? { ukuran: asetIntel.size } : {}),
        }
    }
    if (terbaikIntel) {
        const { build: _build, dasar: _dasar, ...intel } = terbaikIntel
        hasil.macos_intel = intel
    }

    return hasil
}

/**
 * Gabungkan data unduhan dengan prioritas versi tertinggi per platform.
 * Mencegah data platform hilang saat ada rilis parsial (misal hanya rilis Android).
 */
export function gabungUnduhan(dasar: DaftarUnduhan, baru?: DaftarUnduhan | null): DaftarUnduhan {
    const hasil: DaftarUnduhan = { ...dasar }
    if (!baru) return hasil
    for (const p of ['windows', 'macos', 'macos_intel', 'android'] as const) {
        const itemBaru = baru[p]
        if (!itemBaru) continue
        const itemDasar = hasil[p]
        if (!itemDasar || (bandingkanVersi(itemBaru.versi, itemDasar.versi) ?? -1) > 0) {
            hasil[p] = itemBaru
        }
    }
    return hasil
}

const KUNCI_CACHE_UNDUHAN = STAGING ? 'cbt:unduhan-app:staging' : 'cbt:unduhan-app'

/** Daftar unduhan terbaru, di-cache 1 jam (batas API GitHub tanpa token 60/jam per IP). */
export async function cariUnduhan(): Promise<DaftarUnduhan> {
    try {
        const c = JSON.parse(localStorage.getItem(KUNCI_CACHE_UNDUHAN) ?? 'null') as { pada: number; data: DaftarUnduhan } | null
        if (c && Date.now() - c.pada < TTL_CEK_PEMBARUAN_MS) {
            return gabungUnduhan(UNDUHAN_TERBARU, c.data)
        }
    } catch {
        // cache rusak / localStorage tidak tersedia
    }

    try {
        const res = await fetchGithub(`https://api.github.com/repos/${REPO_RILIS}/releases?per_page=30`, {
            headers: { Accept: 'application/vnd.github+json' },
        })
        if (!res.ok) throw new Error(`Gagal memuat daftar unduhan (HTTP ${res.status})`)

        const dataTerpilih = pilihUnduhan((await res.json()) as RilisGithub[], { staging: STAGING, buildApp: -1 })
        const data = gabungUnduhan(UNDUHAN_TERBARU, dataTerpilih)
        try {
            localStorage.setItem(KUNCI_CACHE_UNDUHAN, JSON.stringify({ pada: Date.now(), data }))
        } catch {
            // abaikan
        }

        return data
    } catch {
        return UNDUHAN_TERBARU
    }
}
