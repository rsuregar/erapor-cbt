export const ZONA_WAKTU_WITA = 'Asia/Makassar' // WITA (UTC+8)

/** Tanggal ganda Masehi + Hijriah dalam zona WITA ("Rabu, 14 Okt 2026 · 3 Jumadilawal 1448 H"). */
export function tanggalGanda(d: Date | number = new Date()): string {
    const tanggal = typeof d === 'number' ? new Date(d) : d
    const masehi = new Intl.DateTimeFormat('id-ID', {
        timeZone: ZONA_WAKTU_WITA,
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
    }).format(tanggal)

    let hijriah = ''
    try {
        hijriah = new Intl.DateTimeFormat('id-ID-u-ca-islamic-umalqura', {
            timeZone: ZONA_WAKTU_WITA,
            day: 'numeric',
            month: 'long',
            year: 'numeric',
        }).format(tanggal)
    } catch {
        // kalender islam tidak tersedia di WebView lama
    }

    return hijriah ? `${masehi} · ${hijriah}` : masehi
}

/** Format waktu jam.menit dalam WITA (+8), contoh: "11.19" atau "11.19 WITA" */
export function jamMenit(iso: string, denganZona = false): string {
    const teks = new Date(iso)
        .toLocaleTimeString('id-ID', {
            timeZone: ZONA_WAKTU_WITA,
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        })
        .replace(':', '.')

    return denganZona ? `${teks} WITA` : teks
}

/** Format hari dan tanggal dalam zona WITA (+8) */
export function hariTanggal(iso: string): string {
    return new Date(iso).toLocaleDateString('id-ID', {
        timeZone: ZONA_WAKTU_WITA,
        weekday: 'long',
        day: 'numeric',
        month: 'long',
    })
}

/** Mendapatkan tanggal YYYY-MM-DD dalam zona WITA (+8) untuk perbandingan hari yang presisi */
export function tanggalKunciWita(msOrDate: number | Date | string): string {
    const d = typeof msOrDate === 'string' ? new Date(msOrDate) : typeof msOrDate === 'number' ? new Date(msOrDate) : msOrDate
    return new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_WAKTU_WITA }).format(d)
}

/** "2 j 15 m", "45 m", "kurang dari 1 m" */
export function durasiSingkat(ms: number): string {
    const menit = Math.floor(ms / 60_000)
    if (menit < 1) {
        const detik = Math.floor(ms / 1000)
        return detik > 0 ? `${detik} dtk` : 'sekarang'
    }
    const hari = Math.floor(menit / 1440)
    if (hari >= 1) return `${hari} hari`
    const jam = Math.floor(menit / 60)

    return jam ? `${jam} j ${menit % 60} m` : `${menit} m`
}

/**
 * Format durasi relatif yang alami dalam bahasa Indonesia:
 * - "1 jam lagi"
 * - "1 jam 25 menit lagi"
 * - "30 menit lagi"
 * - "4 menit 15 detik lagi" (jika mendesak < 5 menit)
 * - "45 detik lagi"
 */
export function durasiLengkap(ms: number): string {
    if (ms <= 0) return 'waktu habis'
    const totalDetik = Math.floor(ms / 1000)
    if (totalDetik < 60) {
        return `${totalDetik} detik lagi`
    }

    const totalMenit = Math.floor(totalDetik / 60)
    const detikSisa = totalDetik % 60
    const totalJam = Math.floor(totalMenit / 60)
    const menitSisa = totalMenit % 60
    const totalHari = Math.floor(totalJam / 24)
    const jamSisa = totalJam % 24

    if (totalHari >= 1) {
        return jamSisa > 0 ? `${totalHari} hari ${jamSisa} jam lagi` : `${totalHari} hari lagi`
    }

    if (totalJam >= 1) {
        return menitSisa > 0 ? `${totalJam} jam ${menitSisa} menit lagi` : `${totalJam} jam lagi`
    }

    if (totalMenit < 5 && detikSisa > 0) {
        return `${totalMenit} menit ${detikSisa} detik lagi`
    }

    return `${totalMenit} menit lagi`
}
