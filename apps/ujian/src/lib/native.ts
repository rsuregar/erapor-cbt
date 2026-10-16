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

/** Deteksi apakah aplikasi berjalan di dalam Tauri Desktop (Windows / macOS / Linux Exam Browser) */
export const isTauri = () =>
    typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

/** True jika aplikasi berjalan sebagai native app (Android APK, iOS, atau Tauri Desktop Exam Browser). */
export const isNative = () => Capacitor.isNativePlatform() || isTauri()

/**
 * Keluar / tutup aplikasi (Tauri Desktop Exam Browser atau Capacitor Mobile).
 * Selalu membersihkan sesi akun (logout) terlebih dahulu agar tidak tertinggal.
 */
export async function keluarAplikasi(): Promise<void> {
    try {
        const { api } = await import('@/lib/api')
        const { sesi } = await import('@/lib/sesi')
        const { penyimpanan } = await import('@/lib/ujian')

        // Panggil endpoint logout server jika memungkinkan
        if (api && typeof api.keluar === 'function') {
            await api.keluar().catch(() => undefined)
        }

        // Hapus cache lokal data ujian murid
        if (sesi && typeof sesi.uuid === 'function') {
            const uuid = sesi.uuid()
            if (uuid && penyimpanan && typeof penyimpanan.hapus === 'function') {
                await penyimpanan.hapus(`daftar-ujian:${uuid}`).catch(() => undefined)
            }
        }

        // Hapus kredensial sesi lokal
        if (sesi && typeof sesi.keluar === 'function') {
            await sesi.keluar().catch(() => undefined)
        }
    } catch {
        // Abaikan jika modul sesi belum diinisialisasi atau di lingkungan non-browser
    }

    if (isTauri()) {
        try {
            const { invoke } = await import('@tauri-apps/api/core')
            await invoke('keluar_aplikasi')
        } catch {
            // Abaikan jika tidak di runtime Tauri
        }
    } else if (Capacitor.isNativePlatform()) {
        try {
            const { App } = await import('@capacitor/app')
            await App.exitApp()
        } catch {
            // Abaikan jika bukan runtime Capacitor
        }
    } else if (typeof window !== 'undefined' && typeof window.close === 'function') {
        window.close()
    }
}

/** Keluar / tutup aplikasi desktop Tauri (alias untuk kompatibilitas) */
export const keluarAplikasiTauri = keluarAplikasi

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
