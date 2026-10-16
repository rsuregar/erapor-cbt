import { describe, expect, it, vi } from 'vitest'
import { PenyimpananApp } from './penyimpanan'
import * as nativeModule from '@/lib/native'

describe('PenyimpananApp (Penyimpanan lokal CBT)', () => {
    it('menggunakan IndexedDB secara default di lingkungan PWA / Web browser', () => {
        vi.spyOn(nativeModule, 'adaNative').mockReturnValue(false)
        const app = new PenyimpananApp()

        const terpilih = app.pilih()
        expect(terpilih).toBe(app.indexedDb)
    })

    it('menggunakan PenyimpananSqliteNative saat berjalan di Android Native (adaNative = true)', () => {
        vi.spyOn(nativeModule, 'adaNative').mockReturnValue(true)
        const app = new PenyimpananApp()

        const terpilih = app.pilih()
        expect(terpilih).toBe(app.sqlite)
    })

    it('fallback ke IndexedDB jika SQLite melempar galat yang tidak terduga', async () => {
        vi.spyOn(nativeModule, 'adaNative').mockReturnValue(true)
        const app = new PenyimpananApp()

        // Mock SQLite melempar galat
        vi.spyOn(app.sqlite, 'ambil').mockRejectedValue(new Error('SQLite locked'))
        vi.spyOn(app.indexedDb, 'ambil').mockResolvedValue('data-dari-indexeddb' as any)

        const hasil = await app.ambil('kunci_tes')
        expect(hasil).toBe('data-dari-indexeddb')
    })
})
