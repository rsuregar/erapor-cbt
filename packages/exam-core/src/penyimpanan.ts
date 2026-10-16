/**
 * Penyimpanan lokal kunci–nilai. Adapter:
 *  - PenyimpananIndexedDb — PWA (dan fallback di app).
 *  - PenyimpananSqlite — SQLite relasional generik (KoneksiSqlite).
 *  - PenyimpananSqliteNative — adapter jembatan native (Capacitor/Android SQLite).
 *  - PenyimpananMemori — uji & pengujian otomatis.
 */
export interface Penyimpanan {
    ambil<T>(kunci: string): Promise<T | undefined>
    simpan<T>(kunci: string, nilai: T): Promise<void>
    hapus(kunci: string): Promise<void>
    daftarKunci(awalan: string): Promise<string[]>
}

export class PenyimpananMemori implements Penyimpanan {
    private readonly data = new Map<string, unknown>()

    async ambil<T>(kunci: string) {
        const nilai = this.data.get(kunci)

        return nilai === undefined ? undefined : (structuredClone(nilai) as T)
    }

    async simpan<T>(kunci: string, nilai: T) {
        this.data.set(kunci, structuredClone(nilai))
    }

    async hapus(kunci: string) {
        this.data.delete(kunci)
    }

    async daftarKunci(awalan: string) {
        return [...this.data.keys()].filter((k) => k.startsWith(awalan)).sort()
    }
}

/** IndexedDB satu object store; tanpa pustaka tambahan. */
export class PenyimpananIndexedDb implements Penyimpanan {
    private db?: Promise<IDBDatabase>

    constructor(
        private readonly namaDb = 'erapor-cbt',
        private readonly store = 'kv',
    ) {}

    private buka(): Promise<IDBDatabase> {
        this.db ??= new Promise((selesai, gagal) => {
            const minta = indexedDB.open(this.namaDb, 1)
            minta.onupgradeneeded = () => minta.result.createObjectStore(this.store)
            minta.onsuccess = () => selesai(minta.result)
            minta.onerror = () => gagal(minta.error)
        })

        return this.db
    }

    private async jalankan<T>(mode: IDBTransactionMode, aksi: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
        const db = await this.buka()

        return new Promise((selesai, gagal) => {
            const tx = db.transaction(this.store, mode)
            const minta = aksi(tx.objectStore(this.store))
            tx.oncomplete = () => selesai(minta.result)
            tx.onerror = () => gagal(tx.error)
            tx.onabort = () => gagal(tx.error)
        })
    }

    ambil<T>(kunci: string) {
        return this.jalankan<T | undefined>('readonly', (s) => s.get(kunci))
    }

    async simpan<T>(kunci: string, nilai: T) {
        await this.jalankan('readwrite', (s) => s.put(nilai, kunci))
    }

    async hapus(kunci: string) {
        await this.jalankan('readwrite', (s) => s.delete(kunci))
    }

    async daftarKunci(awalan: string) {
        const semua = await this.jalankan<IDBValidKey[]>('readonly', (s) => s.getAllKeys(IDBKeyRange.bound(awalan, awalan + '\uffff')))

        return semua.map(String)
    }
}

/**
 * Antarmuka eksekutor SQL generik untuk SQLite.
 * Dapat diimplementasikan oleh driver SQLite seperti:
 *  - better-sqlite3 / node:sqlite / bun:sqlite
 *  - @capacitor-community/sqlite
 *  - Tauri SQL plugin (@tauri-apps/plugin-sql)
 *  - wasm-sqlite
 */
export interface KoneksiSqlite {
    eksekusi(sql: string, params?: unknown[]): Promise<void>
    ambilSatu<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>
    ambilSemua<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
}

/**
 * Adapter Penyimpanan berbasis tabel relasional SQLite (kv table).
 * Memenuhi antarmuka Penyimpanan: data diubah ke JSON string saat disimpan,
 * dan di-parse kembali saat diambil.
 */
export class PenyimpananSqlite implements Penyimpanan {
    private inisialisasiPromise?: Promise<void>

    constructor(
        private readonly koneksi: KoneksiSqlite,
        private readonly namaTabel: string = 'erapor_cbt_kv',
    ) {}

    private async inisialisasi(): Promise<void> {
        this.inisialisasiPromise ??= (async () => {
            await this.koneksi.eksekusi(
                `CREATE TABLE IF NOT EXISTS ${this.namaTabel} (` +
                `kunci TEXT PRIMARY KEY NOT NULL, ` +
                `nilai TEXT NOT NULL, ` +
                `diperbarui_pada INTEGER NOT NULL);`
            )
            await this.koneksi.eksekusi(
                `CREATE INDEX IF NOT EXISTS idx_${this.namaTabel}_kunci ON ${this.namaTabel}(kunci);`
            )
        })()

        return this.inisialisasiPromise
    }

    async ambil<T>(kunci: string): Promise<T | undefined> {
        await this.inisialisasi()
        const baris = await this.koneksi.ambilSatu<{ nilai: string }>(
            `SELECT nilai FROM ${this.namaTabel} WHERE kunci = ? LIMIT 1`,
            [kunci]
        )
        if (!baris || baris.nilai === undefined || baris.nilai === null) return undefined
        try {
            return JSON.parse(baris.nilai) as T
        } catch {
            return undefined
        }
    }

    async simpan<T>(kunci: string, nilai: T): Promise<void> {
        await this.inisialisasi()
        const serial = JSON.stringify(nilai)
        const sekarang = Date.now()
        await this.koneksi.eksekusi(
            `INSERT OR REPLACE INTO ${this.namaTabel} (kunci, nilai, diperbarui_pada) VALUES (?, ?, ?)`,
            [kunci, serial, sekarang]
        )
    }

    async hapus(kunci: string): Promise<void> {
        await this.inisialisasi()
        await this.koneksi.eksekusi(
            `DELETE FROM ${this.namaTabel} WHERE kunci = ?`,
            [kunci]
        )
    }

    async daftarKunci(awalan: string): Promise<string[]> {
        await this.inisialisasi()
        const escaped = awalan.replace(/[%_\\]/g, '\\$&')
        const baris = await this.koneksi.ambilSemua<{ kunci: string }>(
            `SELECT kunci FROM ${this.namaTabel} WHERE kunci LIKE ? ESCAPE '\\' ORDER BY kunci ASC`,
            [`${escaped}%`]
        )

        return baris.map((b) => b.kunci)
    }
}

/**
 * Antarmuka jembatan sederhana ke native bridge (misal Capacitor Plugin / Android SQLiteOpenHelper).
 */
export interface JembatanKvSqlite {
    ambil(kunci: string): Promise<string | undefined>
    simpan(kunci: string, nilaiString: string): Promise<void>
    hapus(kunci: string): Promise<void>
    daftarKunci(awalan: string): Promise<string[]>
}

/**
 * Adapter Penyimpanan yang membungkus jembatan native SQLite (Android/iOS plugin).
 */
export class PenyimpananSqliteNative implements Penyimpanan {
    constructor(private readonly jembatan: JembatanKvSqlite) {}

    async ambil<T>(kunci: string): Promise<T | undefined> {
        const raw = await this.jembatan.ambil(kunci)
        if (raw === undefined || raw === null) return undefined
        try {
            return JSON.parse(raw) as T
        } catch {
            return undefined
        }
    }

    async simpan<T>(kunci: string, nilai: T): Promise<void> {
        await this.jembatan.simpan(kunci, JSON.stringify(nilai))
    }

    async hapus(kunci: string): Promise<void> {
        await this.jembatan.hapus(kunci)
    }

    async daftarKunci(awalan: string): Promise<string[]> {
        return this.jembatan.daftarKunci(awalan)
    }
}
