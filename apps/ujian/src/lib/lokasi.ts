import type { Lokasi } from '@erapor-cbt/exam-core'

/**
 * Posisi perangkat untuk ujian "di sekolah" (kontrak § Lokasi ujian).
 * Memakai Geolocation web — jalan di PWA dan WebView Capacitor. Deteksi
 * lokasi palsu (mock) butuh plugin native; sampai ada, `palsu` = false.
 */

export type GalatLokasi = 'DITOLAK' | 'TIDAK_ADA' | 'WAKTU_HABIS' | 'TIDAK_DIDUKUNG'

export type PosisiDidapat = Lokasi & { pada: number }

/** Server menolak akurasi > 200 m; tetap kirim, tapi beri tahu murid lebih dulu. */
export const BATAS_AKURASI_M = 200

export function dukungLokasi(): boolean {
    return typeof navigator !== 'undefined' && 'geolocation' in navigator
}

export function ambilPosisi(opsi: { maksUmurMs?: number; batasMs?: number } = {}): Promise<PosisiDidapat> {
    return new Promise((selesai, gagal) => {
        if (!dukungLokasi()) {
            gagal(galat('TIDAK_DIDUKUNG'))

            return
        }
        navigator.geolocation.getCurrentPosition(
            (p) =>
                selesai({
                    lat: p.coords.latitude,
                    lng: p.coords.longitude,
                    akurasi_m: Math.round(p.coords.accuracy),
                    palsu: false,
                    pada: Date.now(),
                }),
            (e) => gagal(galat(e.code === e.PERMISSION_DENIED ? 'DITOLAK' : e.code === e.TIMEOUT ? 'WAKTU_HABIS' : 'TIDAK_ADA')),
            { enableHighAccuracy: true, timeout: opsi.batasMs ?? 20_000, maximumAge: opsi.maksUmurMs ?? 0 },
        )
    })
}

/** 'granted' | 'denied' | 'prompt', atau null bila browser tidak memberi tahu (Safari lama). */
export async function izinLokasi(): Promise<PermissionState | null> {
    try {
        return (await navigator.permissions.query({ name: 'geolocation' })).state
    } catch {
        return null
    }
}

export const tanpaWaktu = ({ lat, lng, akurasi_m, palsu }: PosisiDidapat): Lokasi => ({ lat, lng, akurasi_m, palsu })

function galat(kode: GalatLokasi) {
    return Object.assign(new Error(kode), { kode })
}

export function kodeGalatLokasi(e: unknown): GalatLokasi {
    return (e as { kode?: GalatLokasi })?.kode ?? 'TIDAK_ADA'
}

/** Petunjuk membuka izin lokasi yang sudah ditolak — beda per platform. */
export function petunjukIzin(): string {
    const ua = navigator.userAgent
    if (/iPhone|iPad|iPod/.test(ua)) return 'Buka Pengaturan → Privasi & Keamanan → Layanan Lokasi, nyalakan, lalu izinkan untuk browser/aplikasi ini.'
    if (/Android/.test(ua)) return 'Ketuk ikon gembok/pengaturan di sebelah alamat, pilih Izin → Lokasi → Izinkan. Pastikan GPS (Lokasi) di panel cepat menyala.'

    return 'Klik ikon gembok di sebelah alamat situs, izinkan Lokasi, lalu muat ulang halaman.'
}
