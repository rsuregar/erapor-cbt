import type { Jawaban } from '@erapor-cbt/exam-core'

type Nilai = { isi: Jawaban; ragu: boolean; ms?: number }

export type OpsiPenulis = {
    /** Tulis satu jawaban ke penyimpanan lokal (Outbox.catat). */
    catat: (soalId: number, isi: Jawaban, ragu: boolean, ms?: number) => Promise<unknown>
    /** Dipanggil setelah tulisan berhasil (picu sinkron). */
    setelahTulis?: () => void
    /** Jumlah jawaban yang gagal disimpan berubah (0 = semua aman). */
    saatGagalBerubah?: (jumlah: number) => void
    /** Jeda tulis untuk teks (isian/uraian): tiap ketukan tidak perlu ditulis. */
    jedaTeksMs?: number
    /** Jeda coba ulang tulisan yang gagal. */
    jedaUlangMs?: number
    setTimeout?: typeof setTimeout
    clearTimeout?: typeof clearTimeout
}

/**
 * Antrean tulis jawaban ke penyimpanan lokal, supaya jawaban yang tampil di layar
 * tidak pernah hilang diam-diam:
 * - Teks ditunda sebentar, tapi `tulisSemua()` memaksa semuanya tertulis (dipanggil saat
 *   app ke latar, halaman ditutup, layar ujian ditutup, dan sebelum kumpul).
 * - Tulisan yang gagal (penyimpanan penuh, SQLite galat) dicatat, dilaporkan, dan dicoba
 *   ulang terus. Tiap soal punya nomor versi: hasil tulisan lama yang selesai belakangan
 *   tidak pernah menimpa status jawaban yang lebih baru.
 */
export class PenulisJawaban {
    private readonly tertunda = new Map<number, { nilai: Nilai; versi: number; timer: ReturnType<typeof setTimeout> }>()
    private readonly gagal = new Map<number, { nilai: Nilai; versi: number }>()
    private readonly versi = new Map<number, number>()
    private timerUlang?: ReturnType<typeof setTimeout>
    private dilaporkan = 0
    private aktif = true
    private readonly st: typeof setTimeout
    private readonly ct: typeof clearTimeout

    constructor(private readonly o: OpsiPenulis) {
        this.st = o.setTimeout ?? globalThis.setTimeout.bind(globalThis)
        this.ct = o.clearTimeout ?? globalThis.clearTimeout.bind(globalThis)
    }

    get jumlahGagal(): number {
        return this.gagal.size
    }

    /** Catat jawaban terbaru satu soal; teks ditunda, selain itu langsung ditulis. */
    catat(soalId: number, isi: Jawaban, ragu: boolean, ms: number | undefined, opsi: { teks?: boolean } = {}): void {
        const versi = (this.versi.get(soalId) ?? 0) + 1
        this.versi.set(soalId, versi)
        const nilai = { isi, ragu, ms }
        this.batalTunda(soalId)
        if (opsi.teks) {
            const timer = this.st(() => {
                this.tertunda.delete(soalId)
                void this.tulis(soalId, nilai, versi)
            }, this.o.jedaTeksMs ?? 700)
            this.tertunda.set(soalId, { nilai, versi, timer })
        } else {
            void this.tulis(soalId, nilai, versi)
        }
    }

    /** Tulis semua yang masih ditunda + coba ulang yang gagal; kembalikan jumlah yang masih gagal. */
    async tulisSemua(): Promise<number> {
        const tugas: Promise<void>[] = []
        for (const [soalId, t] of this.tertunda) {
            this.ct(t.timer)
            tugas.push(this.tulis(soalId, t.nilai, t.versi))
        }
        this.tertunda.clear()
        for (const [soalId, g] of [...this.gagal]) tugas.push(this.tulis(soalId, g.nilai, g.versi))
        await Promise.all(tugas)

        return this.gagal.size
    }

    /** Hentikan coba ulang otomatis; jawaban yang masih ditunda tetap ditulis. */
    henti(): Promise<number> {
        this.aktif = false
        if (this.timerUlang) this.ct(this.timerUlang)

        return this.tulisSemua()
    }

    /** Attempt sudah selesai & data lokal dibersihkan: buang semua tanpa menulis (agar tidak muncul lagi). */
    buang(): void {
        this.aktif = false
        if (this.timerUlang) this.ct(this.timerUlang)
        for (const t of this.tertunda.values()) this.ct(t.timer)
        this.tertunda.clear()
        this.gagal.clear()
        this.versi.clear()
    }

    private batalTunda(soalId: number) {
        const lama = this.tertunda.get(soalId)
        if (lama) this.ct(lama.timer)
        this.tertunda.delete(soalId)
    }

    private async tulis(soalId: number, nilai: Nilai, versi: number): Promise<void> {
        if (!this.aktif && !this.versi.has(soalId)) return
        try {
            await this.o.catat(soalId, nilai.isi, nilai.ragu, nilai.ms)
            // Hanya membersihkan galat versi ini atau lebih lama; galat versi lebih baru tetap.
            const g = this.gagal.get(soalId)
            if (g && g.versi <= versi) this.gagal.delete(soalId)
            this.o.setelahTulis?.()
        } catch {
            // Versi yang lebih baru sudah menggantikan (tertunda / ditulis): galat lama tidak relevan.
            if (versi === this.versi.get(soalId) && !this.tertunda.has(soalId)) this.gagal.set(soalId, { nilai, versi })
            this.jadwalUlang()
        }
        if (this.gagal.size !== this.dilaporkan) {
            this.dilaporkan = this.gagal.size
            this.o.saatGagalBerubah?.(this.dilaporkan)
        }
    }

    private jadwalUlang() {
        if (!this.aktif || this.timerUlang || this.gagal.size === 0) return
        this.timerUlang = this.st(() => {
            this.timerUlang = undefined
            void this.tulisSemua().then((n) => n > 0 && this.jadwalUlang())
        }, this.o.jedaUlangMs ?? 3000)
    }
}
