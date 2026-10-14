import { api } from '@/lib/api'
import { sesi as akun } from '@/lib/sesi'
import { dekripsiPaket, GalatApi, PenyimpananIndexedDb, type IsiPaket, type MulaiRespons, type PaketTerenkripsi, type UjianRingkas } from '@erapor-cbt/exam-core'

/**
 * Penyimpanan lokal ujian (IndexedDB; adapter SQLite untuk app menyusul).
 * Paket terenkripsi disimpan saat pra-unduh; kunci dekripsi baru ada
 * setelah /mulai dan dihapus lagi setelah kumpul.
 */
export const penyimpanan = new PenyimpananIndexedDb('erapor-cbt-ujian')

export const CACHE_MEDIA = 'cbt-media'

export type SesiUjian = {
    mulai: MulaiRespons
    ujian: { id: number; nama: string; mapel: string | null; level_keamanan: UjianRingkas['level_keamanan'] }
    /** uuid murid yang memulai — sesi murid lain di perangkat yang sama tidak bisa dibuka */
    pemilik: string | null
    /** selisih jam server − jam perangkat saat /mulai (ms), untuk memulihkan jam setelah muat ulang */
    selisihJam: number
}

export const simpanPaket = (ujianId: number, paket: PaketTerenkripsi) => penyimpanan.simpan(`paket:${ujianId}`, paket)

export const ambilPaket = (ujianId: number) => penyimpanan.ambil<PaketTerenkripsi>(`paket:${ujianId}`)

export async function simpanSesi(sesi: SesiUjian): Promise<void> {
    await penyimpanan.simpan(`attempt:${sesi.mulai.attempt_id}:sesi`, sesi)
}

export async function ambilSesi(attemptId: number): Promise<SesiUjian | null> {
    const s = await penyimpanan.ambil<SesiUjian>(`attempt:${attemptId}:sesi`)

    return s && s.pemilik === akun.uuid() ? s : null
}

/**
 * Ujian yang sudah dimulai di perangkat ini dan belum terkumpul (kunci
 * dibuang setelah kumpul). Dipakai untuk melanjutkan tanpa /mulai saat offline.
 */
export async function sesiLokalUjian(ujianId: number): Promise<SesiUjian | null> {
    for (const k of await penyimpanan.daftarKunci('attempt:')) {
        if (!k.endsWith(':sesi')) continue
        const s = await penyimpanan.ambil<SesiUjian>(k)
        if (s?.ujian.id === ujianId && s.pemilik === akun.uuid()) return s
    }

    return null
}

export type DaftarUjian = { data: UjianRingkas[]; dariCache: boolean; pada: number }

/** GET /ujian dengan cadangan lokal: offline tetap menampilkan daftar terakhir. */
export async function daftarUjian(): Promise<DaftarUjian> {
    try {
        const data = await api.daftarUjian()
        const hasil = { data, dariCache: false, pada: Date.now() }
        await penyimpanan.simpan(`daftar-ujian:${akun.uuid()}`, hasil)

        return hasil
    } catch (e) {
        const tersimpan = e instanceof GalatApi && e.sementara ? await penyimpanan.ambil<DaftarUjian>(`daftar-ujian:${akun.uuid()}`) : null
        if (tersimpan) return { ...tersimpan, dariCache: true }
        throw e
    }
}

/** Sesi + isi paket terdekripsi untuk layar mengerjakan. */
export async function muatUjian(attemptId: number): Promise<{ sesi: SesiUjian; isi: IsiPaket } | null> {
    const sesi = await ambilSesi(attemptId)
    if (!sesi) return null
    const paket = await ambilPaket(sesi.ujian.id)
    if (!paket) return null

    return { sesi, isi: await dekripsiPaket(paket, sesi.mulai.kunci) }
}

/** Setelah kumpul: buang kunci & paket; jawaban sudah di server. */
export async function bersihkan(attemptId: number, ujianId: number): Promise<void> {
    for (const k of await penyimpanan.daftarKunci(`attempt:${attemptId}:`)) await penyimpanan.hapus(k)
    await penyimpanan.hapus(`paket:${ujianId}`)
}

/**
 * Unduh gambar/audio soal ke Cache Storage (dibaca service worker saat
 * offline). Respons lintas origin tanpa CORS disimpan "opaque" — tetap bisa
 * ditampilkan <img>. Kontrak: tombol Mulai baru aktif setelah semua media ada.
 */
export async function unduhMedia(urls: string[], onProgres: (selesai: number, total: number) => void): Promise<void> {
    onProgres(0, urls.length)
    if (urls.length === 0) return
    if (!('caches' in globalThis)) {
        onProgres(urls.length, urls.length)

        return
    }
    const cache = await caches.open(CACHE_MEDIA)
    let selesai = 0
    // Tiga sekaligus: cukup cepat tanpa membanjiri jaringan sekolah.
    const antre = [...urls]
    const pekerja = Array.from({ length: Math.min(3, antre.length) }, async () => {
        for (let url = antre.shift(); url; url = antre.shift()) {
            if (!(await cache.match(url))) {
                const r = await fetch(url, { mode: 'no-cors', cache: 'reload' })
                if (r.type !== 'opaque' && !r.ok) throw new Error(`Gagal mengunduh media (${r.status}).`)
                await cache.put(url, r)
            }
            onProgres(++selesai, urls.length)
        }
    })
    await Promise.all(pekerja)
}
