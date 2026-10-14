import type { EntriJawaban, Jawaban, MulaiRespons } from './kontrak'
import type { Penyimpanan } from './penyimpanan'

type Baris = { jawaban: Jawaban; ragu: boolean; seq: number; diakui: number; waktu_klien_ms?: number }

/**
 * Jawaban + antrean kirim (outbox) satu attempt — PRD "offline-first":
 * setiap perubahan ditulis ke penyimpanan lokal DULU, baru dikirim. Tiap soal
 * punya nomor urut (seq) yang naik; server menyimpan seq tertinggi dan
 * mengakui (diakui) seq yang diterima. Entri ber-seq ≤ diakui tidak dikirim lagi.
 */
export class Outbox {
    private cache?: Record<string, Baris>

    constructor(
        private readonly simpan: Penyimpanan,
        private readonly attemptId: number,
    ) {}

    private get kunci() {
        return `attempt:${this.attemptId}:jawaban`
    }

    private async baris(): Promise<Record<string, Baris>> {
        this.cache ??= (await this.simpan.ambil<Record<string, Baris>>(this.kunci)) ?? {}

        return this.cache
    }

    private async tulis(data: Record<string, Baris>) {
        this.cache = data
        await this.simpan.simpan(this.kunci, data)
    }

    /** Muat jawaban yang sudah ada di server (lanjut di perangkat lain). */
    async muatDariServer(tersimpan: MulaiRespons['jawaban_tersimpan']): Promise<void> {
        const data = { ...(await this.baris()) }
        for (const [soalId, s] of Object.entries(tersimpan)) {
            const lokal = data[soalId]
            // Jawaban lokal yang lebih baru (belum terkirim) tetap menang.
            if (!lokal || lokal.seq <= s.seq) {
                data[soalId] = { jawaban: s.jawaban, ragu: s.ragu, seq: s.seq, diakui: s.seq }
            }
        }
        await this.tulis(data)
    }

    async catat(soalId: number, jawaban: Jawaban, ragu: boolean, waktuKlienMs?: number): Promise<number> {
        const data = { ...(await this.baris()) }
        const lama = data[soalId]
        const seq = (lama?.seq ?? 0) + 1
        data[soalId] = { jawaban, ragu, seq, diakui: lama?.diakui ?? 0, waktu_klien_ms: waktuKlienMs }
        await this.tulis(data)

        return seq
    }

    async jawaban(): Promise<Record<string, { jawaban: Jawaban; ragu: boolean }>> {
        const data = await this.baris()

        return Object.fromEntries(Object.entries(data).map(([id, b]) => [id, { jawaban: b.jawaban, ragu: b.ragu }]))
    }

    /** Entri yang belum diakui server, urut nomor soal. */
    async antrean(): Promise<EntriJawaban[]> {
        const data = await this.baris()

        return Object.entries(data)
            .filter(([, b]) => b.seq > b.diakui)
            .map(([id, b]) => ({ soal_id: Number(id), seq: b.seq, jawaban: b.jawaban, ragu: b.ragu, waktu_klien_ms: b.waktu_klien_ms }))
    }

    async akui(diakui: Record<string, number>): Promise<void> {
        const data = { ...(await this.baris()) }
        for (const [id, seq] of Object.entries(diakui)) {
            if (data[id]) data[id] = { ...data[id], diakui: Math.max(data[id].diakui, seq) }
        }
        await this.tulis(data)
    }

    async jumlahTertunda(): Promise<number> {
        return (await this.antrean()).length
    }
}
