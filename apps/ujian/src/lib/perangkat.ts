import { platform } from '@/lib/api'
import { isNative, isTauri } from '@/lib/native'
import { adalahTargetIsian } from '@/lib/proteksiSalin'

/**
 * Info perangkat untuk cek kesiapan dan aturan layar (PRD § Jalur cadangan:
 * mode kiosk tanpa aplikasi). Web hanya bisa MENDETEKSI; kunci OS tidak terbaca.
 */

export type JenisPerangkat = 'ios' | 'android' | 'desktop'

/**
 * Bedakan jenis perangkat dari platform native & userAgent.
 * Tablet Android di Chrome mode "Desktop Site" sering mengirim `X11; Linux x86_64` tanpa
 * kata `Android`; bedakan lewat layar sentuh (`maxTouchPoints > 1`) sambil mengecualikan Chromebook (`CrOS`).
 */
export function deteksiJenisPerangkat(params: {
    platform: 'android' | 'ios' | 'pwa'
    userAgent: string
    maxTouchPoints: number
}): JenisPerangkat {
    if (params.platform !== 'pwa') return params.platform
    const ua = params.userAgent
    // iPadOS 13+ mengaku Macintosh; bedakan lewat layar sentuh.
    if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && params.maxTouchPoints > 1)) return 'ios'
    if (/Android/.test(ua) || (/Linux/.test(ua) && !/CrOS/.test(ua) && params.maxTouchPoints > 1)) return 'android'

    return 'desktop'
}

export function jenisPerangkat(): JenisPerangkat {
    return deteksiJenisPerangkat({
        platform: platform(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        maxTouchPoints: typeof navigator !== 'undefined' ? (navigator.maxTouchPoints ?? 0) : 0,
    })
}

/** Dibuka dari ikon layar utama (PWA terpasang), bukan tab browser biasa. */
export function standalone(): boolean {
    const mm = typeof matchMedia === 'function' ? matchMedia : null
    return (
        Boolean(mm?.('(display-mode: standalone)').matches) ||
        Boolean(mm?.('(display-mode: fullscreen)').matches) ||
        (typeof navigator !== 'undefined' && (navigator as Navigator & { standalone?: boolean }).standalone === true)
    )
}

export const layarPenuhAktif = () => !!document.fullscreenElement

/** Laptop/PC wajib layar penuh di level Ketat/Lockdown; HP/tablet & Tauri memakai mode kiosk/standalone. */
export function wajibLayarPenuh(level: 'dasar' | 'ketat' | 'lockdown'): boolean {
    return level !== 'dasar' && !isTauri() && platform() === 'pwa' && jenisPerangkat() === 'desktop' && !!document.fullscreenEnabled
}

/** Harus dipanggil langsung dari klik (aturan browser). */
export async function masukLayarPenuh(): Promise<boolean> {
    if (layarPenuhAktif()) return true
    if (!document.fullscreenEnabled) return false
    try {
        // Sebagian webview/browser tidak pernah menyelesaikan janji ini: jangan biarkan tombol Mulai macet.
        const batas = new Promise<never>((_, gagal) => setTimeout(() => gagal(new Error('waktu habis')), 3000))
        await Promise.race([document.documentElement.requestFullscreen({ navigationUI: 'hide' }), batas])
        if (!layarPenuhAktif()) return false
        // Kunci orientasi bila didukung (Android); diabaikan di tempat lain.
        await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.(screen.orientation.type).catch(() => undefined)

        return true
    } catch {
        return false
    }
}

/** Baca orientasi fisik layar dari Screen Orientation API / ukuran layar (tidak tertipu keyboard virtual). */
function apakahLanskap(): boolean {
    const tipe = typeof screen !== 'undefined' ? screen.orientation?.type : undefined
    if (tipe) return tipe.startsWith('landscape')
    const orientasiWin = typeof window !== 'undefined' ? (window as Window & { orientation?: number }).orientation : undefined
    if (typeof orientasiWin === 'number') return Math.abs(orientasiWin) === 90
    if (jenisPerangkat() !== 'ios' && typeof screen !== 'undefined' && screen.width && screen.height && screen.width !== screen.height) {
        return screen.width > screen.height
    }

    return typeof innerWidth === 'number' && typeof innerHeight === 'number' ? innerWidth > innerHeight : false
}

export type ParamLayarDibagi = {
    jenisPerangkat: JenisPerangkat
    screenWidth: number
    screenHeight: number
    innerWidth: number
    innerHeight: number
    visualViewportWidth?: number
    visualViewportScale?: number
    orientationType?: string
    windowOrientation?: number
    standalone: boolean
    fokusIsian: boolean
}

const AMBANG_LEBAR_PENUH = 0.9

/**
 * Deteksi Split View, Stage Manager, atau jendela mengambang pada HP/tablet.
 * Di iPadOS, `screen.width` & `screen.height` tetap dalam koordinat potret meski perangkat lanskap,
 * dan `screen.orientation` kadang tidak berubah/tersedia — jadi cek kecocokan terhadap orientasi
 * eksplisit atau kedua orientasi bila orientasi tidak diketahui.
 */
export function deteksiLayarDibagi(params: ParamLayarDibagi): boolean {
    if (params.jenisPerangkat === 'desktop') return false
    const { screenWidth, screenHeight, innerWidth, innerHeight } = params
    if (screenWidth <= 0 || screenHeight <= 0 || innerWidth <= 0) return false

    const pendek = Math.min(screenWidth, screenHeight)
    const panjang = Math.max(screenWidth, screenHeight)
    const vvLebar = params.visualViewportWidth
    const vvSkala = params.visualViewportScale ?? 1
    const lebarEfektif = vvLebar && vvLebar > 0 && vvSkala <= 1.05 ? Math.min(innerWidth, vvLebar) : innerWidth

    let lanskap: boolean | null = null
    if (params.orientationType) {
        lanskap = params.orientationType.startsWith('landscape')
    } else if (typeof params.windowOrientation === 'number') {
        lanskap = Math.abs(params.windowOrientation) === 90
    } else if (params.jenisPerangkat !== 'ios' && screenWidth !== screenHeight) {
        lanskap = screenWidth > screenHeight
    }

    const batasTinggi = params.standalone ? 0.85 : 0.78
    const cocokOrientasi = (lebarLayar: number, tinggiLayar: number): boolean => {
        if (lebarEfektif / lebarLayar < AMBANG_LEBAR_PENUH) return false
        if (pendek >= 600 && !params.fokusIsian && innerHeight > 0 && innerHeight / tinggiLayar < batasTinggi) {
            return false
        }
        return true
    }

    if (lanskap === true) return !cocokOrientasi(panjang, pendek)
    if (lanskap === false) return !cocokOrientasi(pendek, panjang)

    return !cocokOrientasi(panjang, pendek) && !cocokOrientasi(pendek, panjang)
}

/**
 * Layar dibagi (Split View / Stage Manager / jendela mengambang): viewport jauh lebih kecil
 * dari layar. Hanya untuk HP/tablet — jendela browser laptop memang bebas ukuran.
 */
export function layarDibagi(): boolean {
    const jenis = jenisPerangkat()
    if (jenis === 'desktop') return false

    return deteksiLayarDibagi({
        jenisPerangkat: jenis,
        screenWidth: typeof screen !== 'undefined' ? screen.width : 0,
        screenHeight: typeof screen !== 'undefined' ? screen.height : 0,
        innerWidth: typeof innerWidth === 'number' ? innerWidth : 0,
        innerHeight: typeof innerHeight === 'number' ? innerHeight : 0,
        visualViewportWidth: typeof visualViewport !== 'undefined' && visualViewport ? visualViewport.width : undefined,
        visualViewportScale: typeof visualViewport !== 'undefined' && visualViewport ? visualViewport.scale : undefined,
        orientationType: typeof screen !== 'undefined' ? screen.orientation?.type : undefined,
        windowOrientation:
            typeof window !== 'undefined' ? (window as Window & { orientation?: number }).orientation : undefined,
        standalone: standalone() || isNative(),
        fokusIsian: typeof document !== 'undefined' && adalahTargetIsian(document.activeElement),
    })
}

/** HP (bukan tablet) dalam posisi miring: soal jadi sempit. */
export function hpMiring(): boolean {
    return jenisPerangkat() !== 'desktop' && Math.min(screen.width, screen.height) < 600 && apakahLanskap()
}
