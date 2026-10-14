import type {
    EntriJawaban,
    EntriPelanggaran,
    Detak,
    HasilRespons,
    KodeGalat,
    MulaiRespons,
    PaketTerenkripsi,
    PelanggaranRespons,
    PerangkatInfo,
    SinkronRespons,
    UjianRingkas,
} from './kontrak'

/** Galat dari server ({ message, kode }) atau jaringan (kode JARINGAN). */
export class GalatApi extends Error {
    constructor(
        public readonly kode: KodeGalat | 'JARINGAN' | 'TIDAK_SAH' | 'TIDAK_DIKENAL',
        message: string,
        public readonly status: number,
        public readonly data: Record<string, unknown> = {},
    ) {
        super(message)
        this.name = 'GalatApi'
    }

    /** Layak dicoba ulang nanti (offline, server sibuk), bukan galat aturan. */
    get sementara(): boolean {
        return this.kode === 'JARINGAN' || this.status === 429 || this.status >= 500
    }
}

export type OpsiKlien = {
    /** mis. https://erapor.alakhyar.sch.id/api */
    baseUrl: string
    ambilToken: () => string | null | Promise<string | null>
    /** dipanggil saat 401 — token kedaluwarsa/dicabut */
    saatTidakSah?: () => void
    fetch?: typeof fetch
}

export type MasukRespons = {
    data: { access_token: string; uuid: string; user: { name?: string; [k: string]: unknown } }
}

/**
 * Klien API murid. Tanpa ketergantungan DOM selain fetch/FormData, supaya
 * sama di PWA, Capacitor, dan Node (uji).
 */
export class KlienApi {
    private readonly fetch: typeof fetch

    constructor(private readonly opsi: OpsiKlien) {
        this.fetch = opsi.fetch ?? globalThis.fetch.bind(globalThis)
    }

    masuk(email: string, password: string): Promise<MasukRespons> {
        return this.minta('POST', '/auth/login', { email, password }, false)
    }

    keluar(): Promise<unknown> {
        return this.minta('POST', '/auth/logout')
    }

    async daftarUjian(): Promise<UjianRingkas[]> {
        return (await this.minta<{ data: UjianRingkas[] }>('GET', '/cbt/ujian')).data
    }

    /** Pra-unduh paket; `onProgres(diterima, total)` — total null bila server tidak memberi Content-Length. */
    paket(ujianId: number, onProgres?: (diterima: number, total: number | null) => void): Promise<PaketTerenkripsi> {
        return this.minta('GET', `/cbt/ujian/${ujianId}/paket`, undefined, true, onProgres)
    }

    mulai(ujianId: number, token: string, perangkatId: string, perangkat?: PerangkatInfo): Promise<MulaiRespons> {
        return this.minta('POST', `/cbt/ujian/${ujianId}/mulai`, { token, perangkat_id: perangkatId, perangkat })
    }

    sinkron(attemptId: number, entri: EntriJawaban[], detak?: Detak): Promise<SinkronRespons> {
        return this.minta('POST', `/cbt/attempt/${attemptId}/sinkron`, { entri, detak })
    }

    pelanggaran(attemptId: number, entri: EntriPelanggaran[], bukti: Record<string, Blob> = {}): Promise<PelanggaranRespons> {
        const form = new FormData()
        form.append('entri', JSON.stringify(entri))
        for (const [nama, berkas] of Object.entries(bukti)) form.append(nama, berkas, `${nama}.webp`)

        return this.minta('POST', `/cbt/attempt/${attemptId}/pelanggaran`, form)
    }

    kumpul(attemptId: number, waktuKlienMs?: number): Promise<{ status: string }> {
        return this.minta('POST', `/cbt/attempt/${attemptId}/kumpul`, { waktu_klien_ms: waktuKlienMs })
    }

    hasil(attemptId: number): Promise<HasilRespons> {
        return this.minta('GET', `/cbt/attempt/${attemptId}/hasil`)
    }

    private async minta<T>(
        metode: string,
        jalur: string,
        isi?: unknown,
        berToken = true,
        onProgres?: (diterima: number, total: number | null) => void,
    ): Promise<T> {
        const kepala: Record<string, string> = { Accept: 'application/json' }
        if (berToken) {
            const token = await this.opsi.ambilToken()
            if (token) kepala.Authorization = `Bearer ${token}`
        }
        let body: BodyInit | undefined
        if (isi instanceof FormData) {
            body = isi
        } else if (isi !== undefined) {
            kepala['Content-Type'] = 'application/json'
            body = JSON.stringify(isi)
        }

        let respons: Response
        try {
            respons = await this.fetch(this.opsi.baseUrl.replace(/\/$/, '') + jalur, { method: metode, headers: kepala, body })
        } catch {
            throw new GalatApi('JARINGAN', 'Tidak tersambung ke server.', 0)
        }

        const data = (respons.ok && onProgres ? await bacaDenganProgres(respons, onProgres) : await respons.json().catch(() => ({}))) as Record<string, unknown>
        if (respons.ok) return data as T

        // 401 saat login = kredensial salah, bukan sesi berakhir.
        if (respons.status === 401 && berToken) {
            this.opsi.saatTidakSah?.()
            throw new GalatApi('TIDAK_SAH', String(data.message ?? 'Sesi berakhir, silakan masuk lagi.'), 401, data)
        }
        const { message, kode, ...lain } = data
        throw new GalatApi((kode as KodeGalat) ?? (respons.status === 401 ? 'TIDAK_SAH' : 'TIDAK_DIKENAL'), String(message ?? `Galat ${respons.status}`), respons.status, lain)
    }
}

/** Baca badan respons JSON sambil melaporkan byte yang sudah diterima. */
async function bacaDenganProgres(respons: Response, onProgres: (diterima: number, total: number | null) => void): Promise<unknown> {
    const total = Number(respons.headers.get('Content-Length')) || null
    if (!respons.body) {
        const teks = await respons.text()
        onProgres(teks.length, total)

        return JSON.parse(teks)
    }
    const pembaca = respons.body.getReader()
    const potongan: Uint8Array[] = []
    let diterima = 0
    onProgres(0, total)
    for (;;) {
        const { done, value } = await pembaca.read()
        if (done) break
        potongan.push(value)
        diterima += value.length
        onProgres(diterima, total)
    }
    const semua = new Uint8Array(diterima)
    let posisi = 0
    for (const p of potongan) {
        semua.set(p, posisi)
        posisi += p.length
    }
    try {
        return JSON.parse(new TextDecoder().decode(semua))
    } catch {
        throw new GalatApi('JARINGAN', 'Unduhan paket terputus. Coba lagi.', 0)
    }
}
