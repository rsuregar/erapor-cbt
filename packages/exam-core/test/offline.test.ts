import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { JamServer, KlienApi, Outbox, PenyimpananMemori, Penyinkron, type EntriJawaban, type Jawaban } from '../src'

/**
 * Story 6.5 (sisa): "offline 10 menit lalu online — 0 jawaban hilang/dobel".
 * Ujung ke ujung lewat KlienApi + Outbox + Penyinkron asli, dengan jam palsu
 * dan server tiruan yang mengikuti kontrak /sinkron: simpan seq tertinggi per
 * soal, abaikan seq yang lebih kecil, akui seq yang diterima.
 */

const ATTEMPT = 7
const MENIT = 60_000

type Jaringan = 'online' | 'offline' | 'balasan_hilang'

function serverTiruan() {
    const tersimpan = new Map<number, { seq: number; jawaban: Jawaban; ragu: boolean }>()
    /** setiap (soal, seq) yang benar-benar mengubah data server */
    const diterapkan: string[] = []
    const detak: { offline_ms?: number }[] = []
    let jaringan: Jaringan = 'online'

    const fetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
        if (jaringan === 'offline') throw new TypeError('Failed to fetch')
        expect(String(url)).toBe(`http://erapor.test/api/cbt/attempt/${ATTEMPT}/sinkron`)
        const isi = JSON.parse(String(init?.body)) as { entri: EntriJawaban[]; detak: { offline_ms?: number } }
        detak.push(isi.detak)
        const diakui: Record<string, number> = {}
        for (const e of isi.entri) {
            const lama = tersimpan.get(e.soal_id)
            if (!lama || e.seq > lama.seq) {
                tersimpan.set(e.soal_id, { seq: e.seq, jawaban: e.jawaban, ragu: !!e.ragu })
                diterapkan.push(`${e.soal_id}#${e.seq}`)
            }
            diakui[e.soal_id] = tersimpan.get(e.soal_id)!.seq
        }
        // Server sudah menyimpan, tapi balasannya tidak sampai ke HP.
        if (jaringan === 'balasan_hilang') {
            jaringan = 'online'
            throw new TypeError('Failed to fetch')
        }

        return new Response(
            JSON.stringify({
                diakui,
                waktu_server: new Date().toISOString(),
                berakhir_pada: new Date(Date.now() + 90 * MENIT).toISOString(),
                status: 'mengerjakan',
                pesan_pengawas: null,
                pesan_pada: null,
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
    })

    return {
        fetch,
        tersimpan,
        diterapkan,
        detak,
        atur: (j: Jaringan) => (jaringan = j),
    }
}

/** Satu "app" murid: outbox + penyinkron di atas penyimpanan perangkat. */
function bukaApp(simpan: PenyimpananMemori, server: ReturnType<typeof serverTiruan>) {
    const api = new KlienApi({ baseUrl: 'http://erapor.test/api', ambilToken: () => 't', fetch: server.fetch as typeof fetch })
    const outbox = new Outbox(simpan, ATTEMPT)
    const status = { online: true, tertunda: 0 }
    const penyinkron = new Penyinkron({
        api,
        outbox,
        attemptId: ATTEMPT,
        jam: new JamServer(new Date().toISOString(), () => Date.now()),
        monotonik: () => Date.now(),
        saatStatusKoneksi: (online, tertunda) => Object.assign(status, { online, tertunda }),
    })
    penyinkron.mulai()

    return { outbox, penyinkron, status }
}

describe('offline 10 menit lalu online (story 6.5)', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-10-20T07:30:00+07:00'))
    })
    afterEach(() => vi.useRealTimers())

    it('tidak ada jawaban yang hilang atau diterapkan dua kali', async () => {
        const server = serverTiruan()
        const perangkat = new PenyimpananMemori()
        let app = bukaApp(perangkat, server)

        // Murid menjawab seperti biasa: catat lokal, picu kirim (sama seperti useSesiUjian.jawab).
        const jawab = async (soal: number, isi: Jawaban, ragu = false) => {
            await app.outbox.catat(soal, isi, ragu)
            app.penyinkron.picu()
        }

        // Menit 0–1, online: soal 1–5.
        for (let s = 1; s <= 5; s++) {
            await jawab(s, `o${s}`)
            await vi.advanceTimersByTimeAsync(10_000)
        }
        expect(app.status).toEqual({ online: true, tertunda: 0 })
        expect(server.tersimpan.size).toBe(5)

        // Menit 1–11, offline: soal 6–20 baru, soal 1–3 diganti, ragu dibolak-balik.
        server.atur('offline')
        const mulaiOffline = Date.now()
        let s = 6
        for (let detik = 0; detik < 10 * 60; detik += 30) {
            if (s <= 20) await jawab(s++, `o${s}`)
            if (detik % 120 === 0) await jawab(1 + ((detik / 120) % 3), `ganti-${detik}`, detik % 240 === 0)

            // Menit ke-6: app ditutup paksa lalu dibuka lagi — hanya penyimpanan perangkat yang tersisa.
            if (detik === 5 * 60) {
                app.penyinkron.henti()
                app = bukaApp(perangkat, server)
            }
            await vi.advanceTimersByTimeAsync(30_000)
        }
        expect(Date.now() - mulaiOffline).toBe(10 * MENIT)
        expect(app.status.online).toBe(false)
        expect(server.tersimpan.size).toBe(5) // tidak ada yang lolos selama offline
        const lokal = await app.outbox.jawaban()
        expect(Object.keys(lokal)).toHaveLength(20)
        expect(app.status.tertunda).toBe(await app.outbox.jumlahTertunda())
        expect(app.status.tertunda).toBeGreaterThan(15)

        // Kembali online, tapi balasan kiriman pertama hilang: server menyimpan, HP tidak tahu.
        server.atur('balasan_hilang')
        await vi.advanceTimersByTimeAsync(15_000)
        expect(app.status.online).toBe(false)
        expect(await app.outbox.jumlahTertunda()).toBeGreaterThan(0)

        // Putaran berikutnya: kirim ulang, diakui, antrean kosong.
        await vi.advanceTimersByTimeAsync(15_000)
        expect(app.status).toEqual({ online: true, tertunda: 0 })

        // 0 hilang: isi server = isi perangkat untuk setiap soal.
        expect(server.tersimpan.size).toBe(20)
        for (const [id, j] of Object.entries(lokal)) {
            expect(server.tersimpan.get(Number(id)), `soal ${id}`).toMatchObject({ jawaban: j.jawaban, ragu: j.ragu })
        }
        // 0 dobel: tiap (soal, seq) mengubah server paling banyak sekali, walau dikirim ulang.
        expect(new Set(server.diterapkan).size).toBe(server.diterapkan.length)

        // Lama offline ikut dilaporkan (tidak dihitung pelanggaran oleh server).
        // App dibuka ulang di menit ke-6, jadi instance baru mengukur sejak kiriman gagal pertamanya.
        const offlineMs = server.detak.at(-1)?.offline_ms ?? 0
        expect(offlineMs).toBeGreaterThanOrEqual(4 * MENIT)
        expect(offlineMs).toBeLessThanOrEqual(11 * MENIT)

        app.penyinkron.henti()
    })
})
