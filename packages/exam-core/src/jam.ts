/**
 * Jam server di klien. Jam perangkat tidak dipercaya (bisa diubah murid):
 * waktu = waktu_server terakhir + selisih jam MONOTONIK sejak diterima.
 */
export class JamServer {
    private dasarServer: number
    private dasarMonotonik: number

    constructor(
        waktuServer: string,
        private readonly monotonik: () => number = () => performance.now(),
    ) {
        this.dasarServer = Date.parse(waktuServer)
        this.dasarMonotonik = this.monotonik()
    }

    /** Perbarui dari respons server (mis. tiap sinkron). */
    setel(waktuServer: string): void {
        this.dasarServer = Date.parse(waktuServer)
        this.dasarMonotonik = this.monotonik()
    }

    /** Epoch ms menurut server. */
    sekarang(): number {
        return this.dasarServer + (this.monotonik() - this.dasarMonotonik)
    }

    sisaMs(sampai: string): number {
        return Math.max(0, Date.parse(sampai) - this.sekarang())
    }
}

/** Ms sejak mulai attempt, untuk `waktu_klien_ms` (relatif, bukan jam perangkat). */
export function msSejak(mulai: number, monotonik: () => number = () => performance.now()): number {
    return Math.max(0, Math.round(monotonik() - mulai))
}
