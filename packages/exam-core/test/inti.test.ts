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
    type Penyimpanan,
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

    it('menserialisasi catat dan akui paralel agar tidak ada jawaban yang tertimpa', async () => {
        const simpanBase = new PenyimpananMemori()
        const simpanLambat: Penyimpanan = {
            ambil: (k) => simpanBase.ambil(k),
            hapus: (k) => simpanBase.hapus(k),
            daftarKunci: (a) => simpanBase.daftarKunci(a),
            simpan: async (k, v) => {
                await new Promise((r) => setTimeout(r, 5))
                return simpanBase.simpan(k, v)
            },
        }
        const o = new Outbox(simpanLambat, 7)
        await o.catat(501, 'a', false)

        await Promise.all([
            o.catat(502, 'b', false),
            o.akui({ 501: 1 }),
            o.catat(503, 'c', true),
        ])

        const j = await o.jawaban()
        expect(j['501']?.jawaban).toBe('a')
        expect(j['502']?.jawaban).toBe('b')
        expect(j['503']).toEqual({ jawaban: 'c', ragu: true })
        expect((await o.antrean()).map((e) => e.soal_id).sort((a, b) => a - b)).toEqual([502, 503])
    })

    it('tidak merusak cache memori ketika penyimpanan gagal menulis', async () => {
        const simpanBase = new PenyimpananMemori()
        let gagal = false
        const simpan: Penyimpanan = {
            ambil: (k) => simpanBase.ambil(k),
            hapus: (k) => simpanBase.hapus(k),
            daftarKunci: (a) => simpanBase.daftarKunci(a),
            simpan: async (k, v) => {
                if (gagal) throw new Error('disk penuh')
                return simpanBase.simpan(k, v)
            },
        }
        const o = new Outbox(simpan, 7)
        await o.catat(501, 'awal', false)

        gagal = true
        await expect(o.catat(502, 'gagal', false)).rejects.toThrow('disk penuh')
        gagal = false

        const j = await o.jawaban()
        expect(j['501']?.jawaban).toBe('awal')
        expect(j['502']).toBeUndefined()
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

    it('tetap berjalan saat perangkat tidur (monotonik berhenti, jam dinding maju)', () => {
        const mono = 1000
        let dinding = 5_000_000
        const jam = new JamServer('2026-10-20T07:30:00+08:00', () => mono, () => dinding)
        dinding += 10 * 60_000 // HP tidur 10 menit sambil offline
        expect(jam.sisaMs('2026-10-20T07:45:00+08:00')).toBe(5 * 60_000)
    })

    it('memundurkan jam perangkat tidak menambah waktu', () => {
        let mono = 1000
        let dinding = 5_000_000
        const jam = new JamServer('2026-10-20T07:30:00+08:00', () => mono, () => dinding)
        mono += 60_000
        dinding -= 60 * 60_000 // murid memundurkan jam 1 jam
        expect(jam.sisaMs('2026-10-20T07:32:00+08:00')).toBe(60_000)
    })

    it('setel dari server menyetel ulang kedua dasar', () => {
        let mono = 0
        let dinding = 0
        const jam = new JamServer('2026-10-20T07:30:00+08:00', () => mono, () => dinding)
        dinding += 5 * 60_000
        jam.setel('2026-10-20T07:31:00+08:00')
        mono += 1000
        expect(jam.sisaMs('2026-10-20T07:32:00+08:00')).toBe(59_000)
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

    it('login mengirim perangkat_id dan info perangkat agar server bisa mengikat sesi', async () => {
        const fetch = vi.fn(async () => new Response(JSON.stringify({ data: { access_token: 't', uuid: 'u', user: {} } }), { status: 200 }))
        const api = new KlienApi({ baseUrl: '/api', ambilToken: () => null, ambilPerangkatId: () => 'device-uuid-123', fetch })
        await api.masuk('514450087', 'rahasia', { platform: 'android' })
        const [, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
        expect(JSON.parse(String(init.body))).toEqual({ email: '514450087', password: 'rahasia', perangkat_id: 'device-uuid-123', perangkat: { platform: 'android' } })
    })

    it('login ditolak SESI_LAIN: galat membawa kode, sesi lokal tidak dihapus', async () => {
        const saatTidakSah = vi.fn()
        const fetch = vi.fn(async () => new Response(JSON.stringify({ message: 'Akun aktif di perangkat lain.', kode: 'SESI_LAIN' }), { status: 409 }))
        const api = new KlienApi({ baseUrl: '/api', ambilToken: () => null, saatTidakSah, fetch })
        await expect(api.masuk('514450087', 'rahasia')).rejects.toMatchObject({ kode: 'SESI_LAIN', status: 409 })
        expect(saatTidakSah).not.toHaveBeenCalled()
    })

    it('401 pada endpoint bertoken (token dicabut, mis. reset sesi pengawas) memanggil saatTidakSah', async () => {
        const saatTidakSah = vi.fn()
        const fetch = vi.fn(async () => new Response(JSON.stringify({ message: 'Unauthenticated.' }), { status: 401 }))
        const api = new KlienApi({ baseUrl: '/api', ambilToken: () => 't', saatTidakSah, fetch })
        await expect(api.daftarUjian()).rejects.toMatchObject({ kode: 'TIDAK_SAH', status: 401 })
        expect(saatTidakSah).toHaveBeenCalledTimes(1)
    })

    it('fetch yang menggantung dibatalkan dan jadi galat JARINGAN (putaran sinkron tidak macet)', async () => {
        vi.useFakeTimers()
        try {
            const fetch = vi.fn((_u: unknown, init?: RequestInit) => {
                const { promise, reject } = Promise.withResolvers<Response>()
                init?.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))

                return promise
            })
            const api = new KlienApi({ baseUrl: '/api', ambilToken: () => 't', fetch: fetch as unknown as typeof globalThis.fetch })
            const hasil = expect(api.sinkron(1, [], {}, 'p')).rejects.toMatchObject({ kode: 'JARINGAN', status: 0, sementara: true })
            await vi.advanceTimersByTimeAsync(20_001)
            await hasil
        } finally {
            vi.useRealTimers()
        }
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

    it('menyertakan perangkat_id pada sinkron, pelanggaran, dan kumpul dari ambilPerangkatId', async () => {
        const fetch = vi.fn(async () => new Response(JSON.stringify({ status: 'ok', diakui: {} }), { status: 200 }))
        const api = new KlienApi({
            baseUrl: '/api',
            ambilToken: () => 't',
            ambilPerangkatId: () => 'device-uuid-123',
            fetch,
        })

        await api.sinkron(10, [{ soal_id: 1, seq: 1, jawaban: 'A' }])
        const [, initSinkron] = fetch.mock.calls[0] as unknown as [string, RequestInit]
        expect(JSON.parse(String(initSinkron.body))).toMatchObject({
            perangkat_id: 'device-uuid-123',
            entri: [{ soal_id: 1, seq: 1, jawaban: 'A' }],
        })

        await api.kumpul(10, 15000)
        const [, initKumpul] = fetch.mock.calls[1] as unknown as [string, RequestInit]
        expect(JSON.parse(String(initKumpul.body))).toMatchObject({
            perangkat_id: 'device-uuid-123',
            waktu_klien_ms: 15000,
        })

        await api.pelanggaran(10, [{ jenis: 'pindah_tab', mulai_ms: 5000 }])
        const [, initPelanggaran] = fetch.mock.calls[2] as unknown as [string, RequestInit]
        const formData = initPelanggaran.body as FormData
        expect(formData.get('perangkat_id')).toBe('device-uuid-123')
    })

    it('menolak respons 200 OK non-JSON (captive portal Wi-Fi) sebagai galat JARINGAN sementara', async () => {
        const fetch = vi.fn(async () => new Response('<html><body>Login Wi-Fi</body></html>', { status: 200, headers: { 'Content-Type': 'text/html' } }))
        const api = new KlienApi({ baseUrl: '/api', ambilToken: () => 't', fetch })
        await expect(api.kumpul(10, 1000)).rejects.toMatchObject({ kode: 'JARINGAN', status: 0, sementara: true })
    })

    it('kirim() bersamaan menunggu kiriman yang sedang berjalan dan mengembalikan responsnya', async () => {
        const o = new Outbox(new PenyimpananMemori(), 7)
        await o.catat(501, 'o2', false)
        const respOk: SinkronRespons = {
            diakui: { 501: 1 },
            waktu_server: '2026-10-20T07:31:00+08:00',
            berakhir_pada: '2026-10-20T09:00:00+08:00',
            status: 'mengerjakan',
            pesan_pengawas: null,
            pesan_pada: null,
        }

        const tunda = Promise.withResolvers<Response>()
        let panggilan = 0
        const fetch = vi.fn(() => {
            panggilan++
            if (panggilan === 1) return tunda.promise
            return Promise.resolve(new Response(JSON.stringify(respOk), { status: 200 }))
        })
        const api = new KlienApi({ baseUrl: '/api', ambilToken: () => 't', fetch })
        const p = new Penyinkron({ api, outbox: o, attemptId: 7, jam: new JamServer('2026-10-20T07:30:00+08:00') })

        const p1 = p.kirim()
        const p2 = p.kirim()
        await vi.waitFor(() => expect(panggilan).toBe(1))

        tunda.resolve(new Response(JSON.stringify(respOk), { status: 200 }))
        const [r1, r2] = await Promise.all([p1, p2])
        expect(r1?.diakui).toEqual({ 501: 1 })
        expect(r2).toEqual(r1)
        p.henti()
    })

    it('kirim() bersamaan menjalankan putaran baru jika ada jawaban baru saat kiriman aktif', async () => {
        const o = new Outbox(new PenyimpananMemori(), 7)
        await o.catat(501, 'o1', false)

        const tunda = Promise.withResolvers<Response>()
        let panggilan = 0
        const fetch = vi.fn((_u: unknown, init?: RequestInit) => {
            panggilan++
            const body = JSON.parse(String(init?.body)) as { entri: { soal_id: number; seq: number }[] }
            const diakui = Object.fromEntries(body.entri.map((e) => [e.soal_id, e.seq]))
            const resp: SinkronRespons = {
                diakui,
                waktu_server: '2026-10-20T07:31:00+08:00',
                berakhir_pada: '2026-10-20T09:00:00+08:00',
                status: 'mengerjakan',
                pesan_pengawas: null,
                pesan_pada: null,
            }
            if (panggilan === 1) return tunda.promise
            return Promise.resolve(new Response(JSON.stringify(resp), { status: 200 }))
        })
        const api = new KlienApi({ baseUrl: '/api', ambilToken: () => 't', fetch })
        const p = new Penyinkron({ api, outbox: o, attemptId: 7, jam: new JamServer('2026-10-20T07:30:00+08:00') })

        const p1 = p.kirim()
        await vi.waitFor(() => expect(panggilan).toBe(1))
        await o.catat(502, 'o2', false)
        const p2 = p.kirim()

        tunda.resolve(
            new Response(
                JSON.stringify({
                    diakui: { 501: 1 },
                    waktu_server: '2026-10-20T07:31:00+08:00',
                    berakhir_pada: '2026-10-20T09:00:00+08:00',
                    status: 'mengerjakan',
                    pesan_pengawas: null,
                    pesan_pada: null,
                } satisfies SinkronRespons),
                { status: 200 },
            ),
        )

        const r2 = await p2
        await p1
        expect(panggilan).toBe(2)
        expect(r2?.diakui).toEqual({ 502: 1 })
        expect(await o.jumlahTertunda()).toBe(0)
        p.henti()
    })
})

