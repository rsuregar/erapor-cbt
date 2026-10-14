import { describe, expect, it, vi } from 'vitest'
import {
    GalatApi,
    JamServer,
    KlienApi,
    Outbox,
    PenyimpananMemori,
    Penyinkron,
    dekripsiPaket,
    keBase64,
    type PaketTerenkripsi,
    type SinkronRespons,
} from '../src'

/** Enkripsi seperti server (PaketMurid::terenkripsi): isi = ciphertext ‖ tag. */
async function paketUji(isi: unknown, aad: string) {
    const kunciMentah = crypto.getRandomValues(new Uint8Array(32))
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const kunci = await crypto.subtle.importKey('raw', kunciMentah, 'AES-GCM', false, ['encrypt'])
    const sandi = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(aad) }, kunci, new TextEncoder().encode(JSON.stringify(isi)))
    const paket: PaketTerenkripsi = { versi: 'sha256:x', algoritma: 'AES-256-GCM', iv: keBase64(iv), aad, isi: keBase64(new Uint8Array(sandi)), media: [] }

    return { paket, kunci: keBase64(kunciMentah) }
}

describe('dekripsiPaket', () => {
    it('membuka paket dengan kunci dari /mulai', async () => {
        const isi = { soal: [{ id: 501, nomor: 1, jenis: 'pilihan_ganda' }], stimulus: {} }
        const { paket, kunci } = await paketUji(isi, 'cbt:12:3:4501')
        expect(await dekripsiPaket(paket, kunci)).toEqual(isi)
    })

    it('menolak paket murid lain (AAD berbeda)', async () => {
        const { paket, kunci } = await paketUji({ soal: [], stimulus: {} }, 'cbt:12:3:4501')
        await expect(dekripsiPaket({ ...paket, aad: 'cbt:12:3:4502' }, kunci)).rejects.toThrow()
    })
})

describe('Outbox', () => {
    it('menaikkan seq per soal dan hanya mengirim yang belum diakui', async () => {
        const simpan = new PenyimpananMemori()
        const o = new Outbox(simpan, 7)
        await o.catat(501, 'o1', false)
        await o.catat(501, 'o2', true)
        await o.catat(502, ['o1', 'o3'], false)

        expect(await o.antrean()).toEqual([
            { soal_id: 501, seq: 2, jawaban: 'o2', ragu: true, waktu_klien_ms: undefined },
            { soal_id: 502, seq: 1, jawaban: ['o1', 'o3'], ragu: false, waktu_klien_ms: undefined },
        ])

        await o.akui({ 501: 2 })
        expect((await o.antrean()).map((e) => e.soal_id)).toEqual([502])

        // Bertahan setelah app dibuka ulang (instance baru, penyimpanan sama).
        const lagi = new Outbox(simpan, 7)
        expect((await lagi.jawaban())['501']).toEqual({ jawaban: 'o2', ragu: true })
        expect(await lagi.jumlahTertunda()).toBe(1)
    })

    it('jawaban server tidak menimpa jawaban lokal yang lebih baru', async () => {
        const o = new Outbox(new PenyimpananMemori(), 7)
        await o.catat(501, 'a', false)
        await o.catat(501, 'b', false)
        await o.muatDariServer({ 501: { jawaban: 'lama', seq: 1, ragu: false }, 502: { jawaban: 'x', seq: 3, ragu: false } })

        const j = await o.jawaban()
        expect(j['501'].jawaban).toBe('b')
        expect(j['502'].jawaban).toBe('x')
        expect((await o.antrean()).map((e) => e.soal_id)).toEqual([501])
    })
})

describe('JamServer', () => {
    it('memakai jam monotonik, bukan jam perangkat', () => {
        let mono = 1000
        const jam = new JamServer('2026-10-20T07:30:00+08:00', () => mono)
        mono += 90_000
        expect(new Date(jam.sekarang()).toISOString()).toBe('2026-10-19T23:31:30.000Z')
        expect(jam.sisaMs('2026-10-20T07:32:00+08:00')).toBe(30_000)
        expect(jam.sisaMs('2026-10-20T07:00:00+08:00')).toBe(0)
    })
})

describe('Penyinkron', () => {
    const respons = (diakui: Record<string, number>): SinkronRespons => ({
        diakui, waktu_server: '2026-10-20T07:31:00+08:00', berakhir_pada: '2026-10-20T09:00:00+08:00',
        status: 'mengerjakan', pesan_pengawas: null, pesan_pada: null,
    })

    it('mengirim antrean, mengakui, dan menyimpan saat offline', async () => {
        const o = new Outbox(new PenyimpananMemori(), 7)
        await o.catat(501, 'o2', false)
        const api = new KlienApi({ baseUrl: 'http://x/api', ambilToken: () => 't' })
        const sinkron = vi.spyOn(api, 'sinkron')
            .mockRejectedValueOnce(new GalatApi('JARINGAN', 'putus', 0))
            .mockImplementation(async (_id, entri) => respons(Object.fromEntries(entri.map((e) => [e.soal_id, e.seq]))))

        let mono = 0
        const status: [boolean, number][] = []
        const p = new Penyinkron({
            api, outbox: o, attemptId: 7, jam: new JamServer('2026-10-20T07:30:00+08:00', () => mono),
            setTimeout: (() => 0) as never, clearTimeout: (() => undefined) as never, monotonik: () => mono,
            saatStatusKoneksi: (on, n) => status.push([on, n]),
        })

        await p.kirim()
        expect(status.at(-1)).toEqual([false, 1])
        expect(await o.jumlahTertunda()).toBe(1)

        mono = 4000
        await p.kirim()
        expect(status.at(-1)).toEqual([true, 0])
        expect(sinkron.mock.calls[1][2]).toMatchObject({ offline_ms: 4000 })
    })

    it('galat aturan (mis. TERKUNCI) diteruskan, bukan dianggap offline', async () => {
        const o = new Outbox(new PenyimpananMemori(), 7)
        const api = new KlienApi({ baseUrl: 'http://x/api', ambilToken: () => 't' })
        vi.spyOn(api, 'sinkron').mockRejectedValue(new GalatApi('TERKUNCI', 'Dikunci', 423))
        const galat: string[] = []
        const p = new Penyinkron({
            api, outbox: o, attemptId: 7, jam: new JamServer('2026-10-20T07:30:00+08:00'),
            setTimeout: (() => 0) as never, clearTimeout: (() => undefined) as never,
            saatGalat: (g) => galat.push(g.kode),
        })
        await p.kirim()
        expect(galat).toEqual(['TERKUNCI'])
    })
})

describe('KlienApi', () => {
    it('meneruskan kode galat server dan token Bearer', async () => {
        const fetch = vi.fn(async () => new Response(JSON.stringify({ message: 'Token salah.', kode: 'TOKEN_SALAH' }), { status: 422 }))
        const api = new KlienApi({ baseUrl: 'https://erapor.test/api/', ambilToken: () => 'abc', fetch })
        await expect(api.mulai(12, 'XXXXXX', 'hp')).rejects.toMatchObject({ kode: 'TOKEN_SALAH', status: 422 })

        const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
        expect(url).toBe('https://erapor.test/api/cbt/ujian/12/mulai')
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer abc')
    })

    it('401 saat login adalah kredensial salah, bukan sesi berakhir', async () => {
        const saatTidakSah = vi.fn()
        const fetch = vi.fn(async () => new Response(JSON.stringify({ status: 'error', message: 'Invalid email/username or password' }), { status: 401 }))
        const api = new KlienApi({ baseUrl: '/api', ambilToken: () => null, saatTidakSah, fetch })
        await expect(api.masuk('514450087', 'salah')).rejects.toMatchObject({ status: 401 })
        expect(saatTidakSah).not.toHaveBeenCalled()
    })

    it('melaporkan progres unduh paket', async () => {
        const badan = JSON.stringify({ versi: 'v', algoritma: 'AES-256-GCM', iv: 'a', aad: 'b', isi: 'c', media: [] })
        const fetch = vi.fn(async () => new Response(badan, { status: 200, headers: { 'Content-Length': String(badan.length) } }))
        const api = new KlienApi({ baseUrl: '/api', ambilToken: () => 't', fetch })
        const progres: [number, number | null][] = []
        const paket = await api.paket(12, (d, t) => progres.push([d, t]))
        expect(paket.versi).toBe('v')
        expect(progres.at(-1)).toEqual([badan.length, badan.length])
    })
})
