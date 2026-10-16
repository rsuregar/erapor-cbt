import { describe, expect, it, vi } from 'vitest'
import { petunjukIzin } from './lokasi'
import config from '../../capacitor.config'
import { Capacitor } from '@capacitor/core'

describe('Identitas Aplikasi CBT Al Akhyar', () => {
    it('menggunakan appName "CBT Al Akhyar" pada konfigurasi Capacitor', () => {
        expect(config.appName).toBe('CBT Al Akhyar')
        expect(config.appId).toBe('sch.alakhyar.ujian')
    })

    it('menampilkan nama "CBT Al Akhyar" pada petunjuk izin lokasi platform native', () => {
        vi.spyOn(Capacitor, 'getPlatform').mockReturnValue('android')

        const petunjuk = petunjukIzin()
        expect(petunjuk).toContain('CBT Al Akhyar')
        expect(petunjuk).toBe('Buka Setelan → Aplikasi → CBT Al Akhyar → Izin → Lokasi → Izinkan. Pastikan Lokasi (GPS) di panel cepat menyala.')

        vi.restoreAllMocks()
    })
})
