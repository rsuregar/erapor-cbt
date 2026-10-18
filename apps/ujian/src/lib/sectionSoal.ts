import type { SoalPaket } from '@erapor-cbt/exam-core'

export type KelompokSection = {
    /** null = soal tanpa bagian */
    section: string | null
    /** nomor soal pertama & terakhir di kelompok (untuk "1–20") */
    nomorAwal: number
    nomorAkhir: number
    /** soal beserta indeksnya di paket (dipakai untuk melompat) */
    butir: { soal: SoalPaket; indeks: number }[]
}

/**
 * Kelompokkan soal berurutan yang ber-section sama. Urutan paket dipertahankan
 * (server mengacak di dalam section, bukan antar section), jadi section yang
 * muncul lagi setelah section lain menjadi kelompok tersendiri.
 */
export function kelompokkanPerSection(daftar: SoalPaket[]): KelompokSection[] {
    const hasil: KelompokSection[] = []
    daftar.forEach((soal, indeks) => {
        const section = soal.section?.trim() || null
        const akhir = hasil.at(-1)
        if (akhir && akhir.section === section) {
            akhir.butir.push({ soal, indeks })
            akhir.nomorAkhir = soal.nomor
        } else {
            hasil.push({ section, nomorAwal: soal.nomor, nomorAkhir: soal.nomor, butir: [{ soal, indeks }] })
        }
    })

    return hasil
}
