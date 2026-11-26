import { describe, expect, it } from 'vitest'
import { evaluasiKepergianSingkat, harusPantauBlurWindow, klasifikasiKepergian } from './deteksiKepergian'

describe('deteksiKepergian', () => {
    it('menonaktifkan pantauan window.blur pada Android/iOS/Tauri dan mengaktifkannya hanya pada browser desktop non-native', () => {
        expect(harusPantauBlurWindow({ adaNative: true, jenisPerangkat: 'android' })).toBe(false)
        expect(harusPantauBlurWindow({ adaNative: false, jenisPerangkat: 'android' })).toBe(false)
        expect(harusPantauBlurWindow({ adaNative: false, jenisPerangkat: 'ios' })).toBe(false)
        expect(harusPantauBlurWindow({ adaNative: false, isTauri: true, jenisPerangkat: 'desktop' })).toBe(false)
        expect(harusPantauBlurWindow({ adaNative: false, isTauri: false, jenisPerangkat: 'desktop' })).toBe(true)
        expect(harusPantauBlurWindow({ adaNative: false, jenisPerangkat: 'desktop' })).toBe(true)
    })

    it('mengabaikan kepergian sangat singkat di bawah MIN_PERGI_MS', () => {
        expect(
            klasifikasiKepergian({
                platform: 'pwa',
                layarMatiNative: false,
                selisihDindingMs: 500,
                selisihMonotonikMs: 500,
            }),
        ).toBeNull()
    })

    it('mengklasifikasikan layar mati dari Android native sebagai layar_mati', () => {
        expect(
            klasifikasiKepergian({
                platform: 'android',
                layarMatiNative: true,
                selisihDindingMs: 4200,
                selisihMonotonikMs: 4200,
            }),
        ).toEqual({ jenis: 'layar_mati', durasiMs: 4200 })
    })

    it('mengklasifikasikan perangkat sleep/suspend di PWA atau desktop sebagai layar_mati lewat selisih jam dinding vs monotonik', () => {
        expect(
            klasifikasiKepergian({
                platform: 'pwa',
                layarMatiNative: false,
                selisihDindingMs: 25_000,
                selisihMonotonikMs: 1200,
            }),
        ).toEqual({ jenis: 'layar_mati', durasiMs: 25_000 })
    })

    it('mentoleransi kepergian singkat 1–4.9 detik (mis. notifikasi / salah klik), kecuali paksaCatatSingkat', () => {
        expect(
            klasifikasiKepergian({
                platform: 'pwa',
                layarMatiNative: false,
                selisihDindingMs: 3200,
                selisihMonotonikMs: 3100,
            }),
        ).toBeNull()

        expect(
            klasifikasiKepergian({
                platform: 'pwa',
                layarMatiNative: false,
                selisihDindingMs: 3200,
                selisihMonotonikMs: 3100,
                paksaCatatSingkat: true,
            }),
        ).toEqual({ jenis: 'pindah_tab', durasiMs: 3200 })
    })

    it('mengklasifikasikan pindah tab di PWA dan aplikasi ke latar di native saat melewati toleransi (>= 5 detik)', () => {
        expect(
            klasifikasiKepergian({
                platform: 'pwa',
                layarMatiNative: false,
                selisihDindingMs: 5500,
                selisihMonotonikMs: 5400,
            }),
        ).toEqual({ jenis: 'pindah_tab', durasiMs: 5500 })

        expect(
            klasifikasiKepergian({
                platform: 'android',
                layarMatiNative: false,
                selisihDindingMs: 5500,
                selisihMonotonikMs: 5400,
            }),
        ).toEqual({ jenis: 'latar_belakang', durasiMs: 5500 })
    })

    it('evaluasiKepergianSingkat menghitung intip cepat berulang dalam jendela 2 menit dan kedaluwarsa di luar jendela', () => {
        const t0 = 1_000_000
        const ev1 = evaluasiKepergianSingkat([], t0)
        expect(ev1).toEqual({ lewatiBatas: false, riwayatBaru: [t0] })

        const ev2 = evaluasiKepergianSingkat(ev1.riwayatBaru, t0 + 30_000)
        expect(ev2).toEqual({ lewatiBatas: false, riwayatBaru: [t0, t0 + 30_000] })

        // Ke-3 dalam 2 menit -> melewati batas & reset riwayat.
        const ev3 = evaluasiKepergianSingkat(ev2.riwayatBaru, t0 + 60_000)
        expect(ev3).toEqual({ lewatiBatas: true, riwayatBaru: [] })

        // Di luar jendela 2 menit -> entri lama kedaluwarsa.
        const evLuar = evaluasiKepergianSingkat([t0, t0 + 10_000], t0 + 150_000)
        expect(evLuar).toEqual({ lewatiBatas: false, riwayatBaru: [t0 + 150_000] })
    })
})
