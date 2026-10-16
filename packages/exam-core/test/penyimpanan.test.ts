import { describe, expect, it } from 'vitest'
import {
    PenyimpananMemori,
    PenyimpananSqlite,
    PenyimpananSqliteNative,
    type JembatanKvSqlite,
    type KoneksiSqlite,
    type Penyimpanan,
} from '../src'

/**
 * Driver tiruan SQLite in-memory untuk menguji PenyimpananSqlite
 * tanpa ketergantungan binary native di lingkungan test.
 */
class KoneksiSqliteTiruan implements KoneksiSqlite {
    private readonly tabel = new Map<string, { kunci: string; nilai: string; diperbarui_pada: number }>()
    public ddlTercatat: string[] = []

    async eksekusi(sql: string, params: unknown[] = []): Promise<void> {
        this.ddlTercatat.push(sql)
        const sqlTrim = sql.trim().toUpperCase()

        if (sqlTrim.startsWith('CREATE TABLE') || sqlTrim.startsWith('CREATE INDEX')) {
            return
        }

        if (sqlTrim.startsWith('INSERT OR REPLACE')) {
            const [kunci, nilai, diperbarui] = params as [string, string, number]
            this.tabel.set(kunci, { kunci, nilai, diperbarui_pada: diperbarui })
            return
        }

        if (sqlTrim.startsWith('DELETE FROM')) {
            const [kunci] = params as [string]
            this.tabel.delete(kunci)
            return
        }

        throw new Error(`Kueri SQL tidak didukung dalam tiruan: ${sql}`)
    }

    async ambilSatu<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | undefined> {
        const sqlTrim = sql.trim().toUpperCase()
        if (sqlTrim.startsWith('SELECT NILAI FROM')) {
            const [kunci] = params as [string]
            const entri = this.tabel.get(kunci)
            return entri ? ({ nilai: entri.nilai } as T) : undefined
        }
        throw new Error(`Kueri SQL ambilSatu tidak didukung dalam tiruan: ${sql}`)
    }

    async ambilSemua<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
        const sqlTrim = sql.trim().toUpperCase()
        if (sqlTrim.startsWith('SELECT KUNCI FROM')) {
            const [pola] = params as [string]
            const prefix = (pola as string).replace(/\\([%_\\])/g, '$1').replace(/%$/, '')
            const cocok = [...this.tabel.keys()]
                .filter((k) => k.startsWith(prefix))
                .sort()
                .map((kunci) => ({ kunci } as T))
            return cocok
        }
        throw new Error(`Kueri SQL ambilSemua tidak didukung dalam tiruan: ${sql}`)
    }
}

/**
 * Jembatan tiruan SQLite native (seperti Capacitor bridge)
 */
class JembatanKvSqliteTiruan implements JembatanKvSqlite {
    private readonly map = new Map<string, string>()

    async ambil(kunci: string): Promise<string | undefined> {
        return this.map.get(kunci)
    }

    async simpan(kunci: string, nilaiString: string): Promise<void> {
        this.map.set(kunci, nilaiString)
    }

    async hapus(kunci: string): Promise<void> {
        this.map.delete(kunci)
    }

    async daftarKunci(awalan: string): Promise<string[]> {
        return [...this.map.keys()].filter((k) => k.startsWith(awalan)).sort()
    }
}

/**
 * Rangkaian uji kesetaraan kontrak Penyimpanan:
 * Memastikan implementasi memori, sqlite relasional, dan sqlite native
 * berperilaku 100% identik ("Uji yang sama dijalankan pada kedua implementasi").
 */
function ujiKontrakPenyimpanan(nama: string, pabrik: () => Penyimpanan | Promise<Penyimpanan>) {
    describe(`Kontrak Penyimpanan: ${nama}`, () => {
        it('menyimpan dan mengambil berbagai jenis data secara utuh', async () => {
            const p = await pabrik()

            await p.simpan('teks', 'halo dunia')
            await p.simpan('angka', 12345)
            await p.simpan('boolean', true)
            await p.simpan('objek', { id: 1, nama: 'Matematika', tag: ['ujian', 'pts'] })
            await p.simpan('larik', [10, 20, 30])

            expect(await p.ambil('teks')).toBe('halo dunia')
            expect(await p.ambil('angka')).toBe(12345)
            expect(await p.ambil('boolean')).toBe(true)
            expect(await p.ambil('objek')).toEqual({ id: 1, nama: 'Matematika', tag: ['ujian', 'pts'] })
            expect(await p.ambil('larik')).toEqual([10, 20, 30])
        })

        it('mengembalikan undefined bila kunci tidak ditemukan', async () => {
            const p = await pabrik()
            expect(await p.ambil('kunci_tidak_ada')).toBeUndefined()
        })

        it('menimpa nilai lama bila kunci yang sama disimpan ulang', async () => {
            const p = await pabrik()
            await p.simpan('skor', 80)
            expect(await p.ambil('skor')).toBe(80)

            await p.simpan('skor', 95)
            expect(await p.ambil('skor')).toBe(95)
        })

        it('menghapus kunci dan tidak melempar galat jika kunci tidak ada', async () => {
            const p = await pabrik()
            await p.simpan('sementara', 'akan dihapus')
            expect(await p.ambil('sementara')).toBe('akan dihapus')

            await p.hapus('sementara')
            expect(await p.ambil('sementara')).toBeUndefined()

            // Menghapus kunci yang sudah tidak ada tidak boleh melempar galat
            await expect(p.hapus('sementara')).resolves.not.toThrow()
        })

        it('mendaftar kunci dengan filter awalan (prefix) yang tepat', async () => {
            const p = await pabrik()
            await p.simpan('attempt:1:sesi', { attempt_id: 1 })
            await p.simpan('attempt:1:kumpul', true)
            await p.simpan('attempt:2:sesi', { attempt_id: 2 })
            await p.simpan('paket:101', { versi: 'v1' })
            await p.simpan('paket:102', { versi: 'v2' })
            await p.simpan('daftar-ujian:user-1', [1, 2])

            const attempt1 = await p.daftarKunci('attempt:1:')
            expect(attempt1).toEqual(['attempt:1:kumpul', 'attempt:1:sesi'])

            const semuaPaket = await p.daftarKunci('paket:')
            expect(semuaPaket).toEqual(['paket:101', 'paket:102'])

            const semua = await p.daftarKunci('')
            expect(semua.length).toBe(6)

            const tidakAda = await p.daftarKunci('tidak_cocok:')
            expect(tidakAda).toEqual([])
        })
    })
}

// 1. Uji PenyimpananMemori
ujiKontrakPenyimpanan('PenyimpananMemori', () => new PenyimpananMemori())

// 2. Uji PenyimpananSqlite
ujiKontrakPenyimpanan('PenyimpananSqlite', () => new PenyimpananSqlite(new KoneksiSqliteTiruan()))

// 3. Uji PenyimpananSqliteNative
ujiKontrakPenyimpanan('PenyimpananSqliteNative', () => new PenyimpananSqliteNative(new JembatanKvSqliteTiruan()))

describe('PenyimpananSqlite Khusus', () => {
    it('menginisialisasi tabel dan index saat pertama kali digunakan', async () => {
        const koneksi = new KoneksiSqliteTiruan()
        const sqlite = new PenyimpananSqlite(koneksi, 'tabel_kustom')

        await sqlite.simpan('tes', 1)
        expect(koneksi.ddlTercatat.some((s) => s.includes('CREATE TABLE IF NOT EXISTS tabel_kustom'))).toBe(true)
        expect(koneksi.ddlTercatat.some((s) => s.includes('CREATE INDEX IF NOT EXISTS idx_tabel_kustom_kunci'))).toBe(true)
    })

    it('mengembalikan undefined jika data di SQLite korup / JSON tidak valid', async () => {
        const koneksi = new KoneksiSqliteTiruan()
        // Masukkan data mentah non-JSON langsung ke tabel tiruan
        await koneksi.eksekusi('INSERT OR REPLACE INTO erapor_cbt_kv (kunci, nilai, diperbarui_pada) VALUES (?, ?, ?)', [
            'korup',
            '{bukan-json-valid:',
            Date.now(),
        ])

        const sqlite = new PenyimpananSqlite(koneksi)
        expect(await sqlite.ambil('korup')).toBeUndefined()
    })
})
