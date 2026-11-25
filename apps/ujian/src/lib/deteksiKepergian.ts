import type { JenisPerangkat } from '@/lib/perangkat'
import type { JenisPelanggaran } from '@erapor-cbt/exam-core'

/**
 * `window.blur` di Android/iOS (khususnya WebView/Chrome tablet saat unmount input atau
 * tutup keyboard virtual saat pindah soal) sering menembak meski halaman tetap `visible`.
 * Karena itu, hanya pantau `blur`/`focus` pada browser desktop non-native.
 */
export function harusPantauBlurWindow(params: { adaNative: boolean; jenisPerangkat: JenisPerangkat }): boolean {
    return !params.adaNative && params.jenisPerangkat === 'desktop'
}

/**
 * Klasifikasikan kepergian dari layar ujian menjadi:
 * - `layar_mati`: bila terdeteksi dari OS (Android PowerManager / ACTION_SCREEN_OFF) atau
 *   selisih jam dinding jauh lebih besar dari jam monotonik (perangkat suspend/sleep ≥ 2 dtk).
 * - `pindah_tab`: di PWA/browser saat layar tidak mati.
 * - `latar_belakang`: di app native saat layar tidak mati.
 */
export function klasifikasiKepergian(params: {
    platform: 'android' | 'ios' | 'pwa'
    layarMatiNative: boolean
    selisihDindingMs: number
    selisihMonotonikMs: number
    minPergiMs?: number
}): { jenis: JenisPelanggaran; durasiMs: number } | null {
    const durasiMs = Math.round(Math.max(params.selisihMonotonikMs, params.selisihDindingMs))
    if (durasiMs < (params.minPergiMs ?? 1000)) return null

    if (params.layarMatiNative || params.selisihDindingMs - params.selisihMonotonikMs >= 2000) {
        return { jenis: 'layar_mati', durasiMs }
    }

    return {
        jenis: params.platform === 'pwa' ? 'pindah_tab' : 'latar_belakang',
        durasiMs,
    }
}
