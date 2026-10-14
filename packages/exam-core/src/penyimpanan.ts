/**
 * Penyimpanan lokal kunci–nilai. Adapter:
 *  - PenyimpananIndexedDb — PWA (dan fallback di app).
 *  - SQLite native — app Capacitor (di apps/ujian, memakai antarmuka ini),
 *    supaya data ujian tidak dihapus sistem.
 *  - PenyimpananMemori — uji.
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
        return [...this.data.keys()].filter((k) => k.startsWith(awalan))
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
        const semua = await this.jalankan<IDBValidKey[]>('readonly', (s) => s.getAllKeys(IDBKeyRange.bound(awalan, awalan + '￿')))

        return semua.map(String)
    }
}
