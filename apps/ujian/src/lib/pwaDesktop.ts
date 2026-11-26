import { isNative } from '@/lib/native'
import { jenisPerangkat, standalone, type JenisPerangkat } from '@/lib/perangkat'

/**
 * Selaras dengan skrip inline di `vite.config.ts` (`manifesKhususMobile`):
 * mengembalikan true hanya pada iPhone/iPad atau Android (termasuk tablet mode Desktop Site).
 */
export function adalahPerangkatMobileUntukManifes(userAgent: string, maxTouchPoints: number): boolean {
    if (/iPhone|iPad|iPod|Android/.test(userAgent)) return true
    return (/Macintosh/.test(userAgent) || (/Linux/.test(userAgent) && !/CrOS/.test(userAgent))) && maxTouchPoints > 1
}

/**
 * True bila halaman web dibuka dari jendela PWA terpasang di laptop/PC (bukan Exam Browser native
 * dan bukan browser tab biasa), misalnya terlanjur pasang sebelum update atau lewat "Install page as app".
 */
export function apakahPwaDesktopTerpasang(opsi?: {
    native?: boolean
    perangkat?: JenisPerangkat
    standalone?: boolean
}): boolean {
    const native = opsi?.native ?? isNative()
    const perangkat = opsi?.perangkat ?? jenisPerangkat()
    const diStandalone = opsi?.standalone ?? standalone()
    return !native && perangkat === 'desktop' && diStandalone
}
