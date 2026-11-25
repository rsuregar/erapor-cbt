import { platform } from '@/lib/api'

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
    return (
        matchMedia('(display-mode: standalone)').matches ||
        matchMedia('(display-mode: fullscreen)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone === true
    )
}

export const layarPenuhAktif = () => !!document.fullscreenElement

/** Laptop/PC wajib layar penuh di level Ketat/Lockdown; HP/tablet memakai mode standalone. */
export function wajibLayarPenuh(level: 'dasar' | 'ketat' | 'lockdown'): boolean {
    return level !== 'dasar' && platform() === 'pwa' && jenisPerangkat() === 'desktop' && !!document.fullscreenEnabled
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

/**
 * Layar dibagi (Split View / jendela mengambang): viewport jauh lebih sempit
 * dari layar. Hanya untuk HP/tablet — jendela browser laptop memang bebas ukuran.
 */
export function layarDibagi(): boolean {
    if (jenisPerangkat() === 'desktop') return false
    const lanskap = innerWidth > innerHeight
    const lebarLayar = lanskap ? Math.max(screen.width, screen.height) : Math.min(screen.width, screen.height)

    return innerWidth / lebarLayar < 0.8
}

/** HP (bukan tablet) dalam posisi miring: soal jadi sempit. */
export function hpMiring(): boolean {
    return jenisPerangkat() !== 'desktop' && Math.min(screen.width, screen.height) < 600 && innerWidth > innerHeight
}
