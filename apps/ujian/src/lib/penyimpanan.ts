import {
    PenyimpananIndexedDb,
    PenyimpananSqliteNative,
    type Penyimpanan,
} from '@erapor-cbt/exam-core'
import { adaNative, jembatanSqliteNative } from '@/lib/native'

/**
 * Adapter penyimpanan lokal untuk aplikasi CBT Al Akhyar (Story 7.7):
 * - Pada Android native (Capacitor): menggunakan PenyimpananSqliteNative
 *   yang tersimpan langsung di SQLite database internal Android (erapor_cbt.db),
 *   sehingga tidak pernah dihapus oleh OS saat memori menipis.
 * - Pada Web PWA & Desktop Exam Browser: menggunakan PenyimpananIndexedDb
 *   yang handal dan cepat di browser.
 * - Jika panggilan SQLite native gagal untuk alasan apapun, fallback
 *   otomatis ke PenyimpananIndexedDb.
 */
export class PenyimpananApp implements Penyimpanan {
    public readonly indexedDb = new PenyimpananIndexedDb('erapor-cbt-ujian')
    public readonly sqlite = new PenyimpananSqliteNative(jembatanSqliteNative)

    public pilih(): Penyimpanan {
        return adaNative() ? this.sqlite : this.indexedDb
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
