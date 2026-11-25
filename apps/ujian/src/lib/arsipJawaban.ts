import { sesi as sesiAkun } from '@/lib/sesi'
import { penyimpanan, type SesiUjian } from '@/lib/ujian'
import type { Jawaban, Penyimpanan, SoalPaket } from '@erapor-cbt/exam-core'

/** Jawaban disimpan di arsip lokal selama 48 jam (2 hari) sebagai bukti 2 sisi. */
export const MASA_SIMPAN_ARSIP_MS = 48 * 60 * 60 * 1000
const AWALAN_ARSIP = 'arsip-jawaban:'

export type ButirArsip = {
    nomor: number
    soalId: number
    jenis: SoalPaket['jenis']
    terjawab: boolean
    ragu: boolean
    ringkasan: string | null
}

export type ArsipJawaban = {
    attemptId: number
    ujianId: number
    namaUjian: string
    mapel: string | null
    pemilik: string | null
    disimpanPada: number
    kadaluarsaPada: number
    totalSoal: number
    jumlahTerjawab: number
    butir: ButirArsip[]
    ditolak: Record<string, string>
}

type DepsArsip = {
    simpan?: Penyimpanan
    pemilik?: string | null
    sekarang?: number
}

function kunciArsip(attemptId: number): string {
    return `${AWALAN_ARSIP}${attemptId}`
}

/**
 * Ringkas jawaban murid di sisi client agar mudah dibandingkan dengan bukti server
 * (hanya nomor & ringkasan jawaban — tidak pernah menyimpan pertanyaan/stimulus/kunci).
 */
export function ringkasJawabanLokal(soal: SoalPaket, jawaban: Jawaban | undefined): { terjawab: boolean; ringkasan: string | null } {
    if (jawaban === null || jawaban === undefined) {
        return { terjawab: false, ringkasan: null }
    }

    if (soal.jenis === 'pilihan_ganda' || soal.jenis === 'pg_stimulus') {
        if (typeof jawaban !== 'string' || jawaban.trim() === '') {
            return { terjawab: false, ringkasan: null }
        }
        const opsi = Array.isArray(soal.opsi) ? (soal.opsi as { id: string }[]) : []
        const idx = opsi.findIndex((o) => o.id === jawaban)
        return {
            terjawab: true,
            ringkasan: idx >= 0 ? String.fromCharCode(65 + idx) : jawaban,
        }
    }

    if (soal.jenis === 'pg_kompleks') {
        if (!Array.isArray(jawaban) || jawaban.length === 0) {
            return { terjawab: false, ringkasan: null }
        }
        const opsi = Array.isArray(soal.opsi) ? (soal.opsi as { id: string }[]) : []
        const huruf = opsi
            .map((o, idx) => (jawaban.includes(o.id) ? String.fromCharCode(65 + idx) : null))
            .filter((x): x is string => x !== null)
        if (huruf.length === 0) {
            return { terjawab: true, ringkasan: [...jawaban].map(String).sort().join(', ') }
        }
        return { terjawab: true, ringkasan: huruf.join(', ') }
    }

    if (soal.jenis === 'benar_salah') {
        if (typeof jawaban !== 'object' || Array.isArray(jawaban)) {
            return { terjawab: false, ringkasan: null }
        }
        const nilai = Object.values(jawaban)
        if (!nilai.some((v) => v !== null && v !== undefined && v !== '')) {
            return { terjawab: false, ringkasan: null }
        }
        const pernyataan = ((soal.opsi as { pernyataan?: { id: string }[] } | null)?.pernyataan ?? [])
        if (pernyataan.length === 0) {
            return { terjawab: true, ringkasan: nilai.map((v) => (v === true ? 'B' : v === false ? 'S' : '—')).join(', ') }
        }
        const kode = pernyataan.map((p) => {
            const v = (jawaban as Record<string, unknown>)[p.id]
            return v === true ? 'B' : v === false ? 'S' : '—'
        })
        return { terjawab: true, ringkasan: kode.join(', ') }
    }

    if (soal.jenis === 'menjodohkan') {
        if (typeof jawaban !== 'object' || Array.isArray(jawaban)) {
            return { terjawab: false, ringkasan: null }
        }
        const terpasang = Object.values(jawaban).filter((v) => typeof v === 'string' && v !== '').length
        if (terpasang === 0) {
            return { terjawab: false, ringkasan: null }
        }
        const total = ((soal.opsi as { kiri?: unknown[] } | null)?.kiri ?? []).length
        return { terjawab: true, ringkasan: `${terpasang}/${total} pasangan` }
    }

    if (typeof jawaban === 'string') {
        const bersih = jawaban.trim()
        if (bersih === '') return { terjawab: false, ringkasan: null }
        return { terjawab: true, ringkasan: bersih }
    }

    return { terjawab: false, ringkasan: null }
}

export function buatArsipDariSesi(params: {
    sesi: SesiUjian
    soal: SoalPaket[]
    jawaban: Record<string, { jawaban: Jawaban; ragu: boolean }>
    ditolak?: Record<string, string>
    sekarang?: number
}): ArsipJawaban {
    const sekarang = params.sekarang ?? Date.now()
    const butir: ButirArsip[] = params.soal.map((s) => {
        const j = params.jawaban[String(s.id)]
        const { terjawab, ringkasan } = ringkasJawabanLokal(s, j?.jawaban)
        return {
            nomor: s.nomor,
            soalId: s.id,
            jenis: s.jenis,
            terjawab,
            ragu: Boolean(j?.ragu),
            ringkasan,
        }
    })

    return {
        attemptId: params.sesi.mulai.attempt_id,
        ujianId: params.sesi.ujian.id,
        namaUjian: params.sesi.ujian.nama,
        mapel: params.sesi.ujian.mapel,
        pemilik: params.sesi.pemilik,
        disimpanPada: sekarang,
        kadaluarsaPada: sekarang + MASA_SIMPAN_ARSIP_MS,
        totalSoal: butir.length,
        jumlahTerjawab: butir.filter((b) => b.terjawab).length,
        butir,
        ditolak: { ...(params.ditolak ?? {}) },
    }
}

export async function simpanArsipJawaban(arsip: ArsipJawaban, simpan: Penyimpanan = penyimpanan): Promise<void> {
    await simpan.simpan(kunciArsip(arsip.attemptId), arsip)
}

export async function ambilArsipJawaban(attemptId: number, deps: DepsArsip = {}): Promise<ArsipJawaban | null> {
    const simpan = deps.simpan ?? penyimpanan
    const pemilik = deps.pemilik !== undefined ? deps.pemilik : sesiAkun.uuid()
    const sekarang = deps.sekarang ?? Date.now()
    const kunci = kunciArsip(attemptId)
    const arsip = await simpan.ambil<ArsipJawaban>(kunci)
    if (!arsip) return null

    if (sekarang > arsip.kadaluarsaPada) {
        await simpan.hapus(kunci)
        return null
    }

    if (arsip.pemilik !== pemilik) return null

    return arsip
}

export async function daftarArsipJawaban(deps: DepsArsip = {}): Promise<ArsipJawaban[]> {
    const simpan = deps.simpan ?? penyimpanan
    const pemilik = deps.pemilik !== undefined ? deps.pemilik : sesiAkun.uuid()
    const sekarang = deps.sekarang ?? Date.now()
    const kunciSemua = await simpan.daftarKunci(AWALAN_ARSIP)
    const hasil: ArsipJawaban[] = []

    for (const k of kunciSemua) {
        const arsip = await simpan.ambil<ArsipJawaban>(k)
        if (!arsip) continue
        if (sekarang > arsip.kadaluarsaPada) {
            await simpan.hapus(k)
            continue
        }
        if (arsip.pemilik === pemilik) hasil.push(arsip)
    }

    return hasil.sort((a, b) => b.disimpanPada - a.disimpanPada)
}

export async function bersihkanArsipKadaluarsa(deps: Omit<DepsArsip, 'pemilik'> = {}): Promise<number> {
    const simpan = deps.simpan ?? penyimpanan
    const sekarang = deps.sekarang ?? Date.now()
    const kunciSemua = await simpan.daftarKunci(AWALAN_ARSIP)
    let terhapus = 0

    for (const k of kunciSemua) {
        const arsip = await simpan.ambil<ArsipJawaban>(k)
        if (!arsip || sekarang > arsip.kadaluarsaPada) {
            await simpan.hapus(k)
            terhapus++
        }
    }

    return terhapus
}
