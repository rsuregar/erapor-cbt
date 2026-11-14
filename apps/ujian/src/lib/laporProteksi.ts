/**
 * Pelaporan percobaan yang DIBLOKIR oleh proteksi konten (salin, tempel, potong,
 * klik kanan): hanya informasi untuk pengawas, jadi tidak dihitung ke ambang kunci
 * di server (`salin_diblokir`, `klik_kanan`).
 *
 * Murid bisa menekan Ctrl+C atau klik kanan berkali-kali. Kejadian yang sama digabung
 * di sini menjadi SATU entri per jendela dengan `meta.jumlah`, supaya antrean di
 * perangkat dan permintaan ke server tetap kecil. Server menggabungkan lagi
 * (CatatPelanggaran::catatGabungan), jadi penggabungan ini hanya menghemat.
 */

export type JenisInfo = 'salin_diblokir' | 'klik_kanan'

/** Isi `meta` entri; `jumlah` diisi pelapor. Tidak pernah memuat isi yang disalin. */
export type MetaInfo = {
    aksi?: 'copy' | 'cut' | 'paste'
    sumber?: 'papan_ketik' | 'tidak_diketahui'
    diblokir?: boolean
    soal?: number
    jumlah?: number
}

export type KirimInfo = (jenis: JenisInfo, meta: MetaInfo) => void

/** Sama dengan CatatPelanggaran::GABUNG_DETIK di server. */
export const JENDELA_GABUNG_MS = 10_000

/** Jarak maksimum antara Ctrl/Cmd+C/X/V dan event salin agar dianggap lewat papan ketik. */
export const JARAK_PAPAN_KETIK_MS = 1500

/**
 * Asal perintah salin: browser tidak memberi tahu, jadi hanya perkiraan. "papan_ketik"
 * bila pintasan keyboard baru saja ditekan; selain itu tidak diketahui (menu Edit browser,
 * menu tekan-lama di ponsel, dan sebagainya).
 */
export function perkirakanSumber(sekarangMs: number, terakhirPapanKetikMs: number | null): 'papan_ketik' | 'tidak_diketahui' {
    return terakhirPapanKetikMs !== null && sekarangMs - terakhirPapanKetikMs <= JARAK_PAPAN_KETIK_MS ? 'papan_ketik' : 'tidak_diketahui'
}

/** True bila tombol ini pintasan salin/potong/tempel (Ctrl atau Cmd + C/X/V). */
export function pintasanSalin(e: { key: string; ctrlKey: boolean; metaKey: boolean }): boolean {
    return (e.ctrlKey || e.metaKey) && ['c', 'x', 'v'].includes(e.key.toLowerCase())
}

type Tampung = { jenis: JenisInfo; meta: MetaInfo; jumlah: number; timer: ReturnType<typeof setTimeout> }

export function buatPelapor(kirim: KirimInfo, jendelaMs: number = JENDELA_GABUNG_MS) {
    const tampung = new Map<string, Tampung>()

    const kuncinya = (jenis: JenisInfo, meta: MetaInfo) => `${jenis}:${meta.aksi ?? ''}`

    const siramSatu = (kunci: string) => {
        const t = tampung.get(kunci)
        if (!t) return
        clearTimeout(t.timer)
        tampung.delete(kunci)
        kirim(t.jenis, { ...t.meta, jumlah: t.jumlah })
    }

    return {
        /** Satu kejadian. Meta kejadian pertama dalam jendela dipertahankan. */
        lapor(jenis: JenisInfo, meta: MetaInfo = {}) {
            const kunci = kuncinya(jenis, meta)
            const ada = tampung.get(kunci)
            if (ada) {
                ada.jumlah += 1

                return
            }
            tampung.set(kunci, { jenis, meta, jumlah: 1, timer: setTimeout(() => siramSatu(kunci), jendelaMs) })
        },
        /** Kirim semua yang tertahan (mis. saat layar ujian ditutup). */
        siram() {
            for (const kunci of [...tampung.keys()]) siramSatu(kunci)
        },
    }
}
