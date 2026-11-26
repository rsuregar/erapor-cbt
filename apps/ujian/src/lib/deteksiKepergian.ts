import type { JenisPerangkat } from '@/lib/perangkat'
import type { JenisPelanggaran } from '@erapor-cbt/exam-core'

/**
 * `window.blur` di Android/iOS (khususnya WebView/Chrome tablet saat unmount input atau
 * tutup keyboard virtual saat pindah soal) sering menembak meski halaman tetap `visible`.
 * Di Tauri Exam Browser, pemantauan fokus memakai event fokus jendela OS (`onFocusChanged`)
 * alih-alih DOM `window.blur` agar popup/dialog internal WebView2 tidak memicu false positive.
 * Karena itu, hanya pantau `blur`/`focus` pada browser desktop non-native.
 */
export function harusPantauBlurWindow(params: {
    adaNative: boolean
    isTauri?: boolean
    jenisPerangkat: JenisPerangkat
}): boolean {
    return !params.adaNative && !params.isTauri && params.jenisPerangkat === 'desktop'
}

export const MIN_KEPERGIAN_MS = 1000
export const TOLERANSI_PERGI_MS = 5000
export const JENDELA_INTIP_CEPAT_MS = 120_000
export const BATAS_INTIP_CEPAT = 3

/**
 * Pantau kepergian singkat (1–5 detik) agar tidak diakali dengan intip cepat berulang.
 * Jika terjadi >= `batas` kali dalam `jendelaMs`, tetap hitung sebagai pelanggaran dan reset.
 */
export function evaluasiKepergianSingkat(
    riwayatMs: number[],
    sekarangMs: number,
    batas = BATAS_INTIP_CEPAT,
    jendelaMs = JENDELA_INTIP_CEPAT_MS,
): { lewatiBatas: boolean; riwayatBaru: number[] } {
    const riwayatBaru = riwayatMs.filter((t) => sekarangMs - t <= jendelaMs)
    riwayatBaru.push(sekarangMs)
    if (riwayatBaru.length >= batas) {
        return { lewatiBatas: true, riwayatBaru: [] }
    }
    return { lewatiBatas: false, riwayatBaru }
}

/**
 * Klasifikasikan kepergian dari layar ujian menjadi:
 * - `layar_mati`: bila terdeteksi dari OS (Android PowerManager / ACTION_SCREEN_OFF) atau
 *   selisih jam dinding jauh lebih besar dari jam monotonik (perangkat suspend/sleep ≥ 2 dtk).
 * - `pindah_tab`: di PWA/browser saat layar tidak mati.
 * - `latar_belakang`: di app native saat layar tidak mati.
 *
 * Kepergian di bawah `minPergiMs` (1 dtk) selalu diabaikan; kepergian non-layar_mati di bawah
 * `toleransiPergiMs` (5 dtk) ditoleransi kecuali `paksaCatatSingkat` aktif (intip cepat berulang).
 */
export function klasifikasiKepergian(params: {
    platform: 'android' | 'ios' | 'pwa'
    layarMatiNative: boolean
    selisihDindingMs: number
    selisihMonotonikMs: number
    minPergiMs?: number
    toleransiPergiMs?: number
    paksaCatatSingkat?: boolean
}): { jenis: JenisPelanggaran; durasiMs: number } | null {
    const durasiMs = Math.round(Math.max(params.selisihMonotonikMs, params.selisihDindingMs))
    if (durasiMs < (params.minPergiMs ?? MIN_KEPERGIAN_MS)) return null

    if (params.layarMatiNative || params.selisihDindingMs - params.selisihMonotonikMs >= 2000) {
        return { jenis: 'layar_mati', durasiMs }
    }

    if (durasiMs < (params.toleransiPergiMs ?? TOLERANSI_PERGI_MS) && !params.paksaCatatSingkat) {
        return null
    }

    return {
        jenis: params.platform === 'pwa' ? 'pindah_tab' : 'latar_belakang',
        durasiMs,
    }
}
