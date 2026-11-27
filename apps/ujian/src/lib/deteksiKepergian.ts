import type { JenisPerangkat } from '@/lib/perangkat'
import type { JenisPelanggaran } from '@erapor-cbt/exam-core'

/**
 * `window.blur` di Android (khususnya WebView/Chrome tablet saat unmount input atau
 * tutup keyboard virtual saat pindah soal) sering menembak meski halaman tetap `visible`.
 * Di Tauri Exam Browser, pemantauan fokus memakai event fokus jendela OS (`onFocusChanged`)
 * alih-alih DOM `window.blur` agar popup/dialog internal WebView2 tidak memicu false positive.
 * Di iOS/iPadOS PWA, Slide Over, Floating Menu (`...`), Control Center, dan jendela mengambang
 * menjaga `visibilityState === 'visible'` — satu-satunya sinyal adalah `window.blur` / `hasFocus()`,
 * sehingga iOS PWA ikut dipantau dengan konfirmasi singkat (`KONFIRMASI_BLUR_IOS_MS`).
 */
export function harusPantauBlurWindow(params: {
    adaNative: boolean
    isTauri?: boolean
    jenisPerangkat: JenisPerangkat
}): boolean {
    return !params.adaNative && !params.isTauri && (params.jenisPerangkat === 'desktop' || params.jenisPerangkat === 'ios')
}

export const KONFIRMASI_BLUR_IOS_MS = 250
export const INTERVAL_CEK_FOKUS_IOS_MS = 500
export const AMBANG_JEDA_FRAME_IOS_MS = 1200
export const DEBOUNCE_LAYAR_DIBAGI_MS = 300

export function harusKonfirmasiBlur(jenisPerangkat: JenisPerangkat): boolean {
    return jenisPerangkat === 'ios'
}

export function harusPantauLayarDibagi(params: {
    isTauri?: boolean
    jenisPerangkat: JenisPerangkat
}): boolean {
    return !params.isTauri && params.jenisPerangkat !== 'desktop'
}

export function harusCatatLayarDibagi(params: {
    layarDibagiAktif: boolean
    terlihat: boolean
}): boolean {
    return params.layarDibagiAktif && params.terlihat
}

/**
 * Catat `keluar_layar_penuh` hanya bila layar masih tidak fullscreen setelah masa tenggang
 * dan murid memang berada di jendela ujian (bukan sedang pindah tab / blur yang sudah dipantau terpisah).
 */
export function harusCatatKeluarLayarPenuh(params: {
    layarPenuhAktif: boolean
    terlihat: boolean
    sedangPergi: boolean
    punyaFokus: boolean
}): boolean {
    return !params.layarPenuhAktif && params.terlihat && !params.sedangPergi && params.punyaFokus
}

/** Jangan laporkan `muat_ulang` bila reload dipicu pembersihan internal aplikasi (mis. SW lama). */
export function harusCatatMuatUlang(params: {
    pernahDibukaDiTab: boolean
    reloadInternal: boolean
}): boolean {
    return params.pernahDibukaDiTab && !params.reloadInternal
}

export const MIN_KEPERGIAN_MS = 1000
export const MIN_INTIP_TERSEMBUNYI_MS = 400
export const TOLERANSI_PERGI_MS = 5000
export const TOLERANSI_LAYAR_DIBAGI_MS = 2000
export const JENDELA_INTIP_CEPAT_MS = 120_000
export const BATAS_INTIP_CEPAT = 3

/**
 * Di iOS/iPadOS WebKit PWA, proses dibekukan saat App Switcher / latar belakang meski layar tetap menyala,
 * sehingga selisih jam dinding vs monotonik tidak dapat dipakai untuk menebak `layar_mati`.
 */
export function bolehDeteksiLayarMatiDariJam(jenisPerangkat?: JenisPerangkat): boolean {
    return jenisPerangkat !== 'ios'
}

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
    jenisPerangkat?: JenisPerangkat
    layarMatiNative: boolean
    selisihDindingMs: number
    selisihMonotonikMs: number
    minPergiMs?: number
    toleransiPergiMs?: number
    paksaCatatSingkat?: boolean
}): { jenis: JenisPelanggaran; durasiMs: number } | null {
    const durasiMs = Math.round(Math.max(params.selisihMonotonikMs, params.selisihDindingMs))
    if (durasiMs < (params.minPergiMs ?? MIN_KEPERGIAN_MS)) return null

    if (
        params.layarMatiNative ||
        (bolehDeteksiLayarMatiDariJam(params.jenisPerangkat) &&
            params.selisihDindingMs - params.selisihMonotonikMs >= 2000)
    ) {
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
