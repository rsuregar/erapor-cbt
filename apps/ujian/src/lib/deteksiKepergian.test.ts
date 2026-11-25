import { describe, expect, it } from 'vitest'
import { harusPantauBlurWindow, klasifikasiKepergian } from './deteksiKepergian'

describe('deteksiKepergian', () => {
    it('menonaktifkan pantauan window.blur pada Android/iOS/native dan mengaktifkannya hanya pada browser desktop', () => {
        expect(harusPantauBlurWindow({ adaNative: true, jenisPerangkat: 'android' })).toBe(false)
        expect(harusPantauBlurWindow({ adaNative: false, jenisPerangkat: 'android' })).toBe(false)
        expect(harusPantauBlurWindow({ adaNative: false, jenisPerangkat: 'ios' })).toBe(false)
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

    it('mengklasifikasikan pindah tab di PWA dan aplikasi ke latar di native saat layar tetap menyala', () => {
        expect(
            klasifikasiKepergian({
                platform: 'pwa',
                layarMatiNative: false,
                selisihDindingMs: 3200,
                selisihMonotonikMs: 3100,
            }),
        ).toEqual({ jenis: 'pindah_tab', durasiMs: 3200 })

        expect(
            klasifikasiKepergian({
                platform: 'android',
                layarMatiNative: false,
                selisihDindingMs: 3200,
                selisihMonotonikMs: 3100,
            }),
        ).toEqual({ jenis: 'latar_belakang', durasiMs: 3200 })
    })
})
