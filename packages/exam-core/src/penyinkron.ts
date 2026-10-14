import { GalatApi, type KlienApi } from './api'
import type { JamServer } from './jam'
import type { Detak, SinkronRespons } from './kontrak'
import type { Outbox } from './outbox'

export type OpsiPenyinkron = {
    api: KlienApi
    outbox: Outbox
    attemptId: number
    jam: JamServer
    /** detak tetap dikirim walau tidak ada jawaban baru (kontrak: 15 detik) */
    intervalMs?: number
    /** jeda setelah jawaban berubah sebelum dikirim */
    jedaMs?: number
    detak?: () => Omit<Detak, 'offline_ms'>
    saatRespons?: (r: SinkronRespons) => void
    saatStatusKoneksi?: (online: boolean, tertunda: number) => void
    saatGalat?: (g: GalatApi) => void
    setTimeout?: typeof setTimeout
    clearTimeout?: typeof clearTimeout
    monotonik?: () => number
}

/**
 * Pengirim outbox + detak (POST /sinkron). Satu permintaan pada satu waktu;
 * gagal jaringan tidak membuang apa pun — antrean tetap di penyimpanan dan
 * dikirim ulang di putaran berikutnya. Lama offline dilaporkan lewat
 * `offline_ms` (tidak dihitung pelanggaran oleh server).
 */
export class Penyinkron {
    private timer?: ReturnType<typeof setTimeout>
    private jalan = false
    private sedangKirim = false
    private ulangSetelahKirim = false
    private offlineSejak: number | null = null
    private offlineMs = 0
    private readonly st: typeof setTimeout
    private readonly ct: typeof clearTimeout
    private readonly mono: () => number

    constructor(private readonly o: OpsiPenyinkron) {
        this.st = o.setTimeout ?? setTimeout
        this.ct = o.clearTimeout ?? clearTimeout
        this.mono = o.monotonik ?? (() => performance.now())
    }

    mulai(): void {
        if (this.jalan) return
        this.jalan = true
        void this.kirim()
    }

    henti(): void {
        this.jalan = false
        if (this.timer) this.ct(this.timer)
    }

    /** Jawaban berubah: kirim setelah jeda singkat, bukan menunggu 15 detik. */
    picu(): void {
        this.jadwalkan(this.o.jedaMs ?? 1500)
    }

    /** Kirim sekarang (event online, app kembali terlihat, sebelum kumpul). */
    async kirim(): Promise<SinkronRespons | null> {
        if (this.sedangKirim) {
            this.ulangSetelahKirim = true

            return null
        }
        this.sedangKirim = true
        if (this.timer) this.ct(this.timer)

        try {
            const entri = await this.o.outbox.antrean()
            const r = await this.o.api.sinkron(this.o.attemptId, entri, { ...this.o.detak?.(), offline_ms: Math.round(this.totalOffline()) })
            await this.o.outbox.akui(r.diakui)
            this.o.jam.setel(r.waktu_server)
            this.tandaiOnline()
            this.o.saatRespons?.(r)
            this.o.saatStatusKoneksi?.(true, await this.o.outbox.jumlahTertunda())

            return r
        } catch (e) {
            const g = e instanceof GalatApi ? e : new GalatApi('JARINGAN', String(e), 0)
            if (g.sementara) {
                this.tandaiOffline()
                this.o.saatStatusKoneksi?.(false, await this.o.outbox.jumlahTertunda())
            } else {
                this.o.saatGalat?.(g)
            }

            return null
        } finally {
            this.sedangKirim = false
            if (this.ulangSetelahKirim) {
                this.ulangSetelahKirim = false
                this.jadwalkan(0)
            } else {
                this.jadwalkan(this.o.intervalMs ?? 15_000)
            }
        }
    }

    private jadwalkan(ms: number): void {
        if (!this.jalan) return
        if (this.timer) this.ct(this.timer)
        this.timer = this.st(() => void this.kirim(), ms)
    }

    private tandaiOffline(): void {
        this.offlineSejak ??= this.mono()
    }

    private tandaiOnline(): void {
        if (this.offlineSejak !== null) {
            this.offlineMs += this.mono() - this.offlineSejak
            this.offlineSejak = null
        }
    }

    private totalOffline(): number {
        return this.offlineMs + (this.offlineSejak !== null ? this.mono() - this.offlineSejak : 0)
    }
}
