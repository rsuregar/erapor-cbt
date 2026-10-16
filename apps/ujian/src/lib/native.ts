import { Capacitor, registerPlugin } from '@capacitor/core'

/**
 * Jembatan ke plugin native app (android/…/UjianNativePlugin.java). Semua
 * fungsi aman dipanggil di PWA: tidak melakukan apa-apa / mengembalikan null.
 */

type StatusKunci = { aktif: boolean; mode: 'kios' | 'sematan' | 'tidak' }
type PosisiNative = { lat: number; lng: number; akurasi_m: number; palsu: boolean }

interface UjianNativePlugin {
    kunciLayar(): Promise<StatusKunci>
    lepasKunci(): Promise<StatusKunci>
    statusKunciLayar(): Promise<StatusKunci>
    izinLokasi(): Promise<{ izin: PermissionState }>
    ambilLokasi(opsi: { maksUmurMs?: number; batasMs?: number }): Promise<PosisiNative>
}

const UjianNative = registerPlugin<UjianNativePlugin>('UjianNative')

/** Android: plugin lokal tersedia. iOS menyusul (belum ada proyek iOS). */
export const adaNative = () => Capacitor.getPlatform() === 'android'

/** True jika aplikasi berjalan sebagai native app (Android APK atau iOS), bukan di browser/PWA. */
export const isNative = () => Capacitor.isNativePlatform()

/** Sematkan aplikasi selama ujian. null = bukan app native. */
export async function kunciLayar(): Promise<boolean | null> {
    if (!adaNative()) return null

    return (await UjianNative.kunciLayar().catch(() => ({ aktif: false }))).aktif
}

export async function lepasKunciLayar(): Promise<void> {
    if (adaNative()) await UjianNative.lepasKunci().catch(() => undefined)
}

/** Untuk `kiosk_aktif` (kontrak): null di PWA, karena web tidak bisa membaca kunci OS. */
export async function statusKunciLayar(): Promise<boolean | null> {
    if (!adaNative()) return null

    return (await UjianNative.statusKunciLayar().catch(() => ({ aktif: false }))).aktif
}

export function izinLokasiNative(): Promise<PermissionState> {
    return UjianNative.izinLokasi().then((r) => r.izin)
}

/** Posisi + tanda lokasi palsu dari OS. Galat membawa `code`: DITOLAK / TIDAK_ADA / WAKTU_HABIS. */
export function ambilLokasiNative(opsi: { maksUmurMs?: number; batasMs?: number }): Promise<PosisiNative> {
    return UjianNative.ambilLokasi(opsi)
}
