/** Tanggal ganda Masehi + Hijriah, seperti di Dinar ("Rabu, 14 Okt 2026 · 3 Jumadilawal 1448 H"). */
export function tanggalGanda(d = new Date()): string {
    const masehi = new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' }).format(d)
    let hijriah = ''
    try {
        hijriah = new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)
    } catch {
        // kalender islam tidak tersedia di WebView lama
    }

    return hijriah ? `${masehi} · ${hijriah}` : masehi
}

export function jamMenit(iso: string): string {
    return new Date(iso).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

export function hariTanggal(iso: string): string {
    return new Date(iso).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** "2 j 15 m", "45 m", "kurang dari 1 m" */
export function durasiSingkat(ms: number): string {
    const menit = Math.floor(ms / 60_000)
    if (menit < 1) return 'kurang dari 1 m'
    const hari = Math.floor(menit / 1440)
    if (hari >= 1) return `${hari} hari`
    const jam = Math.floor(menit / 60)

    return jam ? `${jam} j ${menit % 60} m` : `${menit} m`
}
