import {
    PenyimpananIndexedDb,
    PenyimpananSqliteNative,
    type Penyimpanan,
} from '@erapor-cbt/exam-core'
import { adaNative, isTauri, jembatanSqliteNative, jembatanSqliteTauri } from '@/lib/native'

/**
 * Penyimpanan lokal app CBT Al Akhyar (story 7.7):
 * - Android (Capacitor)        → SQLite native (erapor_cbt.db, UjianNativePlugin.java)
 * - Desktop Windows/macOS (Tauri) → SQLite native (erapor_cbt.db, rusqlite di src-tauri)
 * - PWA / browser              → IndexedDB
 *
 * Aturannya: SATU backend per sesi app. App native memakai SQLite secara
 * eksklusif — tidak ada lagi "jatuh ke IndexedDB per panggilan", yang dulu bisa
 * membelah data jawaban di dua tempat (tulisan gagal masuk IndexedDB, bacaan
 * berikutnya dari SQLite mengembalikan versi lama).
 *
 * `siapkan()` (sekali, otomatis pada operasi pertama):
 * 1. Uji SQLite: tulis → baca → hapus. Gagal = seluruh sesi memakai IndexedDB
 *    sebagai cadangan (status.cadangan, tampil di cek kesiapan) — tetap satu
 *    tempat, jadi tidak ada data terbelah.
 * 2. Migrasi IndexedDB → SQLite: data dari versi app lama (sebelum SQLite) atau
 *    dari sesi cadangan dipindahkan, lalu dihapus dari IndexedDB.
 */

export type BackendPenyimpanan = 'sqlite-android' | 'sqlite-desktop' | 'indexeddb'

export type StatusPenyimpanan = {
    backend: BackendPenyimpanan
    /** App native yang terpaksa memakai IndexedDB karena SQLite tidak bisa dipakai. */
    cadangan: boolean
    galat: string | null
    /** Jumlah kunci yang dipindahkan dari IndexedDB ke SQLite saat app dibuka. */
    dimigrasikan: number
}

/** Penanda migrasi data versi lama (sebelum SQLite) sudah dilakukan — disimpan di SQLite. */
const PENANDA_MIGRASI = '__migrasi-indexeddb-v1'
const KUNCI_UJI = '__uji-sqlite'

type Backend = {
    indexedDb?: Penyimpanan
    sqliteAndroid?: Penyimpanan
    sqliteDesktop?: Penyimpanan
}

export class PenyimpananApp implements Penyimpanan {
    public readonly indexedDb: Penyimpanan
    public readonly sqliteAndroid: Penyimpanan
    public readonly sqliteDesktop: Penyimpanan
    public status: StatusPenyimpanan = { backend: 'indexeddb', cadangan: false, galat: null, dimigrasikan: 0 }
    private siap?: Promise<Penyimpanan>

    constructor(backend: Backend = {}) {
        this.indexedDb = backend.indexedDb ?? new PenyimpananIndexedDb('erapor-cbt-ujian')
        this.sqliteAndroid = backend.sqliteAndroid ?? new PenyimpananSqliteNative(jembatanSqliteNative)
        this.sqliteDesktop = backend.sqliteDesktop ?? new PenyimpananSqliteNative(jembatanSqliteTauri)
    }

    /** Backend yang SEHARUSNYA dipakai platform ini (sebelum uji). */
    public pilih(): Penyimpanan {
        if (adaNative()) return this.sqliteAndroid
        if (isTauri()) return this.sqliteDesktop
        return this.indexedDb
    }

    /** Uji + migrasi sekali per sesi; hasilnya backend tunggal untuk semua operasi. */
    public siapkan(): Promise<Penyimpanan> {
        this.siap ??= this.pasang()

        return this.siap
    }

    private async pasang(): Promise<Penyimpanan> {
        const target = this.pilih()
        if (target === this.indexedDb) {
            this.status = { backend: 'indexeddb', cadangan: false, galat: null, dimigrasikan: 0 }

            return this.indexedDb
        }
        const backend: BackendPenyimpanan = target === this.sqliteAndroid ? 'sqlite-android' : 'sqlite-desktop'
        try {
            const tanda = `${Date.now()}`
            await target.simpan(KUNCI_UJI, tanda)
            if ((await target.ambil<string>(KUNCI_UJI)) !== tanda) throw new Error('SQLite tidak mengembalikan data yang baru ditulis.')
            await target.hapus(KUNCI_UJI)
            const dimigrasikan = await this.migrasi(target)
            this.status = { backend, cadangan: false, galat: null, dimigrasikan }

            return target
        } catch (e) {
            const galat = e instanceof Error ? e.message : String(e)
            console.error(`[penyimpanan] SQLite (${backend}) tidak bisa dipakai; sesi ini memakai IndexedDB:`, galat)
            this.status = { backend: 'indexeddb', cadangan: true, galat, dimigrasikan: 0 }

            return this.indexedDb
        }
    }

    /**
     * Pindahkan isi IndexedDB ke SQLite lalu hapus dari IndexedDB.
     * - Pertama kali (data versi app lama): JANGAN menimpa kunci yang sudah ada di
     *   SQLite — bisa jadi lebih baru dari salinan lama.
     * - Sesudahnya: isi IndexedDB hanya bisa berasal dari sesi cadangan, yang
     *   lebih baru dari SQLite → timpa.
     */
    private async migrasi(sqlite: Penyimpanan): Promise<number> {
        let kunci: string[]
        try {
            kunci = (await this.indexedDb.daftarKunci('')).filter((k) => !k.startsWith('__'))
        } catch {
            return 0 // IndexedDB tidak tersedia / kosong: tidak ada yang dipindahkan.
        }
        const sudahPernah = (await sqlite.ambil<boolean>(PENANDA_MIGRASI)) === true
        let jumlah = 0
        for (const k of kunci) {
            const nilai = await this.indexedDb.ambil(k)
            if (nilai !== undefined && (sudahPernah || (await sqlite.ambil(k)) === undefined)) {
                await sqlite.simpan(k, nilai)
                jumlah++
            }
            await this.indexedDb.hapus(k)
        }
        if (!sudahPernah) await sqlite.simpan(PENANDA_MIGRASI, true)

        return jumlah
    }

    async ambil<T>(kunci: string): Promise<T | undefined> {
        return (await this.siapkan()).ambil<T>(kunci)
    }

    async simpan<T>(kunci: string, nilai: T): Promise<void> {
        await (await this.siapkan()).simpan(kunci, nilai)
    }

    async hapus(kunci: string): Promise<void> {
        await (await this.siapkan()).hapus(kunci)
    }

    async daftarKunci(awalan: string): Promise<string[]> {
        // Kunci internal (__…) tidak pernah terlihat oleh app.
        return (await (await this.siapkan()).daftarKunci(awalan)).filter((k) => !k.startsWith('__'))
    }
}

export const penyimpanan = new PenyimpananApp()
