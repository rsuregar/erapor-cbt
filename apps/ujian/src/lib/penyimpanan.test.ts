import { PenyimpananMemori, type Penyimpanan } from '@erapor-cbt/exam-core'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as nativeModule from '@/lib/native'
import { PenyimpananApp } from './penyimpanan'

/** SQLite tiruan yang bisa dibuat gagal. */
class SqliteTiruan extends PenyimpananMemori {
    rusak = false
    override async ambil<T>(k: string) {
        if (this.rusak) throw new Error('SQLITE_GAGAL')
        return super.ambil<T>(k)
    }
    override async simpan<T>(k: string, v: T) {
        if (this.rusak) throw new Error('SQLITE_GAGAL')
        return super.simpan(k, v)
    }
}

function buat(platform: 'web' | 'android' | 'desktop') {
    vi.spyOn(nativeModule, 'adaNative').mockReturnValue(platform === 'android')
    vi.spyOn(nativeModule, 'isTauri').mockReturnValue(platform === 'desktop')
    const idb = new PenyimpananMemori()
    const android = new SqliteTiruan()
    const desktop = new SqliteTiruan()
    const app = new PenyimpananApp({ indexedDb: idb, sqliteAndroid: android, sqliteDesktop: desktop })

    return { app, idb, android, desktop }
}

afterEach(() => vi.restoreAllMocks())

describe('PenyimpananApp — app native memakai SQLite, PWA memakai IndexedDB', () => {
    it('PWA/browser: IndexedDB', async () => {
        const { app, idb, android } = buat('web')
        await app.simpan('attempt:1:jawaban', { a: 1 })
        expect(await idb.ambil('attempt:1:jawaban')).toEqual({ a: 1 })
        expect(await android.daftarKunci('')).toEqual([])
        expect(app.status).toMatchObject({ backend: 'indexeddb', cadangan: false })
    })

    it('Android: semua operasi ke SQLite, tidak ada yang masuk IndexedDB', async () => {
        const { app, idb, android } = buat('android')
        await app.simpan('paket:1', { isi: 'x' })
        await app.simpan('attempt:1:jawaban', { a: 1 })
        expect(await app.ambil('paket:1')).toEqual({ isi: 'x' })
        expect(await android.ambil('attempt:1:jawaban')).toEqual({ a: 1 })
        expect(await idb.daftarKunci('')).toEqual([])
        expect(app.status).toMatchObject({ backend: 'sqlite-android', cadangan: false })
    })

    it('Desktop (Tauri): SQLite desktop', async () => {
        const { app, desktop, idb } = buat('desktop')
        await app.simpan('k', 1)
        expect(await desktop.ambil('k')).toBe(1)
        expect(await idb.daftarKunci('')).toEqual([])
        expect(app.status.backend).toBe('sqlite-desktop')
    })

    it('galat SQLite di tengah sesi DITERUSKAN — tidak diam-diam menulis ke IndexedDB (data tidak terbelah)', async () => {
        const { app, idb, android } = buat('android')
        await app.simpan('attempt:1:jawaban', { v: 1 })
        android.rusak = true
        await expect(app.simpan('attempt:1:jawaban', { v: 2 })).rejects.toThrow('SQLITE_GAGAL')
        await expect(app.ambil('attempt:1:jawaban')).rejects.toThrow('SQLITE_GAGAL')
        expect(await idb.daftarKunci('')).toEqual([])
    })

    it('SQLite tak bisa dipakai sejak awal → SELURUH sesi memakai IndexedDB (satu tempat) + status cadangan', async () => {
        const { app, idb, android } = buat('android')
        android.rusak = true
        await app.simpan('attempt:1:jawaban', { v: 1 })
        expect(await app.ambil('attempt:1:jawaban')).toEqual({ v: 1 })
        expect(await idb.ambil('attempt:1:jawaban')).toEqual({ v: 1 })
        expect(app.status).toMatchObject({ backend: 'indexeddb', cadangan: true, galat: 'SQLITE_GAGAL' })
    })

    it('migrasi data versi lama: IndexedDB → SQLite tanpa menimpa data SQLite yang lebih baru, lalu IndexedDB dibersihkan', async () => {
        const { app, idb, android } = buat('android')
        await idb.simpan('attempt:7:jawaban', { lama: true })
        await idb.simpan('paket:3', { isi: 'paket lama' })
        await android.simpan('attempt:7:jawaban', { baru: true })

        expect(await app.ambil('paket:3')).toEqual({ isi: 'paket lama' })
        expect(await app.ambil('attempt:7:jawaban')).toEqual({ baru: true })
        expect(await idb.daftarKunci('')).toEqual([])
        expect(app.status.dimigrasikan).toBe(1)
        // Kunci internal tidak terlihat oleh app.
        expect(await app.daftarKunci('')).toEqual(['attempt:7:jawaban', 'paket:3'])
    })

    it('setelah migrasi pertama, isi IndexedDB (dari sesi cadangan) lebih baru → menimpa SQLite', async () => {
        const idb = new PenyimpananMemori()
        const android = new SqliteTiruan()
        vi.spyOn(nativeModule, 'adaNative').mockReturnValue(true)
        vi.spyOn(nativeModule, 'isTauri').mockReturnValue(false)
        const dari = (b: { indexedDb: Penyimpanan; sqliteAndroid: Penyimpanan }) => new PenyimpananApp(b)

        await dari({ indexedDb: idb, sqliteAndroid: android }).siapkan() // migrasi pertama (kosong)
        await android.simpan('attempt:1:jawaban', { v: 1 })
        await idb.simpan('attempt:1:jawaban', { v: 2 }) // ditulis sesi cadangan

        const app = dari({ indexedDb: idb, sqliteAndroid: android })
        expect(await app.ambil('attempt:1:jawaban')).toEqual({ v: 2 })
        expect(await idb.daftarKunci('')).toEqual([])
    })
})
