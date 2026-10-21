/**
 * Jam server di klien. Jam perangkat tidak dipercaya (bisa diubah murid):
 * waktu = waktu_server terakhir + selisih jam sejak diterima, memakai yang LEBIH
 * BESAR antara selisih jam monotonik dan selisih jam dinding perangkat.
 * - Monotonik (performance.now) berhenti saat perangkat tidur (layar mati di
 *   Android/macOS): tanpa jam dinding, timer tertinggal selama HP tidur offline.
 * - Jam dinding bisa diubah murid, tapi hanya memajukan yang berpengaruh, dan itu
 *   justru mempercepat habisnya waktu; memundurkan jam tidak menambah waktu.
 */
export class JamServer {
    private dasarServer: number
    private dasarMonotonik: number
    private dasarDinding: number

    constructor(
        waktuServer: string,
        private readonly monotonik: () => number = () => performance.now(),
        private readonly dinding: () => number = () => Date.now(),
    ) {
        this.dasarServer = Date.parse(waktuServer)
        this.dasarMonotonik = this.monotonik()
        this.dasarDinding = this.dinding()
    }

    /** Perbarui dari respons server (mis. tiap sinkron). */
    setel(waktuServer: string): void {
        this.dasarServer = Date.parse(waktuServer)
        this.dasarMonotonik = this.monotonik()
        this.dasarDinding = this.dinding()
    }

    /** Epoch ms menurut server. */
    sekarang(): number {
        return this.dasarServer + Math.max(this.monotonik() - this.dasarMonotonik, this.dinding() - this.dasarDinding)
    }

    sisaMs(sampai: string): number {
        return Math.max(0, Date.parse(sampai) - this.sekarang())
    }
}

/** Ms sejak mulai attempt, untuk `waktu_klien_ms` (relatif, bukan jam perangkat). */
export function msSejak(mulai: number, monotonik: () => number = () => performance.now()): number {
    return Math.max(0, Math.round(monotonik() - mulai))
}
