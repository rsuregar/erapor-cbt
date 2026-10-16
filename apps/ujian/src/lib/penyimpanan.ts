import {
    PenyimpananIndexedDb,
    PenyimpananSqliteNative,
    type Penyimpanan,
} from '@erapor-cbt/exam-core'
import { adaNative, isTauri, jembatanSqliteNative, jembatanSqliteTauri } from '@/lib/native'

/**
 * Adapter penyimpanan lokal untuk aplikasi CBT Al Akhyar (Story 7.7):
 * - Pada Android native (Capacitor): menggunakan PenyimpananSqliteNative
 *   yang tersimpan langsung di SQLite database internal Android (erapor_cbt.db).
 * - Pada Desktop Exam Browser (Windows & macOS via Tauri): menggunakan
 *   PenyimpananSqliteNative yang tersimpan di SQLite database internal desktop
 *   (erapor_cbt.db via rusqlite).
 * - Pada Web PWA & browser biasa: menggunakan PenyimpananIndexedDb.
 * - Jika panggilan SQLite native mengalami kendala, otomatis fallback
 *   ke PenyimpananIndexedDb tanpa menghentikan ujian murid.
 */
export class PenyimpananApp implements Penyimpanan {
    public readonly indexedDb = new PenyimpananIndexedDb('erapor-cbt-ujian')
    public readonly sqliteAndroid = new PenyimpananSqliteNative(jembatanSqliteNative)
    public readonly sqliteDesktop = new PenyimpananSqliteNative(jembatanSqliteTauri)

    public pilih(): Penyimpanan {
        if (adaNative()) return this.sqliteAndroid
        if (isTauri()) return this.sqliteDesktop
        return this.indexedDb
    }

    async ambil<T>(kunci: string): Promise<T | undefined> {
        try {
            return await this.pilih().ambil<T>(kunci)
        } catch {
            return await this.indexedDb.ambil<T>(kunci)
        }
    }

    async simpan<T>(kunci: string, nilai: T): Promise<void> {
        try {
            await this.pilih().simpan(kunci, nilai)
        } catch {
            await this.indexedDb.simpan(kunci, nilai)
        }
    }

    async hapus(kunci: string): Promise<void> {
        try {
            await this.pilih().hapus(kunci)
        } catch {
            await this.indexedDb.hapus(kunci)
        }
    }

    async daftarKunci(awalan: string): Promise<string[]> {
        try {
            return await this.pilih().daftarKunci(awalan)
        } catch {
            return await this.indexedDb.daftarKunci(awalan)
        }
    }
}

export const penyimpanan: Penyimpanan = new PenyimpananApp()
